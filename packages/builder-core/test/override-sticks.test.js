// A user override of a managed layer's property (a detach or a raw value) sticks: no sync, state change or variant change binds it again, and Reset gives the template's binding back.
// The engine remembers the keys it bound on a layer (`engineBound`); a key it bound that is now gone from `vars` was detached by the user, and a bound key that is not the engine's is theirs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { planManagedTextBindings, planBindTokens, applyBindTokens } from '../src/behavior-engine/bind-tokens.js';
import { planStateBindings } from '../src/behavior-engine/state-bindings.js';
import { overriddenKeysOf, resetOverride } from '../src/behavior-engine/overrides.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const checkbox = TEMPLATES.get('checkbox');
const model = modelFor(checkbox);

/** One sync of an instance's managed text layers: the plan, applied. Returns the ops it made. */
function sync(nodes, props = {}, variables = model.variables) {
    const layers = nodes.filter(n => n.type === 'text' && n.behavior?.slot).map(node => ({ key: node.behavior.slot, node }));
    const { ops } = planManagedTextBindings({ template: checkbox, binding: model.binding, props: resolveProps(checkbox, props), layers, variables });
    applyBindTokens(layers, ops);
    return ops;
}
const fresh = (props = {}) => {
    const nodes = instanceFor(model, props);
    sync(nodes, props);
    return { nodes, label: nodes.find(n => n.behavior?.slot === 'label') };
};
const detach = (node, key) => { delete node.vars[key]; };

test('the engine remembers the keys it bound on a layer', () => {
    const { label } = fresh();
    assert.ok(label.vars['fills.0'] && label.vars.typography);
    assert.ok(label.engineBound.includes('fills.0') && label.engineBound.includes('typography'));
    assert.deepEqual(overriddenKeysOf(label), []);
});

test('a detached colour is an override: a sync does not bind it again, the other bindings stay', () => {
    const { nodes, label } = fresh();
    detach(label, 'fills.0');
    label.fills = [{ type: 'solid', color: '#ff0000', opacity: 1, visible: true }];
    assert.deepEqual(overriddenKeysOf(label), ['fills.0']);
    assert.deepEqual(sync(nodes), [], 'nothing to rebind');
    assert.equal(label.vars['fills.0'], undefined);
    assert.equal(label.fills[0].color, '#ff0000');
    assert.ok(label.vars.typography, 'the property that was not overridden keeps following the template');
});

test('a detached typography survives a sync too', () => {
    const { nodes, label } = fresh();
    detach(label, 'typography');
    label.fontSize = 23;
    assert.deepEqual(sync(nodes), []);
    assert.equal(label.vars.typography, undefined);
    assert.equal(label.fontSize, 23);
});

test('a state change (disabled) does not rebind an overridden colour, and still swaps the one that is not', () => {
    const { nodes, label } = fresh();
    detach(label, 'fills.0');
    const ops = sync(nodes, { disabled: true });
    assert.equal(ops.some(o => o.varKey === 'fills.0'), false);
    assert.equal(label.vars['fills.0'], undefined);
    // a layer with no override follows the state
    const other = fresh();
    sync(other.nodes, { disabled: true });
    assert.notEqual(other.label.vars['fills.0'], fresh().label.vars['fills.0']);
});

test('a variant (mode) change on the instance does not bind an overridden property again', () => {
    const { nodes, label } = fresh();
    detach(label, 'fills.0');
    nodes[0].varModes = { ...(nodes[0].varModes ?? {}), [model.binding.variables.color]: model.variables.collections.find(c => c.id === model.binding.variables.color)?.modes.at(-1)?.id };
    assert.deepEqual(sync(nodes), []);
    assert.equal(label.vars['fills.0'], undefined);
});

test('a variable the user bound by hand is theirs: a sync keeps it', () => {
    const { nodes, label } = fresh();
    const other = model.variables.items.find(i => i.type === 'color' && i.id !== label.vars['fills.0']);
    label.vars['fills.0'] = other.id;
    assert.deepEqual(sync(nodes), []);
    assert.equal(label.vars['fills.0'], other.id);
});

test('Reset gives the property back to the template: the next sync binds the template variable again', () => {
    const { nodes, label } = fresh();
    const template = label.vars['fills.0'];
    detach(label, 'fills.0');
    sync(nodes);
    resetOverride(label, 'fills.0');
    assert.deepEqual(overriddenKeysOf(label), []);
    assert.equal(sync(nodes).some(o => o.varKey === 'fills.0'), true);
    assert.equal(label.vars['fills.0'], template);
});

test('Reset of a variable bound by hand drops it, and the template binds its own', () => {
    const { nodes, label } = fresh();
    const template = label.vars['fills.0'];
    label.vars['fills.0'] = model.variables.items.find(i => i.type === 'color' && i.id !== template).id;
    resetOverride(label, 'fills.0');
    sync(nodes);
    assert.equal(label.vars['fills.0'], template);
});

test('a master layer the user detached is not bound again by the bind plan', () => {
    const box = model.created.find(n => n.behavior?.group === 'box');
    const layers = [{ key: 'box', node: box }];
    const before = box.vars.stroke;
    assert.ok(before && box.engineBound.includes('stroke'));
    detach(box, 'stroke');
    const { ops } = planBindTokens({ template: checkbox, binding: model.binding, layers, variables: model.variables });
    assert.equal(ops.some(o => o.varKey === 'stroke'), false);
    resetOverride(box, 'stroke');
    const again = planBindTokens({ template: checkbox, binding: model.binding, layers, variables: model.variables });
    assert.equal(again.ops.some(o => o.varKey === 'stroke'), true);
    box.vars.stroke = before;
});

test('the state plan leaves an instance layer the user detached alone while the state is on', () => {
    const [root] = instanceFor(model, {});
    const masterBox = model.created.find(n => n.behavior?.group === 'box');
    const box = { id: 'ib', vars: { ...masterBox.vars } };
    delete box.vars.stroke;
    const plan = planStateBindings({ template: checkbox, binding: model.binding, props: resolveProps(checkbox, { checked: true }), layers: [{ key: 'box', instance: box, master: masterBox }], variables: model.variables });
    assert.equal(plan.ops.some(o => o.prop === 'stroke'), false);
    assert.ok(root);
});
