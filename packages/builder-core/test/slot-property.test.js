// Content slots (a frame of a main component that instances fill with their own layers: Figma's slot, a component property of type `slot`).
// Not the icon slots of a template (managed layers, see managed-layers.js). Pure decisions the studio used to hold inline; the studio calls them.
// This file: the slot property and the "+" badge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SLOT_BADGE_RADIUS, newSlotProp, slotBadgeAt, slotBadgeCenter, slotPropsWithout, uniqueSlotName } from '../src/behavior-engine/slot-property.js';

test('a new slot property takes the layer\'s name, made unique among the holder\'s properties', () => {
    assert.equal(uniqueSlotName('Content', new Set()), 'Content');
    assert.equal(uniqueSlotName('Content', new Set(['Content'])), 'Content 2');
    assert.equal(uniqueSlotName('Content', new Set(['Content', 'Content 2', 'Content 3'])), 'Content 4');
    assert.equal(uniqueSlotName('  ', new Set()), 'Slot', 'an empty name is Slot');
    assert.equal(uniqueSlotName(undefined, new Set(['Slot'])), 'Slot 2');
    assert.deepEqual(newSlotProp('p1', 'Content'), { id: 'p1', name: 'Content', type: 'slot', def: null });
});

test('removing a slot property keeps every other property', () => {
    const props = [{ id: 'a', type: 'text' }, { id: 'b', type: 'slot' }];
    assert.deepEqual(slotPropsWithout(props, 'b'), [{ id: 'a', type: 'text' }]);
    assert.deepEqual(slotPropsWithout(props, 'zzz'), props);
    assert.deepEqual(slotPropsWithout([{ id: 'b' }], 'b'), []);
});

test('the "+" badge sits where the next layer goes: the middle of an empty slot, else the right edge of a horizontal one and the bottom edge of a vertical one', () => {
    const box = { x: 100, y: 50, w: 200, h: 80 };
    assert.equal(SLOT_BADGE_RADIUS, 9);
    assert.deepEqual(slotBadgeCenter(box, { empty: true, horizontal: true }), { cx: 200, cy: 90, r: 9 });
    assert.deepEqual(slotBadgeCenter(box, { empty: true, horizontal: false }), { cx: 200, cy: 90, r: 9 });
    assert.deepEqual(slotBadgeCenter(box, { empty: false, horizontal: true }), { cx: 300, cy: 90, r: 9 }, 'right edge, centred vertically');
    assert.deepEqual(slotBadgeCenter(box, { empty: false, horizontal: false }), { cx: 200, cy: 130, r: 9 }, 'bottom edge, centred horizontally');
});

test('a badge is hit within its radius, the first one drawn wins, and no badge is a miss', () => {
    const badges = [{ id: 'a', cx: 10, cy: 10, r: 12 }, { id: 'b', cx: 14, cy: 10, r: 12 }];
    assert.equal(slotBadgeAt(badges, { x: 12, y: 10 })?.id, 'a');
    assert.equal(slotBadgeAt(badges, { x: 25, y: 10 })?.id, 'b');
    assert.equal(slotBadgeAt(badges, { x: 200, y: 200 }), null);
    assert.equal(slotBadgeAt([], { x: 0, y: 0 }), null);
    assert.equal(slotBadgeAt(undefined, { x: 0, y: 0 }), null);
});

