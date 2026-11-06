// A managed text layer exists on instances only, so the master has no layer to carry its token bindings (docs/input-managed-text.md, step 5):
// the instance's layer is bound to the template's token variables directly (fill, typography), and to the state's variable while a persistent
// state is on (disabled -> fg-disabled), as the master's label is. A binding a designer set by hand is left alone; running again changes nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUTTON } from '../src/templates/button.js';
import { planManagedTextBindings, applyBindTokens } from '../src/behavior-engine/bind-tokens.js';
import { buttonModel } from '../../../scripts/button-model.mjs';

const model = buttonModel({ colors: ['primary'], variantModes: ['solid'] });
const variables = { collections: model.collections, items: model.items };
const binding = model.binding;

/** Button plus a managed text slot `note`: its fill is `fg` (`fg-disabled` while disabled) and its type is the label's. */
const TEMPLATE = (() => {
    const t = structuredClone(BUTTON);
    t.anatomy.push({ id: 'note', kind: 'text', optional: true, managed: true, typography: 'label', shownWhen: { prop: 'note', empty: false } });
    t.props.note = { source: 'literal', type: 'string', default: '', node: { key: 'note', field: 'text' } };
    t.display.note = { fill: 'fg', typography: 'labelTypography' };
    return t;
})();
const itemNamed = name => variables.items.find(i => i.name === name && i.collectionId === binding.variables.variant) ?? variables.items.find(i => i.name === name);
const plan = (node, props = {}) => planManagedTextBindings({ template: TEMPLATE, binding, props, layers: [{ key: 'note', node }], variables });
const run = (node, props) => { const { ops } = plan(node, props); applyBindTokens([{ key: 'note', node }], ops); return ops; };
const bound = node => ({ fill: node.vars?.['fills.0'], font: node.vars?.typography });

test('a managed text layer is bound to the fill and typography variables of its tokens', () => {
    const node = { id: 'n', type: 'text', name: 'note' };
    const { ops, problems } = plan(node);
    assert.deepEqual(problems, []);
    const fill = ops.find(o => o.varKey === 'fills.0');
    assert.equal(fill.itemId, itemNamed('fg').id);
    assert.ok(ops.some(o => o.varKey === 'typography'), 'typography binds as it does on the master label');
    run(node);
    assert.deepEqual(plan(node).ops, [], 'idempotent');
});

test('while a persistent state is on the fill binds the state variable, and goes back when it is off', () => {
    const node = { id: 'n', type: 'text', name: 'note' };
    run(node, { disabled: true });
    assert.equal(bound(node).fill, itemNamed('fg-disabled').id);
    assert.deepEqual(plan(node, { disabled: true }).ops, []);
    run(node, { disabled: false });
    assert.equal(bound(node).fill, itemNamed('fg').id);
});

test('a binding the designer set by hand is left alone, in either state', () => {
    const node = { id: 'n', type: 'text', name: 'note', vars: { 'fills.0': 'some-other-variable-that-exists' } };
    const items = [...variables.items, { id: 'some-other-variable-that-exists', collectionId: 'c', name: 'mine', type: 'color', values: {} }];
    const withHand = props => planManagedTextBindings({ template: TEMPLATE, binding, props, layers: [{ key: 'note', node }], variables: { ...variables, items } }).ops;
    assert.ok(!withHand({}).some(o => o.varKey === 'fills.0'));
    assert.ok(!withHand({ disabled: true }).some(o => o.varKey === 'fills.0'));
});

test('a stale binding is rebound, and a layer of a slot the template does not map is untouched', () => {
    const node = { id: 'n', type: 'text', name: 'note', vars: { 'fills.0': 'deleted-variable' } };
    assert.equal(plan(node).ops.find(o => o.varKey === 'fills.0').itemId, itemNamed('fg').id);
    const other = planManagedTextBindings({ template: TEMPLATE, binding, props: {}, layers: [{ key: 'nothing', node: { id: 'x', type: 'text' } }], variables });
    assert.deepEqual(other.ops, []);
});

test('an unbound dimension is a problem, not a guess', () => {
    const { ops, problems } = planManagedTextBindings({ template: TEMPLATE, binding: { variables: { ...binding.variables, size: null } }, props: {}, layers: [{ key: 'note', node: { id: 'n', type: 'text' } }], variables });
    assert.ok(problems.some(p => p.reason === 'dimension-unbound'));
    assert.ok(!ops.some(o => o.varKey === 'typography'));
});
