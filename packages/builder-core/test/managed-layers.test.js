import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isManagedLayer, isSlotIconInstance, managedRefusal, managedPasteRefusal } from '../src/behavior-engine/managed-layers.js';
import { behaviorProblem } from '../src/behavior-engine/document-check.js';
import { detachBehavior } from '../src/behavior-engine/data.js';

const managed = (slot, extra = {}) => ({ id: `icon-${slot}`, name: slot, type: 'frame', behavior: { version: 2, slot }, ...extra });
const plain = { id: 'label', name: 'Label', type: 'text' };
const instance = { id: 'i1', name: 'Save button', type: 'frame', isInstance: true, sourceId: 'btn', behavior: { version: 2, props: { hasIcon: true } } };

test('a managed layer is a layer with a slot marker; instances and plain layers are not', () => {
    assert.equal(isManagedLayer(managed('iconStart')), true);
    assert.equal(isManagedLayer(instance), false);
    assert.equal(isManagedLayer(plain), false);
});

test('no managed layer in the selection: the action is allowed', () => {
    assert.equal(managedRefusal('delete', [plain, instance]), null);
});

test('a managed layer refuses each action on its own, naming the layer and the action', () => {
    const actions = ['delete', 'copy', 'duplicate', 'reorder', 'move', 'group', 'align', 'boolean', 'flatten', 'replace'];
    for (const action of actions) {
        const message = managedRefusal(action, [managed('iconStart')]);
        assert.ok(message, action);
        assert.match(message, /"iconStart"/, action);
        assert.match(message, /managed by its instance/, action);
    }
});

test('a selection that mixes a managed layer with others is refused as a whole, naming the managed layer', () => {
    assert.match(managedRefusal('delete', [plain, managed('iconEnd')]), /"iconEnd"/);
});

test('a valid document has no behavior problem', () => {
    const doc = { variables: { collections: [] }, pages: [{ id: 'p', nodes: [{ id: 'btn', name: 'Button', type: 'frame', layout: 'horizontal', behavior: { version: 2, templateId: 'button', variables: { variant: null, size: null } } }, { id: 'btn-label', name: 'Label', type: 'text', parentId: 'btn' }, instance, managed('iconStart', { parentId: 'i1' }), { id: 'i1-label', name: 'Label', type: 'text', parentId: 'i1' }] }] };
    assert.equal(behaviorProblem(doc), null);
});

test('a managed layer outside its instance is reported with the layer name and the reason', () => {
    const doc = { pages: [{ id: 'p', nodes: [{ id: 'frame', name: 'Frame', type: 'frame' }, managed('iconStart', { parentId: 'frame' })] }] };
    assert.deepEqual(behaviorProblem(doc), { name: 'iconStart', problem: 'a managed layer sits outside an instance' });
});

test('a round trip through JSON keeps a valid document valid', () => {
    const doc = { pages: [{ id: 'p', nodes: [plain, { id: 'frame', name: 'Frame', type: 'frame' }] }] };
    assert.equal(behaviorProblem(JSON.parse(JSON.stringify(doc))), null);
});

test('detaching an instance leaves no behavior data or managed marker in its tree', () => {
    const tree = [structuredClone(instance), managed('iconStart', { parentId: 'i1' }), { id: 'i1-label', name: 'Label', type: 'text', parentId: 'i1' }];
    detachBehavior(tree);
    assert.equal(tree.some(n => 'behavior' in n), false);
});

test('a payload with a managed layer but not its instance is refused, naming the layer', () => {
    const layer = { id: 'l1', parentId: 'i1', behavior: { version: 2, slot: 'iconStart' } };
    assert.match(managedPasteRefusal([layer]), /"iconStart" is managed by its instance: pasting it without that instance is not allowed\./);
});

test('a payload with the instance and its managed layers is allowed', () => {
    const instance = { id: 'i1', parentId: null, isInstance: true, behavior: { version: 2, props: { hasIcon: true } } };
    const layer = { id: 'l1', parentId: 'i1', behavior: { version: 2, slot: 'iconStart' } };
    assert.equal(managedPasteRefusal([instance, layer]), null);
});

test('a payload of plain layers is allowed', () => {
    assert.equal(managedPasteRefusal([{ id: 'a', parentId: null }, { id: 'b', parentId: 'a' }]), null);
});

test('only the icon instance a managed slot holds is engine-sized', () => {
    const slot = { behavior: { version: 2, slot: 'iconStart' } };
    const nested = { isInstance: true, sourceId: 'icon-check' };
    assert.equal(isSlotIconInstance(nested, slot), true);
    assert.equal(isSlotIconInstance({ type: 'path' }, slot), false);
    assert.equal(isSlotIconInstance({ type: 'frame' }, slot), false);
    assert.equal(isSlotIconInstance(nested, { type: 'frame' }), false);
    assert.equal(isSlotIconInstance(nested, null), false);
    assert.equal(isSlotIconInstance(null, slot), false);
});
