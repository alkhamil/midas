// Radio (standalone; Radio.Group is a later tier): a round box (a group frame that draws the one border) holding a managed dot, and a managed label. Props
// checked, disabled (and the label switch). Checked recolours the border only: the box keeps its fill and the dot is the mark.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { ICON_SET, iconRolesOf } from '../src/behavior-engine/icon-set.js';
import { planAnatomy } from '../src/behavior-engine/anatomy.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { diagnoseDocument } from '../src/behavior-engine/diagnostics.js';
import { planManagedTextBindings, applyBindTokens } from '../src/behavior-engine/bind-tokens.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const radio = TEMPLATES.get('radio');
const model = modelFor(radio);

test('Radio is a registered form control whose primary slot is the label; it has no indeterminate', () => {
    assert.ok(radio);
    assert.equal(radio.isControl, true);
    assert.equal(radio.primarySlot, 'label');
    assert.deepEqual(Object.keys(radio.props), ['size', 'checked', 'dotIcon', 'hasLabel', 'label', 'disabled']);
});

test('a fresh instance shows ONE text node: the label; the label is never lost on a toggle', () => {
    const texts = props => instanceFor(model, props).filter(n => n.type === 'text').map(n => n.name);
    assert.deepEqual(texts({}), ['label']);
    const layers = instanceFor(model, { label: 'Option A' }).slice(1).map(n => ({ id: n.id, slot: n.behavior?.slot ?? null, name: n.name }));
    assert.equal(planAnatomy(radio, resolveProps(radio, { label: 'Option A', hasLabel: false }), layers).filter(op => op.op === 'remove').length, 1);
    assert.deepEqual(texts({ label: 'Option A', hasLabel: false }), []);
    assert.equal(instanceFor(model, { label: 'Option A', hasLabel: true }).find(n => n.name === 'label').text, 'Option A');
});

test('the dot is a managed icon slot inside the box, shown while checked', () => {
    const nodes = instanceFor(model, { checked: true });
    const box = nodes.find(n => n.behavior?.group === 'box');
    assert.equal(nodes.find(n => n.behavior?.slot === 'dot').parentId, box.id);
    assert.ok(!instanceFor(model, {}).some(n => n.behavior?.slot === 'dot'));
    assert.deepEqual(ICON_SET.filter(e => e.role === 'dot').map(e => e.name), ['dot']);
    assert.deepEqual(iconRolesOf([radio]), ['dot']);
});

test('the box is round, bound to its tokens, and the one border-drawing element', () => {
    assert.deepEqual(model.created.map(n => n.name), ['box']);
    const box = model.created[0];
    assert.deepEqual(Object.keys(box.vars).sort(), ['fills.0', 'h', 'radius', 'stroke', 'strokeWidth', 'w']);
    assert.equal(model.frame.vars?.stroke, undefined);
    assert.equal(radio.tokenRoles.boxRadius, 'radius-full');
    assert.deepEqual([box.primaryAlign, box.counterAlign], ['center', 'center']);
    const doc = { variables: model.variables, pages: [{ name: 'p', nodes: [model.frame, ...model.created] }] };
    assert.deepEqual(diagnoseDocument(doc).filter(f => f.severity === 'error' || f.code === 'part-missing'), []);
});

test('checked recolours the border only; disabled wins over checked', () => {
    assert.deepEqual(radio.persistentStates.checked.tokens, { 'box-border': 'box-border-checked' });
    assert.deepEqual(Object.keys(radio.persistentStates), ['checked', 'disabled']);
});

test('the label is bound to colour and typography, hug x hug, with no width or height variable', () => {
    const layers = instanceFor(model, {}).filter(n => n.type === 'text').map(node => ({ key: node.behavior.slot, node }));
    const { ops, problems } = planManagedTextBindings({ template: radio, binding: model.binding, props: resolveProps(radio, {}), layers, variables: model.variables });
    assert.deepEqual(problems, []);
    applyBindTokens(layers, ops);
    const label = layers[0].node;
    assert.ok(label.vars['fills.0'] && label.vars.typography);
    assert.deepEqual([label.vars.w, label.vars.h, label.layoutSizingH, label.layoutSizingV], [undefined, undefined, 'hug', 'hug']);
});

test('the export draws the round box with its dot slot and the label; Play draws the state attribute', () => {
    const out = generateComponent(radio, model.binding, model.variables, 'Radio', model.frame, id => model.created.filter(n => n.parentId === id));
    assert.deepEqual(out.problems, []);
    assert.match(out.files['Radio.jsx'], /<div className="radio-box">[\s\S]*radio-dot[\s\S]*<\/div>/);
    assert.match(out.files['Radio.css'], /\.radio-box \{[^}]*border-radius: var\(--radio-box-radius\)/);
    const nodes = instanceFor(model, { checked: true });
    const { root, problems } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, ...nodes] }], variables: model.variables }, nodes[0].id);
    assert.deepEqual(problems, []);
    assert.equal(root.attrs['data-checked'], true);
});

test('sampleProps give the generated demo instance its label', () => {
    assert.deepEqual(radio.sampleProps, { label: 'Radio label' });
});
