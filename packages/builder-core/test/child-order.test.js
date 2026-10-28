import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderChildren } from '../src/behavior-engine/child-order.js';
import { planInstanceAnatomy } from '../src/behavior-engine/anatomy.js';
import { behaviorProblem } from '../src/behavior-engine/document-check.js';

const isManaged = n => n.slot !== null && n.slot !== undefined;
const rankOf = ranks => n => ranks[n.id];
const ids = list => list.map(n => n.id);

test('ordering children by rank moves non-managed children only; a managed child keeps its index', () => {
    const kids = [{ id: 'a', slot: null }, { id: 'icon', slot: 'iconStart' }, { id: 'b', slot: null }];
    const out = orderChildren(kids, rankOf({ a: 2, b: 1 }), isManaged);
    assert.deepEqual(ids(out), ['b', 'icon', 'a']);
});

test('a managed child at the front stays at the front when the children behind it are reordered', () => {
    const kids = [{ id: 'icon', slot: 'iconStart' }, { id: 'a', slot: null }, { id: 'b', slot: null }];
    const out = orderChildren(kids, rankOf({ a: 2, b: 1 }), isManaged);
    assert.deepEqual(ids(out), ['icon', 'b', 'a']);
});

test('without managed children, ordering is the plain sort by rank', () => {
    const kids = [{ id: 'a', slot: null }, { id: 'b', slot: null }, { id: 'c', slot: null }];
    assert.deepEqual(ids(orderChildren(kids, rankOf({ a: 3, b: 1, c: 2 }), isManaged)), ['b', 'c', 'a']);
});

// The main component reorders its children, and the instance syncs: anatomy's placement must still hold.
test('after the non-managed children are re-ordered, the leading icon is still in its planned place (no plan)', () => {
    const binding = { version: 1, templateId: 'button', variables: { variant: null, size: null } };
    const masterRoot = { isAutoLayout: true };
    const masterTree = [{ id: 'mLabel', type: 'text' }];
    const kids = [{ id: 'icon', slot: 'iconStart' }, { id: 'a', slot: null }, { id: 'b', slot: null }];
    const reordered = orderChildren(kids, rankOf({ a: 2, b: 1 }), isManaged);
    const { ops } = planInstanceAnatomy({ binding, masterRoot, masterTree, stored: { hasIcon: true, iconPlacement: 'start' }, children: reordered });
    assert.deepEqual(ops, []);
});

// A naive sort (managed layers ranked last) puts the icon behind the label: the backstop must see that and refuse.
const master = { id: 'btn', name: 'Button', type: 'frame', layout: 'horizontal', behavior: { version: 1, templateId: 'button', variables: { variant: null, size: null } } };
const instanceDoc = nodes => ({ pages: [{ id: 'p', nodes: [master, { id: 'mLabel', name: 'Label', type: 'text', parentId: 'btn' }, { id: 'i1', name: 'Save', type: 'frame', isInstance: true, sourceId: 'btn', behavior: { version: 1, props: { hasIcon: true, iconPlacement: 'start' } } }, ...nodes] }] });

test('the backstop sees a misplaced managed layer that a naive sort leaves behind', () => {
    const naive = [{ id: 'label', name: 'Label', type: 'text', parentId: 'i1' }, { id: 'icon', name: 'iconStart', type: 'frame', parentId: 'i1', behavior: { version: 1, slot: 'iconStart' } }];
    assert.deepEqual(behaviorProblem(instanceDoc(naive)), { name: 'Save', problem: 'managed layer "iconStart" is at the wrong position' });
});

test('a leading icon before the label survives save and load', () => {
    const doc = instanceDoc([{ id: 'icon', name: 'iconStart', type: 'frame', parentId: 'i1', behavior: { version: 1, slot: 'iconStart' } }, { id: 'label', name: 'Label', type: 'text', parentId: 'i1' }]);
    assert.equal(behaviorProblem(JSON.parse(JSON.stringify(doc))), null);
});

test('a trailing icon after the label survives save and load', () => {
    const doc = { pages: [{ id: 'p', nodes: [{ ...master, id: 'btn' }, { id: 'mLabel', name: 'Label', type: 'text', parentId: 'btn' }, { id: 'i1', name: 'Save', type: 'frame', isInstance: true, sourceId: 'btn', behavior: { version: 1, props: { hasIcon: true, iconPlacement: 'end' } } }, { id: 'label', name: 'Label', type: 'text', parentId: 'i1' }, { id: 'icon', name: 'iconEnd', type: 'frame', parentId: 'i1', behavior: { version: 1, slot: 'iconEnd' } }] }] };
    assert.equal(behaviorProblem(JSON.parse(JSON.stringify(doc))), null);
});
