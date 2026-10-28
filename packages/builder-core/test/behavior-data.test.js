import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertBehaviorShape, BehaviorDataError } from '../src/behavior-engine/data.js';

const master = (behavior, extra = {}) => ({ id: 'btn', name: 'Button', type: 'frame', isInstance: false, behavior, ...extra });
const instance = (behavior, extra = {}) => ({ id: 'i1', name: 'Button', type: 'frame', isInstance: true, behavior, ...extra });
const docWith = (...nodes) => ({ pages: [{ id: 'p1', nodes }] });
const validMaster = { version: 2, templateId: 'button', variables: { variant: 'c-variant', size: null } };

test('a file without behavior data opens normally, even with components in it', () => {
    assert.doesNotThrow(() => assertBehaviorShape(docWith({ id: 'a', name: 'Card', type: 'frame', children: [{ id: 'b', type: 'text' }] })));
});

test('valid master and instance behavior data is accepted', () => {
    const doc = docWith({ id: 'root', type: 'frame' }, master(validMaster), instance({ version: 2, props: { label: 'Save', hasIcon: true } }));
    assert.doesNotThrow(() => assertBehaviorShape(doc));
});

test('master variables must name variable props of its template', () => {
    const doc = docWith(master({ ...validMaster, variables: { shape: 'c-variant' } }));
    assert.throws(() => assertBehaviorShape(doc), /"shape" is not a variable prop of button/);
});

test('behavior version 1 fails with an explicit error naming the node', () => {
    const doc = docWith(master({ ...validMaster, version: 1 }));
    assert.throws(() => assertBehaviorShape(doc), err => err instanceof BehaviorDataError && /"Button" \(btn\)/.test(err.message) && /version 1/.test(err.message));
});

test('an unknown key in behavior data fails; nothing is repaired or partially loaded', () => {
    const doc = docWith(master({ ...validMaster, interactions: [] }));
    assert.throws(() => assertBehaviorShape(doc), BehaviorDataError);
});

test('master data for an unknown template fails', () => {
    const doc = docWith(master({ ...validMaster, templateId: 'card' }));
    assert.throws(() => assertBehaviorShape(doc), /unknown template "card"/);
});

test('instance data on a node that is not an instance, and master data on an instance, both fail', () => {
    assert.throws(() => assertBehaviorShape(docWith(master({ version: 2, props: {} }))), BehaviorDataError);
    assert.throws(() => assertBehaviorShape(docWith(instance(validMaster))), BehaviorDataError);
});

test('a managed layer carries its slot name under behavior, and is accepted', () => {
    const doc = docWith({ id: 'icon', name: 'iconStart', type: 'frame', behavior: { version: 2, slot: 'iconStart' } });
    assert.doesNotThrow(() => assertBehaviorShape(doc));
});

test('a managed layer that is an instance fails', () => {
    const doc = docWith({ id: 'icon', name: 'iconStart', type: 'frame', isInstance: true, behavior: { version: 2, slot: 'iconStart' } });
    assert.throws(() => assertBehaviorShape(doc), /"iconStart" \(icon\)/);
});

test('a managed layer slot must be a slot name', () => {
    const doc = docWith({ id: 'icon', name: 'x', type: 'frame', behavior: { version: 2, slot: 3 } });
    assert.throws(() => assertBehaviorShape(doc), /slot must name a managed slot/);
});
