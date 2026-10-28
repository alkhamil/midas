import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planStateBindings } from '../src/behavior-engine/state-bindings.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';

const button = TEMPLATES.get('button');
const variant = { id: 'c-variant', name: 'Variant', modes: [{ id: 'primary' }, { id: 'danger' }] };
const size = { id: 'c-size', name: 'Size', modes: [{ id: 'sm' }] };
const item = (id, name, collectionId = 'c-variant') => ({ id, name, type: 'color', collectionId, values: {} });
const items = [
    item('i-bg', 'button/bg'), item('i-bg-disabled', 'button/bg-disabled'),
    item('i-fg', 'button/fg'), item('i-fg-disabled', 'button/fg-disabled'),
    item('i-border', 'button/border'), item('i-card', 'card/bg'),
];
const variables = (over = items) => ({ collections: [variant, size], items: over });
const binding = { version: 2, templateId: 'button', variables: { variant: 'c-variant', size: 'c-size' } };

/** A master layer pair: the root (fill bound to the base) and the label (fill bound to fg). */
const layers = (instanceVars = { root: { fill: 'i-bg' }, label: { fill: 'i-fg' } }) => [
    { key: 'root', instance: { id: 'i1', vars: instanceVars.root }, master: { vars: { fill: 'i-bg', stroke: 'i-border' } } },
    { key: 'label', instance: { id: 'il', vars: instanceVars.label }, master: { vars: { fill: 'i-fg' } } },
];
const plan = (props, instanceVars, over) => planStateBindings({ template: button, binding, props, layers: layers(instanceVars), variables: variables(over) });
const apply = (ops, instanceVars) => {
    const next = structuredClone(instanceVars);
    for (const op of ops) {
        const key = op.instanceId === 'i1' ? 'root' : 'label';
        if (op.value === null) delete next[key][op.prop];
        else next[key][op.prop] = op.value;
    }
    return next;
};

test('disabled on: the root fill and the label fill move to the disabled variables', () => {
    const { ops, warnings, problems } = plan({ disabled: true }, { root: { fill: 'i-bg' }, label: { fill: 'i-fg' } });
    assert.deepEqual(ops, [
        { instanceId: 'i1', prop: 'fill', value: 'i-bg-disabled' },
        { instanceId: 'il', prop: 'fill', value: 'i-fg-disabled' },
    ]);
    assert.deepEqual(warnings, []);
    assert.deepEqual(problems, []);
});

test('disabled off: the layers go back to the master\'s binding', () => {
    const start = { root: { fill: 'i-bg-disabled' }, label: { fill: 'i-fg-disabled' } };
    const { ops } = plan({ disabled: false }, start);
    assert.deepEqual(ops, [
        { instanceId: 'i1', prop: 'fill', value: 'i-bg' },
        { instanceId: 'il', prop: 'fill', value: 'i-fg' },
    ]);
});

test('applying the plan and planning again gives no operations (idempotent)', () => {
    const start = { root: { fill: 'i-bg' }, label: { fill: 'i-fg' } };
    const once = apply(plan({ disabled: true }, start).ops, start);
    assert.deepEqual(plan({ disabled: true }, once).ops, []);
    const back = apply(plan({ disabled: false }, once).ops, once);
    assert.deepEqual(back, start);
    assert.deepEqual(plan({ disabled: false }, back).ops, []);
});

test('a binding the user set by hand is never overwritten, and is reported as a warning', () => {
    const { ops, warnings } = plan({ disabled: true }, { root: { fill: 'i-card' }, label: { fill: 'i-fg' } });
    assert.deepEqual(ops, [{ instanceId: 'il', prop: 'fill', value: 'i-fg-disabled' }]);
    assert.deepEqual(warnings, [{ key: 'root', prop: 'fill', state: 'disabled', reason: 'rebound-by-hand' }]);
});

test('a layer the user rebound while disabled is off is left alone, with no warning', () => {
    const { ops, warnings } = plan({ disabled: false }, { root: { fill: 'i-card' }, label: { fill: 'i-fg' } });
    assert.deepEqual(ops, []);
    assert.deepEqual(warnings, []);
});

test('a missing state variable is an error, not a fallback to the base variable', () => {
    const { ops, problems } = plan({ disabled: true }, { root: { fill: 'i-bg' }, label: { fill: 'i-fg' } }, items.filter(i => i.name !== 'button/bg-disabled'));
    assert.deepEqual(problems, [{ key: '*', prop: 'bg', token: 'bg-disabled', reason: 'no-variable' }]);
    assert.deepEqual(ops, [{ instanceId: 'il', prop: 'fill', value: 'i-fg-disabled' }], 'the root is not changed to the base or any other variable');
});

test('a state with no bound collection for its token is an error with its reason', () => {
    const unbound = { ...binding, variables: { variant: null, size: 'c-size' } };
    const result = planStateBindings({ template: button, binding: unbound, props: { disabled: true }, layers: layers(), variables: variables() });
    assert.deepEqual(result.ops, []);
    assert.ok(result.problems.some(p => p.reason === 'dimension-unbound'));
});

test('an unbound master layer is never given a state variable it does not already show', () => {
    const noBase = [{ key: 'root', instance: { id: 'i1', vars: {} }, master: { vars: {} } }];
    const { ops } = planStateBindings({ template: button, binding, props: { disabled: true }, layers: noBase, variables: variables() });
    assert.deepEqual(ops, [{ instanceId: 'i1', prop: 'fill', value: 'i-bg-disabled' }]);
});

test('the card group is never read for Button states', () => {
    const { ops } = plan({ disabled: true }, { root: { fill: 'i-bg' }, label: { fill: 'i-fg' } }, [item('i-card-d', 'card/bg-disabled')]);
    assert.deepEqual(ops, []);
});
