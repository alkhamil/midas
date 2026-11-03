// An empty slot that does not ask to be displayed takes no space, on the canvas, in Play and in the export. The studio writes that as the slot
// layer's visibility (slotVisible, from the slot property), so the three read one fact: a hidden layer is skipped by the canvas layout, by the Play
// DOM builder and by the code generator. These tests pin the last two against that data: the layer a sync hides, and the layer it shows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { libraryPackage } from '../src/index.js';
import { slotVisible } from '../src/behavior-engine/slot-rules.js';

const solid = [{ type: 'solid', color: '#ffffff', opacity: 1, visible: true }];

/** An instance `inst` of a plain component with a title and a content slot holding `held` layers, the slot visible as slotVisible says. */
function instanceWith(prop, held) {
    const visible = slotVisible(prop, true, held);
    const nodes = [
        { id: 'inst', name: 'Card', type: 'frame', parentId: null, x: 0, y: 0, w: 200, h: 120, fills: solid, layout: 'vertical', gap: 8, padding: 8, isInstance: true, sourceId: 'card' },
        { id: 'title', name: 'Title', type: 'text', parentId: 'inst', x: 0, y: 0, w: 100, h: 20, text: 'Heading', fills: solid, fontSize: 14, autoW: true },
        { id: 'slot', name: 'Content', type: 'frame', parentId: 'inst', x: 0, y: 0, w: 120, h: 56, fills: [], layout: 'vertical', visible, propBind: { slot: 'p1' }, sourceId: 'frame' },
        ...Array.from({ length: held }, (_, i) => ({ id: `c${i}`, name: `Item ${i}`, type: 'text', parentId: 'slot', x: 0, y: 0, w: 60, h: 20, text: `Item ${i}`, fills: solid, fontSize: 14, autoW: true })),
    ];
    return { pages: [{ id: 'p', name: 'Screens', nodes }] };
}
const playChildren = doc => toDomTree(doc, 'inst').root.children.map(c => c.nodeId);

test('Play draws no element for an empty slot that does not ask to be displayed, so it takes no room in the flow', () => {
    assert.deepEqual(playChildren(instanceWith({ showEmpty: false }, 0)), ['title']);
    assert.deepEqual(playChildren(instanceWith({}, 0)), ['title']);
});

test('Play draws the slot when it asks to be displayed empty, and when it holds a layer', () => {
    assert.deepEqual(playChildren(instanceWith({ showEmpty: true }, 0)), ['title', 'slot']);
    assert.deepEqual(playChildren(instanceWith({ showEmpty: false }, 2)), ['title', 'slot']);
    const slot = toDomTree(instanceWith({}, 2), 'inst').root.children.find(c => c.nodeId === 'slot');
    assert.deepEqual(slot.children.map(c => c.nodeId), ['c0', 'c1']);
});

/** The code the library packager writes for a component whose slot-like frame is `visible`. */
function exportedSource(visible) {
    const nodes = [
        { id: 'card', name: 'Card', type: 'frame', component: true, parentId: null, layout: 'vertical', gap: 8, w: 200, h: 120, fill: '#FFFFFF' },
        { id: 'card-t', parentId: 'card', name: 'Title', type: 'text', text: 'Heading', fontSize: 14, autoW: true, w: 60, h: 20, fill: '#111827' },
        { id: 'card-s', parentId: 'card', name: 'Content', type: 'frame', w: 120, h: 56, layout: 'vertical', visible, fill: '#EEEEEE' },
        { id: 'card-s-t', parentId: 'card-s', name: 'Inside', type: 'text', text: 'SLOTMARK', fontSize: 14, autoW: true, w: 60, h: 20, fill: '#111827' },
    ];
    const out = libraryPackage({ components: [{ id: 'card', name: 'Card', nodes }], variables: { collections: [], items: [] } });
    return Object.entries(out.files).filter(([name]) => name.endsWith('.tsx')).map(([, text]) => text).join('\n');
}

test('the export writes nothing for a hidden slot layer, and writes it once it is shown', () => {
    assert.doesNotMatch(exportedSource(false), /SLOTMARK/);
    assert.match(exportedSource(true), /SLOTMARK/);
    assert.match(exportedSource(false), /Heading/, 'the rest of the component is written');
});
