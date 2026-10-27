import { test } from 'node:test';
import assert from 'node:assert/strict';
import { masterPanel, instancePanel, setInstanceValue, forgetCollection, planTemplateChange, planCollectionChange, applyPlan, pruneBehaviorData } from '../src/behavior-engine/panel.js';
import { createBinding } from '../src/behavior-engine/binding.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { assertBehaviorData } from '../src/behavior-engine/document-check.js';

const button = TEMPLATES.get('button');
const variant = { id: 'c-variant', name: 'Variant', modes: [{ id: 'primary', name: 'Primary' }, { id: 'danger', name: 'Danger' }] };
const size = { id: 'c-size', name: 'Size', modes: [{ id: 'sm', name: 'Small' }, { id: 'lg', name: 'Large' }] };
const theme = { id: 'c-theme', name: 'Theme', modes: [{ id: 'light', name: 'Light' }] };

const boundMaster = collections => ({ id: 'btn', name: 'Button', isInstance: false, behavior: createBinding(button, collections) });
const instanceOf = (behavior = { version: 1, props: {} }) => ({ id: 'i1', name: 'Save', isInstance: true, sourceId: 'btn', behavior });
const rowOf = (panel, prop) => panel.rows.find(r => r.prop === prop);

test('an unbound master shows no template and no rows, and the template list to pick from', () => {
    const panel = masterPanel({ id: 'btn', isInstance: false }, [variant, size]);
    assert.equal(panel.templateId, null);
    assert.deepEqual(panel.rows, []);
    assert.deepEqual(panel.templates, [{ id: 'button', name: 'Button' }]);
});

test('a master bound to Button lists its variable props, prefilled by auto-match (hit and miss)', () => {
    const panel = masterPanel(boundMaster([variant]), [variant]);
    assert.equal(panel.templateId, 'button');
    assert.equal(rowOf(panel, 'variant').collection, 'Variant');
    assert.equal(rowOf(panel, 'variant').collectionId, 'c-variant');
    assert.equal(rowOf(panel, 'variant').matched, true);
    assert.equal(rowOf(panel, 'size').collectionId, null);
    assert.equal(rowOf(panel, 'size').matched, false);
});

test('the master contract shows non-visual props, states and events, but no icon choice or placement', () => {
    const panel = masterPanel(boundMaster([variant]), [variant]);
    const names = panel.contract.props.map(p => p.name);
    assert.deepEqual(names, ['label', 'loading', 'disabled', 'fullWidth']);
    assert.deepEqual(panel.contract.states, ['default', 'hover', 'active', 'focus', 'disabled', 'loading']);
    assert.deepEqual(panel.contract.events.map(e => e.name), ['onClick', 'onHover', 'onFocus', 'onBlur']);
});

test('an instance shows its variable props with the bound modes, and literal props with their defaults', () => {
    const panel = instancePanel(instanceOf(), boundMaster([variant]), [variant]);
    const variantRow = rowOf(panel, 'variant');
    assert.equal(variantRow.kind, 'variable');
    assert.equal(variantRow.disabled, false);
    assert.deepEqual(variantRow.options, [{ id: 'primary', name: 'Primary' }, { id: 'danger', name: 'Danger' }]);
    assert.equal(rowOf(panel, 'label').value, 'Button');
    assert.equal(rowOf(panel, 'hasIcon').value, false);
    assert.equal(rowOf(panel, 'loading').value, false);
});

test('a variable prop whose collection is not bound is disabled with a hint', () => {
    const panel = instancePanel(instanceOf(), boundMaster([]), []);
    const sizeRow = rowOf(panel, 'size');
    assert.equal(sizeRow.disabled, true);
    assert.match(sizeRow.hint, /Size/);
});

test('visibleIf: the icon placement row is shown only while hasIcon is on, and a hidden value is not kept', () => {
    const master = boundMaster([variant]);
    let behavior = { version: 1, props: {} };
    assert.equal(rowOf(instancePanel(instanceOf(behavior), master, [variant]), 'iconPlacement'), undefined);

    behavior = setInstanceValue(instanceOf(behavior), master, [variant], 'hasIcon', true);
    assert.equal(rowOf(instancePanel(instanceOf(behavior), master, [variant]), 'iconPlacement').value, 'start');

    behavior = setInstanceValue(instanceOf(behavior), master, [variant], 'iconPlacement', 'end');
    behavior = setInstanceValue(instanceOf(behavior), master, [variant], 'hasIcon', false);
    assert.equal('iconPlacement' in behavior.props, false);
});

test('an icon control is not rendered yet (the icon picker is a later stage)', () => {
    const panel = instancePanel(instanceOf(), boundMaster([variant]), [variant]);
    assert.equal(rowOf(panel, 'icon'), undefined);
    assert.deepEqual(panel.deferred, ['icon']);
});

test('writing a value on an instance goes to the instance store only', () => {
    const master = boundMaster([variant]);
    const before = JSON.stringify(master.behavior);
    const next = setInstanceValue(instanceOf(), master, [variant], 'variant', 'danger');
    assert.equal(next.props.variant, 'danger');
    assert.equal(JSON.stringify(master.behavior), before);
});

test('a mode the bound collection does not have is refused', () => {
    assert.throws(() => setInstanceValue(instanceOf(), boundMaster([variant]), [variant], 'variant', 'nope'), /not a mode of the bound collection/);
});

test('planning a collection for a variable prop binds it, and clearing it unbinds it', () => {
    const master = { id: 'btn', isInstance: false, behavior: createBinding(button, [variant]) };
    assert.equal(planCollectionChange(master, [], 'size', 'c-size', [variant, size]).binding.variables.size, 'c-size');
    assert.equal(planCollectionChange(master, [], 'size', null, [variant, size]).binding.variables.size, null);
});

test('planning a template binds the master (auto-matched); planning none unbinds it', () => {
    const bound = planTemplateChange({ id: 'btn', component: true }, [], 'button', [variant, size, theme]).binding;
    assert.equal(bound.templateId, 'button');
    assert.equal(bound.variables.variant, 'c-variant');
    assert.equal(planTemplateChange({ id: 'btn', component: true, behavior: bound }, [], null, [variant]).binding, undefined);
});

test('deleting a collection unbinds it from its masters and clears the instance values that used it', () => {
    const master = { id: 'btn', component: true, behavior: createBinding(button, [variant]) };
    const inst = { id: 'i1', isInstance: true, sourceId: 'btn', behavior: { version: 1, props: { variant: 'danger', label: 'Save' } } };
    forgetCollection([master, inst], 'c-variant');
    assert.equal(master.behavior.variables.variant, null);
    assert.equal('variant' in inst.behavior.props, false);
    assert.equal(inst.behavior.props.label, 'Save');
});

test('deleting one mode clears only the instance values that picked it, and keeps the binding', () => {
    const master = { id: 'btn', component: true, behavior: createBinding(button, [variant]) };
    const picked = { id: 'i1', isInstance: true, sourceId: 'btn', behavior: { version: 1, props: { variant: 'danger' } } };
    const other = { id: 'i2', isInstance: true, sourceId: 'btn', behavior: { version: 1, props: { variant: 'primary' } } };
    forgetCollection([master, picked, other], 'c-variant', 'danger');
    assert.equal(picked.behavior, undefined, 'nothing left on the instance');
    assert.equal(other.behavior.props.variant, 'primary');
    assert.equal(master.behavior.variables.variant, 'c-variant');
});

test('a template change plans the unbinding and clears each instance value through the store', () => {
    const master = { id: 'btn', component: true, behavior: createBinding(button, [variant]) };
    const inst = { id: 'i1', isInstance: true, sourceId: 'btn', behavior: { version: 1, props: { variant: 'danger', label: 'Save' } } };
    const plan = planTemplateChange(master, [inst], null, [variant]);
    assert.equal(plan.changed, true);
    assert.equal(plan.binding, undefined);
    assert.deepEqual(plan.updates, [{ node: inst, behavior: undefined }]);
});

test('choosing the template the master already has plans nothing', () => {
    const master = { id: 'btn', component: true, behavior: createBinding(button, [variant]) };
    const inst = { id: 'i1', isInstance: true, sourceId: 'btn', behavior: { version: 1, props: { variant: 'danger' } } };
    assert.deepEqual(planTemplateChange(master, [inst], 'button', [variant]), { changed: false, binding: undefined, updates: [] });
});

test('a collection change plans the binding and clears only the modes the new collection does not have', () => {
    const master = { id: 'btn', component: true, behavior: createBinding(button, [variant]) };
    const inst = { id: 'i1', isInstance: true, sourceId: 'btn', behavior: { version: 1, props: { variant: 'danger', label: 'Save' } } };
    const replacement = { id: 'c-variant-2', name: 'Variant', modes: [{ id: 'primary', name: 'Primary' }] };
    const plan = planCollectionChange(master, [inst], 'variant', 'c-variant-2', [replacement]);
    assert.equal(plan.binding.variables.variant, 'c-variant-2');
    assert.deepEqual(plan.updates, [{ node: inst, behavior: { version: 1, props: { label: 'Save' } } }]);

    const kept = { id: 'c-variant-3', name: 'Variant', modes: [{ id: 'danger', name: 'Danger' }] };
    assert.deepEqual(planCollectionChange(master, [inst], 'variant', 'c-variant-3', [kept]).updates, []);
});

test('applying a plan writes the binding and the instance values; nothing else', () => {
    const master = { id: 'btn', component: true, behavior: createBinding(button, [variant]) };
    const inst = { id: 'i1', isInstance: true, sourceId: 'btn', behavior: { version: 1, props: { variant: 'danger', label: 'Save' } } };
    const replacement = { id: 'c-variant-2', name: 'Variant', modes: [{ id: 'primary', name: 'Primary' }] };
    applyPlan(master, planCollectionChange(master, [inst], 'variant', 'c-variant-2', [replacement]));
    assert.equal(master.behavior.variables.variant, 'c-variant-2');
    assert.deepEqual(inst.behavior, { version: 1, props: { label: 'Save' } });
});

test('a change over every page: an instance on a page that was not open is consistent after save and reopen', () => {
    const master = { id: 'btn', component: true, behavior: createBinding(button, [variant]) };
    const onPageTwo = { id: 'i2', isInstance: true, sourceId: 'btn', behavior: { version: 1, props: { variant: 'danger' } } };
    const page1 = [master], page2 = [onPageTwo];
    const replacement = { id: 'c-variant-2', name: 'Variant', modes: [{ id: 'primary', name: 'Primary' }] };
    const everyNode = [...page1, ...page2];
    applyPlan(master, planCollectionChange(master, everyNode.filter(n => n.sourceId === 'btn'), 'variant', 'c-variant-2', [replacement]));
    const reopened = JSON.parse(JSON.stringify({ variables: { collections: [replacement] }, pages: [{ id: 'p1', nodes: page1 }, { id: 'p2', nodes: page2 }] }));
    assert.doesNotThrow(() => assertBehaviorData(reopened));
    assert.equal(reopened.pages[1].nodes[0].behavior, undefined);
});

test('after a library update removes a mode or a collection, the bindings and instance values that named it are cleared', () => {
    const master = { id: 'btn', component: true, behavior: createBinding(button, [variant]) };
    const onPageTwo = { id: 'i2', isInstance: true, sourceId: 'btn', behavior: { version: 1, props: { variant: 'danger', label: 'Save' } } };
    const nodes = [master, onPageTwo];
    pruneBehaviorData(nodes, [{ ...variant, modes: [{ id: 'primary', name: 'Primary' }] }]);
    assert.equal('variant' in onPageTwo.behavior.props, false);
    assert.equal(onPageTwo.behavior.props.label, 'Save');
    assert.equal(master.behavior.variables.variant, 'c-variant');
    pruneBehaviorData(nodes, []);
    assert.equal(master.behavior.variables.variant, null);
    assert.equal(onPageTwo.behavior.props.label, 'Save');
});
