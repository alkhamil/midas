// What an edit newly breaks in a slot: the findings after it that were not there before. Every way content enters or leaves a slot is an edit, so
// the studio compares the slot findings before and after each one and says what it introduced (a notice, never a block: the picker is where a
// slot refuses, everywhere else it warns).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { introducedSlotProblems, slotNotice } from '../src/behavior-engine/slot-diagnostics.js';

const problem = (code, extra = {}) => ({ severity: 'warning', code, node: 'Card', nodeId: 'inst', slot: 'slot', message: `${code} on ${extra.layer ?? 'the slot'}`, ...extra });

test('an edit introduces the findings that were not there before it', () => {
    const below = problem('slot-below-min');
    assert.deepEqual(introducedSlotProblems([], [below]), [below]);
    assert.deepEqual(introducedSlotProblems([below], [below]), [], 'one that was already there is not new');
    assert.deepEqual(introducedSlotProblems([below], []), [], 'one that is fixed is not new');
    assert.deepEqual(introducedSlotProblems([], []), []);
});

test('a finding is the same one while its numbers change, so a delete that improves an over-full slot is not reported', () => {
    const before = problem('slot-above-max', { message: 'Card: slot "Content" holds 4 layers, at most 2 allowed.' });
    const after = problem('slot-above-max', { message: 'Card: slot "Content" holds 3 layers, at most 2 allowed.' });
    assert.deepEqual(introducedSlotProblems([before], [after]), []);
});

test('a finding is new for another slot, another instance or another layer', () => {
    const base = problem('slot-not-accepted', { layer: 'c1' });
    assert.equal(introducedSlotProblems([base], [base, { ...base, layer: 'c2' }]).length, 1, 'another layer');
    assert.equal(introducedSlotProblems([base], [base, { ...base, slot: 'other' }]).length, 1, 'another slot');
    assert.equal(introducedSlotProblems([base], [base, { ...base, nodeId: 'inst2' }]).length, 1, 'another instance');
    assert.equal(introducedSlotProblems([base], [base, { ...base, code: 'slot-below-min' }]).length, 1, 'another kind');
});

test('the notice is the first new finding, and says how many more there are', () => {
    assert.equal(slotNotice([]), null);
    assert.equal(slotNotice([problem('slot-below-min', { message: 'First.' })]), 'First.');
    assert.equal(slotNotice([problem('slot-below-min', { message: 'First.' }), problem('slot-above-max', { message: 'Second.' })]), 'First. (1 more)');
    assert.equal(slotNotice([1, 2, 3, 4].map(n => problem('slot-not-accepted', { layer: `c${n}`, message: `Layer ${n}.` }))), 'Layer 1. (3 more)');
});
