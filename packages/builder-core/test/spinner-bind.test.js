// The spinner's placement on the bind path: a created spinner goes before the label (start side), and an instance made while
// loading draws it there in Play. The master holds no spinner while loading is off, so the bind path starts from the factory.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTemplateToFrame, childOrderAfterBind, instanceOf, layerSpecsOf, managedPartLayer } from '../src/behavior-engine/template-master.js';
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
const spinnerOf = (parentId = 'f') => managedPartLayer(BUTTON, 'spinner', { loading: true }, { id: idMaker()('spinner'), parentId });

test('the anatomy puts the start icon, the spinner, the label and the end icon in that order', () => {
    const order = layerSpecsOf(BUTTON).map(spec => spec.key);
    assert.deepEqual(order, ['root', 'iconStart', 'spinner', 'label', 'iconEnd']);
});

test('a spinner made while loading goes before the label, not after it', () => {
    const label = textOf('lbl', 'label');
    const spinner = spinnerOf();
    assert.deepEqual(childOrderAfterBind(BUTTON, [label, spinner], [spinner]), [spinner.id, label.id]);
});

test('an unrelated layer after the label keeps its place: the spinner goes before the label only', () => {
    const label = textOf('lbl', 'Test');
    const note = textOf('note', 'Note');
    const spinner = spinnerOf();
    assert.deepEqual(childOrderAfterBind(BUTTON, [label, note, spinner], [spinner]), [spinner.id, label.id, note.id]);
});

test('an unrelated layer before the label keeps its place ahead of the spinner', () => {
    const note = { id: 'note', name: 'Badge', type: 'rectangle', parentId: 'f', x: 0, y: 0, w: 8, h: 8, fills: [] };
    const label = textOf('lbl', 'Test');
    const spinner = spinnerOf();
    assert.deepEqual(childOrderAfterBind(BUTTON, [note, label, spinner], [spinner]), [note.id, spinner.id, label.id]);
});

test('a bind while loading is off creates no spinner; a second bind creates nothing either', () => {
    const frame = frameOf();
    const label = textOf('lbl', 'Test');
    const out = applyTemplateToFrame(BUTTON, { frame, children: [label], binding, variables, idOf: idMaker() });
    assert.equal(out.created.find(n => n.name === 'spinner'), undefined);
    const again = applyTemplateToFrame(BUTTON, { frame, children: [label], binding, variables, idOf: idMaker() });
    assert.equal(again.created.length, 0, 'nothing is created the second time');
});

test('the spinner arc is the same on the factory path and on the instance path: start -90, sweep 25, ratio 75', () => {
    const made = spinnerOf();
    assert.deepEqual({ start: made.arcStart, sweep: made.arcSweep, ratio: made.arcRatio }, { start: -90, sweep: 25, ratio: 75 });
    const copies = instanceOf(BUTTON, { ...frameOf(), component: true }, [textOf('lbl', 'Test')], { loading: true, label: 'Test' }, { id: () => `i-${Math.random()}`, varModes: {}, variables });
    const held = copies.find(n => n.behavior?.part === 'spinner');
    assert.deepEqual({ start: held.arcStart, sweep: held.arcSweep, ratio: held.arcRatio }, { start: -90, sweep: 25, ratio: 75 });
});

test('a loading instance draws its spinner in Play on the instance path: an arc path in the stroke colour, and the spinner is in order', () => {
    const frame = frameOf();
    const label = textOf('lbl', 'Test');
    frame.behavior = { version: 2, templateId: 'button', variables: { ...binding.variables } };
    let n = 0;
    const copies = instanceOf(BUTTON, { ...frame, component: true }, [label], { loading: true, label: 'Test' }, { id: () => `i-${++n}`, varModes: {}, variables });
    const nodes = [{ ...frame, component: true }, label, ...copies];
    const { root } = toDomTree({ pages: [{ id: 'p', name: 'Screens', nodes }], variables }, copies[0].id);
    const element = root.children.find(c => c.nodeId === copies.find(x => x.name === 'spinner').id);
    assert.ok(element, 'the spinner is drawn in Play');
    assert.match(element.html, /<path d="M[^"]+"[^>]*stroke="#18181b"/, 'the arc path is drawn in the stroke colour');
    assert.deepEqual(root.children.map(c => c.nodeId).filter(id => id === copies.find(x => x.name === 'spinner').id || id === copies.find(x => x.sourceId === label.id)?.id), [copies.find(x => x.name === 'spinner').id, copies.find(x => x.sourceId === label.id).id], 'the spinner comes before the label in Play');
});
