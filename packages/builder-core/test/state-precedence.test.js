// Several persistent states can swap the same token (checked and disabled both recolour the box). One pass decides the variable a layer takes: the
// last declared state that is on wins (disabled is declared after checked), else the base; going from one state to another needs one sync, not two.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planStateBindings } from '../src/behavior-engine/state-bindings.js';
import { BOXY, modelFor } from './helpers/box-template.js';

const model = modelFor(BOXY);
const items = model.variables.items;
const id = name => items.find(i => i.name === name).id;
const box = model.created.find(n => n.name === 'box');

/** A fresh instance box that holds `fill` and `stroke` variables (item names), and the plan for `props`. */
const run = (held, props) => {
    const instance = { id: 'i-box', vars: { 'fills.0': id(held.fill), stroke: id(held.stroke) } };
    const { ops, warnings } = planStateBindings({ template: model.template, binding: model.binding, props, layers: [{ key: 'box', instance, master: { vars: box.vars } }], variables: model.variables });
    for (const op of ops) instance.vars[op.prop] = op.value;
    return { ops, warnings, vars: instance.vars };
};
const names = vars => [items.find(i => i.id === vars['fills.0']).name, items.find(i => i.id === vars.stroke).name];

test('the box starts on its base variables', () => {
    assert.deepEqual(names(box.vars), ['box-bg', 'box-border']);
});

test('checked swaps the box colours, and off puts the base back', () => {
    const on = run({ fill: 'box-bg', stroke: 'box-border' }, { checked: true });
    assert.deepEqual(names(on.vars), ['box-bg-checked', 'box-border-checked']);
    assert.deepEqual(names(run({ fill: 'box-bg-checked', stroke: 'box-border-checked' }, {}).vars), ['box-bg', 'box-border']);
});

test('disabled wins over checked, whichever came first', () => {
    assert.deepEqual(names(run({ fill: 'box-bg', stroke: 'box-border' }, { checked: true, disabled: true }).vars), ['box-bg-disabled', 'box-border-disabled']);
    assert.deepEqual(names(run({ fill: 'box-bg-checked', stroke: 'box-border-checked' }, { checked: true, disabled: true }).vars), ['box-bg-disabled', 'box-border-disabled']);
});

test('from disabled back to enabled with checked still on lands on the checked colours in one pass', () => {
    const held = { fill: 'box-bg-disabled', stroke: 'box-border-disabled' };
    assert.deepEqual(names(run(held, { checked: true }).vars), ['box-bg-checked', 'box-border-checked']);
    assert.deepEqual(names(run(held, {}).vars), ['box-bg', 'box-border']);
});

test('a second pass over its own result changes nothing', () => {
    for (const props of [{}, { checked: true }, { disabled: true }, { checked: true, disabled: true }]) {
        const first = run({ fill: 'box-bg', stroke: 'box-border' }, props);
        const again = planStateBindings({ template: model.template, binding: model.binding, props, layers: [{ key: 'box', instance: { id: 'i-box', vars: first.vars }, master: { vars: box.vars } }], variables: model.variables });
        assert.deepEqual(again.ops, [], JSON.stringify(props));
    }
});

test('a variable the designer set by hand is kept and reported', () => {
    const hand = { fill: 'box-bg-checked', stroke: 'box-border' };
    const instance = { id: 'i-box', vars: { 'fills.0': 'by-hand', stroke: id('box-border') } };
    const out = planStateBindings({ template: model.template, binding: model.binding, props: { checked: true }, layers: [{ key: 'box', instance, master: { vars: box.vars } }], variables: model.variables });
    assert.ok(!out.ops.some(op => op.prop === 'fills.0'));
    assert.ok(out.warnings.some(w => w.reason === 'rebound-by-hand'));
    assert.ok(hand);
});
