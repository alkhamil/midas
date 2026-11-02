import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTemplateToFrame, childOrderAfterBind, instanceOf, layerSpecsOf } from '../src/behavior-engine/template-master.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { BUTTON } from '../src/templates/button.js';
import { buttonModel } from '../../../scripts/button-model.mjs';

const model = buttonModel();
const binding = model.binding;
const variables = { collections: model.collections, items: model.items };

/** A counter for the ids the bind makes, so the layers are told apart. */
const idMaker = () => {
    let n = 0;
    return key => `g${++n}-${key}`;
};

const frameOf = (id = 'f') => ({ id, name: 'Test', type: 'frame', parentId: null, x: 0, y: 0, w: 120, h: 40, fills: [], clip: false, layout: 'horizontal', gap: 0, padding: 0 });
const textOf = (id, name, parentId = 'f') => ({ id, name, type: 'text', parentId, text: name, x: 0, y: 0, w: 40, h: 16, fills: [], fontSize: 14 });

test('the anatomy puts the start icon, the spinner, the label and the end icon in that order', () => {
    const order = layerSpecsOf(BUTTON).map(spec => spec.key);
    assert.deepEqual(order, ['root', 'iconStart', 'spinner', 'label', 'iconEnd']);
});

test('a bind to a frame with a label puts the spinner before the label, not after it', () => {
    const frame = frameOf();
    const label = textOf('lbl', 'label');
    const out = applyTemplateToFrame(BUTTON, { frame, children: [label], binding, variables, idOf: idMaker() });
    const spinner = out.created.find(n => n.name === 'spinner');
    assert.deepEqual(childOrderAfterBind(BUTTON, [label, spinner], [spinner]), [spinner.id, label.id]);
});

test('an unrelated layer after the label keeps its place: the spinner goes before the label only', () => {
    const frame = frameOf();
    const label = textOf('lbl', 'Test');
    const note = textOf('note', 'Note');
    const out = applyTemplateToFrame(BUTTON, { frame, children: [label, note], binding, variables, idOf: idMaker() });
    const spinner = out.created.find(n => n.name === 'spinner');
    assert.deepEqual(childOrderAfterBind(BUTTON, [label, note, spinner], [spinner]), [spinner.id, label.id, note.id]);
});

test('an unrelated layer before the label keeps its place ahead of the spinner', () => {
    const frame = frameOf();
    const note = { id: 'note', name: 'Badge', type: 'rectangle', parentId: 'f', x: 0, y: 0, w: 8, h: 8, fills: [] };
    const label = textOf('lbl', 'Test');
    const out = applyTemplateToFrame(BUTTON, { frame, children: [note, label], binding, variables, idOf: idMaker() });
    const spinner = out.created.find(n => n.name === 'spinner');
    assert.deepEqual(childOrderAfterBind(BUTTON, [note, label, spinner], [spinner]), [note.id, spinner.id, label.id]);
});

test('applying the order again changes nothing: a second bind creates no layer and keeps the order', () => {
    const frame = frameOf();
    const label = textOf('lbl', 'Test');
    const out = applyTemplateToFrame(BUTTON, { frame, children: [label], binding, variables, idOf: idMaker() });
    const spinner = out.created.find(n => n.name === 'spinner');
    const ordered = childOrderAfterBind(BUTTON, [label, spinner], [spinner]);
    const again = applyTemplateToFrame(BUTTON, { frame, children: [label, spinner], binding, variables, idOf: idMaker() });
    assert.equal(again.created.length, 0, 'nothing is created the second time');
    assert.deepEqual(childOrderAfterBind(BUTTON, [label, spinner], []).length, 2);
    assert.deepEqual(childOrderAfterBind(BUTTON, ordered.map(id => [label, spinner].find(n => n.id === id)), []), ordered);
});

test('the spinner arc is the same on the create path and on the bind path: start -90, sweep 25, ratio 75', () => {
    const create = applyTemplateToFrame(BUTTON, { frame: frameOf(), children: [], binding, variables, idOf: idMaker() });
    const bind = applyTemplateToFrame(BUTTON, { frame: frameOf(), children: [textOf('lbl', 'Test')], binding, variables, idOf: idMaker() });
    for (const out of [create, bind]) {
        const spinner = out.created.find(n => n.name === 'spinner');
        assert.deepEqual({ start: spinner.arcStart, sweep: spinner.arcSweep, ratio: spinner.arcRatio }, { start: -90, sweep: 25, ratio: 75 });
    }
});

test('a loading instance draws its spinner in Play on the bind path: an arc path in the stroke colour, and the spinner is in order', () => {
    const frame = frameOf();
    const label = textOf('lbl', 'Test');
    const out = applyTemplateToFrame(BUTTON, { frame, children: [label], binding, variables, idOf: idMaker() });
    const spinner = out.created.find(n => n.name === 'spinner');
    frame.behavior = { version: 2, templateId: 'button', variables: { ...binding.variables } };
    const subtree = [label, spinner];
    let n = 0;
    const copies = instanceOf(BUTTON, { ...frame, component: true }, subtree, { loading: true, label: 'Test' }, { id: () => `i-${++n}`, varModes: {} });
    const nodes = [{ ...frame, component: true }, ...subtree, ...copies];
    const { root } = toDomTree({ pages: [{ id: 'p', name: 'Screens', nodes }], variables }, copies[0].id);
    const element = root.children.find(c => c.nodeId === copies.find(x => x.name === 'spinner').id);
    assert.ok(element, 'the spinner is drawn in Play');
    assert.match(element.html, /<path d="M[^"]+"[^>]*stroke="#18181b"/, 'the arc path is drawn in the stroke colour');
    assert.deepEqual(root.children.map(c => c.nodeId).filter(id => id === copies.find(x => x.name === 'spinner').id || id === copies.find(x => x.sourceId === label.id)?.id), [copies.find(x => x.name === 'spinner').id, copies.find(x => x.sourceId === label.id).id], 'the spinner comes before the label in Play');
});
