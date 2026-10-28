import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSelectTarget } from '../src/selection.js';

// A small page: A is a top-level frame holding a nested frame B (with text T), a rectangle C and an instance I (with K).
// E is an empty top-level frame. F is a top-level frame holding G. R is a top-level rectangle.
const specs = [
    { id: 'A', type: 'frame' },
    { id: 'B', parentId: 'A', type: 'frame' },
    { id: 'T', parentId: 'B', type: 'text' },
    { id: 'C', parentId: 'A', type: 'rectangle' },
    { id: 'I', parentId: 'A', type: 'frame', isInstance: true },
    { id: 'K', parentId: 'I', type: 'rectangle' },
    { id: 'V', type: 'frame', isInstance: true },
    { id: 'W', parentId: 'V', type: 'rectangle' },
    { id: 'E', type: 'frame' },
    { id: 'S', type: 'frame', componentSet: true },
    { id: 'S1', parentId: 'S', type: 'frame', component: true },
    { id: 'P', type: 'frame', isAutoLayout: true },
    { id: 'Q', parentId: 'P', type: 'rectangle' },
    { id: 'F', type: 'frame' },
    { id: 'G', parentId: 'F', type: 'rectangle' },
    { id: 'R', type: 'rectangle' },
];

function tree(list) {
    const layers = new Map(list.map(s => [s.id, { type: 'rectangle', isSection: false, isInstance: false, isAutoLayout: false, componentSet: false, parentId: null, ...s }]));
    const all = [...layers.values()];
    for (const l of all) {
        l.parentIsSection = !!(l.parentId && layers.get(l.parentId)?.isSection);
        l.childCount = all.filter(c => c.parentId === l.id).length;
    }
    return { get: id => layers.get(id), path: ids => ids.map(id => layers.get(id)) };
}
const page = tree(specs);

/** The id the rules pick, for a hit path (root first), a selection (ids) and modifiers. */
function pick(path, selection = [], modifiers = {}) {
    return resolveSelectTarget({ path: page.path(path), selection: selection.map(id => page.get(id)), ...modifiers });
}

test('a click on a nested frame inside a top-level frame selects the top-level frame\'s child', () => {
    assert.equal(pick(['A', 'B', 'T']), 'B');
});

test('a click on a top-level frame\'s empty area selects nothing: the frame is picked through its label', () => {
    assert.equal(pick(['A']), null);
});

test('a click on an empty top-level frame selects the frame', () => {
    assert.equal(pick(['E']), 'E');
});

test('a click on an auto layout top-level frame\'s empty area selects the frame', () => {
    assert.equal(pick(['P']), 'P');
});

test('a click on a child of an auto layout top-level frame selects the child', () => {
    assert.equal(pick(['P', 'Q']), 'Q');
});

test('a top-level component set is picked through its label, like any non-auto-layout frame', () => {
    assert.equal(pick(['S']), null);
    assert.equal(pick(['S', 'S1']), 'S1');
});

test('a click on a top-level rectangle selects it', () => {
    assert.equal(pick(['R']), 'R');
});

test('double-click drills one level per step, down to a leaf', () => {
    assert.equal(pick(['A', 'B', 'T'], ['A'], { drill: true }), 'B');
    assert.equal(pick(['A', 'B', 'T'], ['B'], { drill: true }), 'T');
    assert.equal(pick(['A', 'B', 'T'], ['T'], { drill: true }), null, 'a leaf selection is left alone');
});

test('double-click on a selected container picks nothing when the cursor is outside it', () => {
    assert.equal(pick(['F', 'G'], ['B'], { drill: true }), null);
});

test('double-click with several layers selected picks nothing', () => {
    assert.equal(pick(['A', 'B', 'T'], ['A', 'R'], { drill: true }), null);
});

test('double-click with nothing selected works as a click', () => {
    assert.equal(pick(['A', 'B', 'T'], [], { drill: true }), 'B');
});

test('a click on a sibling inside the current scope selects the sibling', () => {
    assert.equal(pick(['A', 'C'], ['B']), 'C');
});

test('a click outside the current scope resets to the top level', () => {
    assert.equal(pick(['F', 'G'], ['B']), 'G');
});

test('a click on a top-level layer\'s child, with that layer selected, picks the child', () => {
    assert.equal(pick(['A', 'B', 'T'], ['R']), 'B');
});

test('Ctrl/Cmd+click deep selects the deepest layer under the cursor', () => {
    assert.equal(pick(['A', 'B', 'T'], ['B'], { deep: true }), 'T');
    assert.equal(pick(['A', 'B', 'T'], [], { deep: true }), 'T');
});

test('an instance is selected as a unit: a click on its layers picks the instance', () => {
    assert.equal(pick(['A', 'I', 'K']), 'I');
    assert.equal(pick(['A', 'I', 'K'], ['I']), 'I');
});

test('a top-level instance is selected as a unit too', () => {
    assert.equal(pick(['V', 'W']), 'V');
});

// A standalone component (M, auto layout, with its text N), a component set (S) with two variants (S1, S2) and a text in each.
const componentPage = tree([
    { id: 'M', type: 'frame', isAutoLayout: true, isStandaloneComponent: true },
    { id: 'N', parentId: 'M', type: 'text' },
    { id: 'S', type: 'frame', componentSet: true, isAutoLayout: true },
    { id: 'S1', parentId: 'S', type: 'frame', isAutoLayout: true },
    { id: 'N1', parentId: 'S1', type: 'text' },
    { id: 'S2', parentId: 'S', type: 'frame', isAutoLayout: true },
    { id: 'N2', parentId: 'S2', type: 'text' },
]);
const pickIn = (path, selection = [], modifiers = {}) => resolveSelectTarget({ path: componentPage.path(path), selection: selection.map(id => componentPage.get(id)), ...modifiers });

test('a standalone component is picked as a whole: a plain click on its label picks the component first', () => {
    assert.equal(pickIn(['M', 'N']), 'M');
});

test('with the component selected, a plain click on its label keeps the component', () => {
    assert.equal(pickIn(['M', 'N'], ['M']), 'M');
});

test('Ctrl/Cmd+click on the label of a component picks the label; a double-click (drill) on the selected component picks it too', () => {
    assert.equal(pickIn(['M', 'N'], [], { deep: true }), 'N');
    assert.equal(pickIn(['M', 'N'], ['M'], { drill: true }), 'N');
});

test('a component set picks its variants directly: a plain click on a variant does not need the set selected', () => {
    assert.equal(pickIn(['S', 'S1', 'N1']), 'S1');
    assert.equal(pickIn(['S', 'S2', 'N2'], ['S1']), 'S2');
});
