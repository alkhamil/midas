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
const instanceOf = (behavior = { version: 2, props: {} }) => ({ id: 'i1', name: 'Save', isInstance: true, sourceId: 'btn', behavior });
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
    assert.deepEqual(panel.contract.persistentStates, ['disabled']);
    assert.deepEqual(panel.contract.previewStates, ['hover', 'active', 'focus']);
    assert.deepEqual(panel.contract.events.map(e => e.name), ['onClick', 'onHover', 'onFocus', 'onBlur']);
});

test('an instance shows its variable props with the bound modes, and literal props with their defaults', () => {
    const panel = instancePanel(instanceOf(), boundMaster([variant]), [variant], { variant: 'primary', size: null });
    const variantRow = rowOf(panel, 'variant');
    assert.equal(variantRow.kind, 'variable');
    assert.equal(variantRow.disabled, false);
    assert.deepEqual(variantRow.options, [{ id: 'primary', name: 'Primary' }, { id: 'danger', name: 'Danger' }]);
    assert.equal(rowOf(panel, 'label').value, 'Button');
    assert.equal(rowOf(panel, 'hasIcon').value, false);
    assert.equal(rowOf(panel, 'loading').value, false);
});

test('a variable prop whose collection is not bound is disabled with a hint', () => {
    const panel = instancePanel(instanceOf(), boundMaster([]), [], {});
    const sizeRow = rowOf(panel, 'size');
    assert.equal(sizeRow.disabled, true);
    assert.match(sizeRow.hint, /Size/);
});

test('visibleIf: the icon placement row is shown only while hasIcon is on, and a hidden value is not kept', () => {
    const master = boundMaster([variant]);
    let behavior = { version: 2, props: {} };
    assert.equal(rowOf(instancePanel(instanceOf(behavior), master, [variant], { variant: 'primary', size: null }), 'iconPlacement'), undefined);

    behavior = setInstanceValue(instanceOf(behavior), master, 'hasIcon', true);
    assert.equal(rowOf(instancePanel(instanceOf(behavior), master, [variant], { variant: 'primary', size: null }), 'iconPlacement').value, 'start');

    behavior = setInstanceValue(instanceOf(behavior), master, 'iconPlacement', 'end');
    behavior = setInstanceValue(instanceOf(behavior), master, 'hasIcon', false);
    assert.equal('iconPlacement' in behavior.props, false);
});

test('the icon is a swap row, shown while hasIcon is on, with the id of the icon it shows', () => {
    const master = boundMaster([variant]);
    const off = instancePanel(instanceOf(), master, [variant], { variant: 'primary', size: null });
    assert.equal(rowOf(off, 'icon'), undefined);
    const on = instancePanel(instanceOf(setInstanceValue(instanceOf(), master, 'hasIcon', true)), master, [variant], { variant: 'primary', size: null });
    assert.deepEqual(rowOf(on, 'icon'), { prop: 'icon', kind: 'icon', value: null });
    const chosen = instancePanel(instanceOf(setInstanceValue(instanceOf(setInstanceValue(instanceOf(), master, 'hasIcon', true)), master, 'icon', 'ic-check')), master, [variant], { variant: 'primary', size: null });
    assert.equal(rowOf(chosen, 'icon').value, 'ic-check');
});

test('writing a literal value on an instance goes to the instance store only', () => {
    const master = boundMaster([variant]);
    const before = JSON.stringify(master.behavior);
    const next = setInstanceValue(instanceOf(), master, 'label', 'Save');
    assert.equal(next.props.label, 'Save');
    assert.equal(JSON.stringify(master.behavior), before);
});

test('a variable prop is an Appearance mode: writing it on an instance is refused', () => {
    assert.throws(() => setInstanceValue(instanceOf(), boundMaster([variant]), 'variant', 'danger'), /is an Appearance mode/);
});

test('planning a collection for a variable prop binds it, and clearing it unbinds it', () => {
    const master = { id: 'btn', isInstance: false, behavior: createBinding(button, [variant]) };
    assert.equal(planCollectionChange(master, 'size', 'c-size', [variant, size]).binding.variables.size, 'c-size');
    assert.equal(planCollectionChange(master, 'size', null, [variant, size]).binding.variables.size, null);
});

test('planning a template binds the master (auto-matched); planning none unbinds it', () => {
    const bound = planTemplateChange({ id: 'btn', component: true }, [], 'button', [variant, size, theme]).binding;
    assert.equal(bound.templateId, 'button');
    assert.equal(bound.variables.variant, 'c-variant');
    assert.equal(planTemplateChange({ id: 'btn', component: true, behavior: bound }, [], null, [variant]).binding, undefined);
});

test('deleting a collection unbinds it from its masters; instance literal values stay', () => {
    const master = { id: 'btn', component: true, behavior: createBinding(button, [variant]) };
    const inst = { id: 'i1', isInstance: true, sourceId: 'btn', behavior: { version: 2, props: { label: 'Save' } } };
    forgetCollection([master, inst], 'c-variant');
    assert.equal(master.behavior.variables.variant, null);
    assert.equal(inst.behavior.props.label, 'Save');
});

test('a template change plans the unbinding and clears each instance value through the store', () => {
    const master = { id: 'btn', component: true, behavior: createBinding(button, [variant]) };
    const inst = { id: 'i1', isInstance: true, sourceId: 'btn', behavior: { version: 2, props: { variant: 'danger', label: 'Save' } } };
    const plan = planTemplateChange(master, [inst], null, [variant]);
    assert.equal(plan.changed, true);
    assert.equal(plan.binding, undefined);
    assert.deepEqual(plan.updates, [{ node: inst, behavior: undefined }]);
});

test('choosing the template the master already has plans nothing', () => {
    const master = { id: 'btn', component: true, behavior: createBinding(button, [variant]) };
    const inst = { id: 'i1', isInstance: true, sourceId: 'btn', behavior: { version: 2, props: { variant: 'danger' } } };
    assert.deepEqual(planTemplateChange(master, [inst], 'button', [variant]), { changed: false, binding: undefined, updates: [] });
});

test('a collection change plans only the binding: instance literal values and Appearance modes are untouched', () => {
    const master = { id: 'btn', component: true, behavior: createBinding(button, [variant]) };
    const replacement = { id: 'c-variant-2', name: 'Variant', modes: [{ id: 'primary', name: 'Primary' }] };
    const plan = planCollectionChange(master, 'variant', 'c-variant-2', [replacement]);
    assert.equal(plan.binding.variables.variant, 'c-variant-2');
    assert.deepEqual(plan.updates, []);
});

test('applying a plan writes the binding and nothing else', () => {
    const master = { id: 'btn', component: true, behavior: createBinding(button, [variant]) };
    const inst = { id: 'i1', isInstance: true, sourceId: 'btn', varModes: { 'c-variant': 'danger' }, behavior: { version: 2, props: { label: 'Save' } } };
    const replacement = { id: 'c-variant-2', name: 'Variant', modes: [{ id: 'primary', name: 'Primary' }] };
    applyPlan(master, planCollectionChange(master, 'variant', 'c-variant-2', [replacement]));
    assert.equal(master.behavior.variables.variant, 'c-variant-2');
    assert.deepEqual(inst.behavior, { version: 2, props: { label: 'Save' } });
    assert.deepEqual(inst.varModes, { 'c-variant': 'danger' });
});

test('a change over every page: an instance on a page that was not open is consistent after save and reopen', () => {
    const master = { id: 'btn', component: true, behavior: createBinding(button, [variant]) };
    const onPageTwo = { id: 'i2', isInstance: true, sourceId: 'btn', behavior: { version: 2, props: { label: 'Save' } } };
    const page1 = [master], page2 = [onPageTwo];
    const replacement = { id: 'c-variant-2', name: 'Variant', modes: [{ id: 'primary', name: 'Primary' }] };
    applyPlan(master, planCollectionChange(master, 'variant', 'c-variant-2', [replacement]));
    const reopened = JSON.parse(JSON.stringify({ variables: { collections: [replacement] }, pages: [{ id: 'p1', nodes: page1 }, { id: 'p2', nodes: page2 }] }));
    assert.doesNotThrow(() => assertBehaviorData(reopened));
    assert.deepEqual(reopened.pages[1].nodes[0].behavior, { version: 2, props: { label: 'Save' } });
});

test('after a library update removes a collection, the bindings to it are cleared; instance values stay', () => {
    const master = { id: 'btn', component: true, behavior: createBinding(button, [variant]) };
    const onPageTwo = { id: 'i2', isInstance: true, sourceId: 'btn', behavior: { version: 2, props: { label: 'Save' } } };
    const nodes = [master, onPageTwo];
    pruneBehaviorData(nodes, [variant]);
    assert.equal(master.behavior.variables.variant, 'c-variant');
    pruneBehaviorData(nodes, []);
    assert.equal(master.behavior.variables.variant, null);
    assert.equal(onPageTwo.behavior.props.label, 'Save');
});
