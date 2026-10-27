import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertBehaviorData } from '../src/behavior-engine/document-check.js';
import { BehaviorDataError, detachBehavior } from '../src/behavior-engine/data.js';

const collections = [{ id: 'c-variant', name: 'Variant', modes: [{ id: 'primary', name: 'Primary' }, { id: 'danger', name: 'Danger' }] }];
const master = { id: 'btn', name: 'Button', type: 'frame', isInstance: false, behavior: { version: 1, templateId: 'button', variables: { variant: 'c-variant', size: null } } };
const instance = props => ({ id: 'i1', name: 'Save button', type: 'frame', isInstance: true, sourceId: 'btn', behavior: { version: 1, props } });
const docWith = (...nodes) => ({ variables: { collections }, pages: [{ id: 'p1', nodes }] });

test('a valid file with a bound master and a matching instance opens', () => {
    const doc = docWith(master, instance({ variant: 'danger', label: 'Save', hasIcon: true, iconPlacement: 'end' }));
    assert.doesNotThrow(() => assertBehaviorData(doc));
});

test('a file with no behavior data opens normally', () => {
    assert.doesNotThrow(() => assertBehaviorData(docWith({ id: 'a', name: 'Card', type: 'frame' })));
});

test('an instance prop that the template does not have fails, naming the node and the prop', () => {
    const doc = docWith(master, instance({ shape: 'round' }));
    assert.throws(() => assertBehaviorData(doc), err => err instanceof BehaviorDataError && /"Save button" \(i1\)/.test(err.message) && /prop "shape" is not a prop of button/.test(err.message));
});

test('an instance prop with the wrong type fails, naming the prop', () => {
    const doc = docWith(master, instance({ hasIcon: 'yes' }));
    assert.throws(() => assertBehaviorData(doc), /prop "hasIcon": expects a boolean/);
});

test('a stored value for a prop hidden by visibleIf fails, naming the prop', () => {
    const doc = docWith(master, instance({ hasIcon: false, iconPlacement: 'end' }));
    assert.throws(() => assertBehaviorData(doc), /"iconPlacement" is hidden by its visibleIf but holds a value/);
});

test('a mode that the bound collection does not have fails, naming the mode and the collection', () => {
    const doc = docWith(master, instance({ variant: 'nope' }));
    assert.throws(() => assertBehaviorData(doc), /mode "nope" is not in collection "Variant"/);
});

// Anatomy (stage 6): the instance's managed layers match its values. The master has an auto layout root with a text layer.
const autoMaster = { ...master, layout: 'horizontal' };
const masterLabel = { id: 'mLabel', name: 'Label', type: 'text', parentId: 'btn' };
const label = { id: 'label', name: 'Label', type: 'text', parentId: 'i1' };
const icon = (slot, parentId = 'i1', id = `icon-${slot}`) => ({ id, name: slot, type: 'frame', parentId, behavior: { version: 1, slot } });
const withIcon = props => instance(props);

test('an instance whose managed layers match its values opens', () => {
    const doc = docWith(autoMaster, masterLabel, withIcon({ variant: 'danger', hasIcon: true, iconPlacement: 'end' }), label, icon('iconEnd'));
    assert.doesNotThrow(() => assertBehaviorData(doc));
});

test('a managed layer outside an instance fails, naming the layer', () => {
    const doc = docWith(autoMaster, masterLabel, withIcon({ hasIcon: false }), label, { id: 'stray', name: 'iconStart', type: 'frame', parentId: 'other', behavior: { version: 1, slot: 'iconStart' } });
    assert.throws(() => assertBehaviorData(doc), err => err instanceof BehaviorDataError && /"iconStart" \(stray\)/.test(err.message) && /outside an instance/.test(err.message));
});

test('a missing managed layer fails, naming the instance', () => {
    const doc = docWith(autoMaster, masterLabel, withIcon({ hasIcon: true, iconPlacement: 'start' }), label);
    assert.throws(() => assertBehaviorData(doc), err => err instanceof BehaviorDataError && /"Save button" \(i1\)/.test(err.message) && /"iconStart" is missing/.test(err.message));
});

test('a managed layer at the wrong position fails, naming the slot', () => {
    const doc = docWith(autoMaster, masterLabel, withIcon({ hasIcon: true, iconPlacement: 'start' }), label, icon('iconStart'));
    assert.throws(() => assertBehaviorData(doc), /"iconStart" is at the wrong position/);
});

test('a managed layer that the values do not ask for fails', () => {
    const doc = docWith(autoMaster, masterLabel, withIcon({ hasIcon: false }), label, icon('iconStart'));
    assert.throws(() => assertBehaviorData(doc), /"iconStart" is not expected for these values/);
});

test('a master with no text layer: the instance still opens, and sync does nothing', () => {
    const doc = docWith(autoMaster, withIcon({ hasIcon: true, iconPlacement: 'start' }), label);
    assert.doesNotThrow(() => assertBehaviorData(doc));
});

test('a detached instance opens: its behavior data and managed markers are stripped', () => {
    const nodes = [{ ...withIcon({ hasIcon: true, iconPlacement: 'end' }), isInstance: false }, label, icon('iconEnd')];
    detachBehavior(nodes);
    assert.doesNotThrow(() => assertBehaviorData(docWith(autoMaster, masterLabel, ...nodes)));
});
