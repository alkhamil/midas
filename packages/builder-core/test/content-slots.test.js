// Content slots (a frame of a main component that instances fill with their own layers: Figma's slot, a component property of type `slot`).
// Not the icon slots of a template (managed layers, see managed-layers.js). Pure decisions the studio used to hold inline; the studio calls them.
// This file: what a content slot is, whose it is, and where a click reaches.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canBeSlot, claimSlot, emptySlotFloor, hasSlotProperty, isContentSlot, selectableThroughSlot, slotKeepsContent, slotOwnerOf } from '../src/behavior-engine/content-slots.js';

test('a layer holds the slot property in the main component, and is a content slot when it is the instance\'s copy of it', () => {
    assert.equal(hasSlotProperty({ propBind: { slot: 'p1' } }), true);
    assert.equal(hasSlotProperty({ propBind: { text: 'p1' } }), false);
    assert.equal(hasSlotProperty(undefined), false);
    assert.equal(isContentSlot({ propBind: { slot: 'p1' }, sourceId: 'src' }), true, 'an instance layer bound to a slot');
    assert.equal(isContentSlot({ propBind: { slot: 'p1' } }), false, 'the main component\'s own frame has no source');
    assert.equal(isContentSlot({ sourceId: 'src' }), false);
    assert.equal(isContentSlot(null), false);
});

test('the slot a layer belongs to is the nearest content slot above it, below the root, at most 200 levels up', () => {
    const nodes = {
        root: { id: 'root' },
        slot: { id: 'slot', parentId: 'root', propBind: { slot: 'p' }, sourceId: 's' },
        card: { id: 'card', parentId: 'slot' },
        deep: { id: 'deep', parentId: 'card' },
        plain: { id: 'plain', parentId: 'root' },
        mainSlot: { id: 'mainSlot', parentId: 'root', propBind: { slot: 'p' } },
        inMain: { id: 'inMain', parentId: 'mainSlot' },
    };
    const get = id => nodes[id];
    assert.equal(slotOwnerOf(nodes.deep, 'root', get), nodes.slot);
    assert.equal(slotOwnerOf(nodes.card, 'root', get), nodes.slot);
    assert.equal(slotOwnerOf(nodes.plain, 'root', get), null);
    assert.equal(slotOwnerOf(nodes.inMain, 'root', get), null, 'the frame is a slot only on an instance');
    assert.equal(slotOwnerOf(nodes.slot, 'root', get), null, 'a slot is not inside itself');
    assert.equal(slotOwnerOf(nodes.deep, 'slot', get), null, 'the walk stops at the root it is given');
    const chain = {};
    for (let i = 0; i < 205; i++) chain[`n${i}`] = { id: `n${i}`, parentId: `n${i + 1}` };
    chain.n205 = { id: 'n205', propBind: { slot: 'p' }, sourceId: 's' };
    assert.equal(slotOwnerOf(chain.n0, 'none', id => chain[id]), null, 'a slot more than 200 levels up is not found');
});

test('a frame of a main component can become a slot: not a component, a set, an instance or a section, not inside an instance, and in a holder', () => {
    const frame = { type: 'frame' };
    const ok = { insideInstance: false, hasHolder: true };
    assert.equal(canBeSlot(frame, ok), true);
    assert.equal(canBeSlot(frame, { ...ok, insideInstance: true }), false);
    assert.equal(canBeSlot(frame, { ...ok, hasHolder: false }), false);
    for (const flag of ['component', 'componentSet', 'isInstance', 'isSection']) assert.equal(canBeSlot({ ...frame, [flag]: true }, ok), false, flag);
    assert.equal(canBeSlot({ type: 'rect' }, ok), false);
    assert.equal(canBeSlot(null, ok), false);
});

test('a click reaches into an instance only through a slot: no instance above, or a slot between the layer and its instance', () => {
    const slot = { propBind: { slot: 'p' } }, plain = {};
    assert.equal(selectableThroughSlot([plain, plain], -1), true, 'no instance in the chain');
    assert.equal(selectableThroughSlot([plain, slot, plain, plain], 3), true, 'a slot sits below the instance');
    assert.equal(selectableThroughSlot([plain, plain, plain], 2), false, 'plain layers inside the instance');
    assert.equal(selectableThroughSlot([plain, plain], 0), false, 'the layer is the instance itself');
});

test('an empty slot that hugs stays big enough to see and click: 120 by 56', () => {
    const slot = { propBind: { slot: 'p' }, sourceId: 's' };
    assert.equal(emptySlotFloor(slot, 'w', 'hug', 0), 120);
    assert.equal(emptySlotFloor(slot, 'h', 'hug', 0), 56);
    assert.equal(emptySlotFloor(slot, 'w', 'hug', 1), null, 'with content it hugs the content');
    assert.equal(emptySlotFloor(slot, 'w', 'fixed', 0), null, 'a sized slot keeps its size');
    assert.equal(emptySlotFloor(slot, 'w', 'fill', 0), null);
    assert.equal(emptySlotFloor({ propBind: { slot: 'p' } }, 'w', 'hug', 0), null, 'the main component\'s frame is not a content slot');
});

test('the instance owns a slot once it edits it, and an owned slot keeps exactly what the instance put there', () => {
    const slot = { propBind: { slot: 'p' }, sourceId: 's' };
    assert.equal(slotKeepsContent(slot), false);
    assert.equal(claimSlot(slot), true, 'the first claim changes the slot');
    assert.equal(slot.slotOwned, true);
    assert.equal(slotKeepsContent(slot), true);
    assert.equal(claimSlot(slot), false, 'a second claim changes nothing');
    assert.equal(slotKeepsContent(null), false);
});


import { releaseSlot } from '../src/behavior-engine/content-slots.js';

test('the instance gives a slot back: it stops owning it, so the next sync copies the main component\'s content in again', () => {
    const slot = { propBind: { slot: 'p' }, sourceId: 's', slotOwned: true };
    assert.equal(slotKeepsContent(slot), true);
    assert.equal(releaseSlot(slot), true, 'the first release changes the slot');
    assert.equal(slotKeepsContent(slot), false);
    assert.equal('slotOwned' in slot, false, 'the flag is removed, not set to false');
    assert.equal(releaseSlot(slot), false, 'a slot that is not owned has nothing to release');
    assert.equal(claimSlot(slot), true, 'and can be claimed again');
});
