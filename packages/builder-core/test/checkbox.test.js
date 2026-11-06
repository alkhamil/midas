// Checkbox: a box (a group frame that draws the one border) holding a managed checkmark or square, and a managed label. Props checked, indeterminate,
// disabled; every visual value is a token; the glyphs are managed icon slots inside the box.
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

const checkbox = TEMPLATES.get('checkbox');
const model = modelFor(checkbox);
const names = (props, type) => instanceFor(model, props).filter(n => !type || n.type === type).map(n => n.name);

test('Checkbox is a registered form control whose primary slot is the label', () => {
    assert.ok(checkbox);
    assert.equal(checkbox.isControl, true);
    assert.equal(checkbox.primarySlot, 'label');
    assert.deepEqual(Object.keys(checkbox.props).filter(p => checkbox.props[p].source === 'literal' && checkbox.props[p].type === 'boolean'), ['checked', 'indeterminate', 'hasLabel', 'disabled']);
});

test('a fresh instance shows ONE text node: the label', () => {
    assert.deepEqual(names({}, 'text'), ['label']);
    assert.equal(instanceFor(model, {}).find(n => n.name === 'label').text, 'Checkbox');
});

test('the label is never lost on a toggle: it is removed and made again from the prop that kept it', () => {
    const on = { label: 'Accept terms' };
    const layers = instanceFor(model, on).slice(1).map(n => ({ id: n.id, slot: n.behavior?.slot ?? null, name: n.name }));
    assert.equal(planAnatomy(checkbox, resolveProps(checkbox, { ...on, hasLabel: false }), layers).filter(op => op.op === 'remove').length, 1);
    assert.deepEqual(names({ ...on, hasLabel: false }, 'text'), []);
    assert.equal(instanceFor(model, { ...on, hasLabel: true }).find(n => n.name === 'label').text, 'Accept terms');
    assert.deepEqual(names({ hasLabel: true, label: '' }, 'text'), [], 'an empty label asks for no layer');
});

test('the checkmark and the square are managed icon slots inside the box, exclusive with each other', () => {
    const glyphs = props => instanceFor(model, props).filter(n => ['check', 'indeterminate'].includes(n.behavior?.slot));
    const inBox = props => { const nodes = instanceFor(model, props), box = nodes.find(n => n.behavior?.group === 'box'); return nodes.filter(n => n.behavior?.slot === 'check').map(n => n.parentId === box.id); };
    assert.deepEqual(glyphs({}).map(n => n.name), []);
    assert.deepEqual(glyphs({ checked: true }).map(n => n.name), ['check']);
    assert.deepEqual(inBox({ checked: true }), [true], 'the checkmark hangs under the box');
    assert.deepEqual(glyphs({ indeterminate: true }).map(n => n.name), ['indeterminate']);
    assert.equal(checkbox.props.checked.exclusiveWith, 'indeterminate');
    assert.equal(checkbox.props.indeterminate.exclusiveWith, 'checked');
});

test('the icon set holds the checkmark and the square, each the default of its role', () => {
    assert.deepEqual(ICON_SET.filter(e => ['check', 'indeterminate'].includes(e.role)).map(e => e.name), ['check', 'square']);
    assert.deepEqual(iconRolesOf([checkbox]), ['check', 'indeterminate']);
});

test('the master is the root and the box only, centred, with no diagnostics error and no part missing', () => {
    assert.deepEqual(model.created.map(n => n.name), ['box']);
    const box = model.created[0];
    assert.equal(box.primaryAlign, 'center');
    assert.equal(box.counterAlign, 'center');
    const doc = { variables: model.variables, pages: [{ name: 'p', nodes: [model.frame, ...model.created] }] };
    assert.deepEqual(diagnoseDocument(doc).filter(f => f.severity === 'error' || f.code === 'part-missing'), []);
});

test('the box is bound to its tokens and is fixed at the box size; the root has none of it', () => {
    const box = model.created[0];
    const bound = Object.keys(box.vars).sort();
    assert.deepEqual(bound, ['fills.0', 'h', 'radius', 'stroke', 'strokeWidth', 'w']);
    assert.equal(box.layoutSizingH, 'fixed');
    assert.equal(box.layoutSizingV, 'fixed');
    assert.equal(model.frame.vars?.stroke, undefined, 'one border-drawing element: the box');
});

test('the label is bound to colour and typography, hug x hug, with no width or height variable', () => {
    const layers = instanceFor(model, { checked: true }).filter(n => n.type === 'text').map(node => ({ key: node.behavior.slot, node }));
    const { ops, problems } = planManagedTextBindings({ template: checkbox, binding: model.binding, props: resolveProps(checkbox, {}), layers, variables: model.variables });
    assert.deepEqual(problems, []);
    applyBindTokens(layers, ops);
    const label = layers[0].node;
    assert.ok(label.vars['fills.0'] && label.vars.typography);
    assert.equal(label.vars.w, undefined);
    assert.equal(label.vars.h, undefined);
    assert.deepEqual([label.layoutSizingH, label.layoutSizingV], ['hug', 'hug']);
});

test('the export draws the box with its glyph slots and the label, the state attributes on the root', () => {
    const out = generateComponent(checkbox, model.binding, model.variables, 'Checkbox', model.frame, id => model.created.filter(n => n.parentId === id));
    assert.deepEqual(out.problems, []);
    const jsx = out.files['Checkbox.jsx'];
    assert.match(jsx, /<label/);
    assert.match(jsx, /data-checked=\{checked \|\| undefined\}/);
    assert.match(jsx, /<div className="checkbox-box">[\s\S]*checkbox-check[\s\S]*checkbox-indeterminate[\s\S]*<\/div>/);
    assert.match(jsx, /className="checkbox-label"/);
    assert.match(out.files['Checkbox.css'], /\[data-checked\]:not\(\[aria-disabled="true"\]\)/);
});

test('Play draws the state attributes and the label from the instance', () => {
    const nodes = instanceFor(model, { checked: true, label: 'Agree' });
    const { root, problems } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, ...nodes] }], variables: model.variables }, nodes[0].id);
    assert.deepEqual(problems, []);
    assert.equal(root.attrs['data-checked'], true);
    assert.ok(root.children.some(c => c.text === 'Agree'), 'the label layer is drawn');
});

test('sampleProps give the generated demo instance its label', () => {
    assert.deepEqual(checkbox.sampleProps, { label: 'Checkbox label' });
});
