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

import { withoutFreshMinimums } from '../src/behavior-engine/slot-diagnostics.js';

test('a freshly created instance is always below its minimum: that finding is not news, any other is', () => {
    const fresh = new Set(['new1', 'new1-inner']);
    const below = id => problem('slot-below-min', { nodeId: id });
    assert.deepEqual(withoutFreshMinimums([below('new1')], fresh), [], 'the instance just created');
    assert.deepEqual(withoutFreshMinimums([below('new1-inner')], fresh), [], 'an instance inside it');
    const other = below('old');
    assert.deepEqual(withoutFreshMinimums([below('new1'), other], fresh), [other], 'another instance keeps its notice');
    const above = problem('slot-above-max', { nodeId: 'new1' });
    const notTaken = problem('slot-not-accepted', { nodeId: 'new1', layer: 'c1' });
    assert.deepEqual(withoutFreshMinimums([above, notTaken], fresh), [above, notTaken], 'only the minimum is excused');
    assert.deepEqual(withoutFreshMinimums([below('new1')], new Set()), [below('new1')], 'nothing was created');
    assert.deepEqual(withoutFreshMinimums([], fresh), []);
});

test('the diagnostics still report the fresh instance below its minimum: only the notice is excused', async () => {
    const { diagnoseSlots } = await import('../src/behavior-engine/slot-diagnostics.js');
    const nodes = [
        { id: 'card', name: 'Card', type: 'frame', component: true, parentId: null, cprops: [{ id: 'p1', name: 'Content', type: 'slot', min: 1 }] },
        { id: 'frame', name: 'Content', type: 'frame', parentId: 'card', propBind: { slot: 'p1' } },
        { id: 'new1', name: 'Card', type: 'frame', parentId: null, isInstance: true, sourceId: 'card' },
        { id: 'slot', name: 'Content', type: 'frame', parentId: 'new1', sourceId: 'frame', propBind: { slot: 'p1' } },
    ];
    const findings = diagnoseSlots(nodes);
    assert.deepEqual(findings.map(f => f.code), ['slot-below-min']);
    assert.deepEqual(withoutFreshMinimums(findings, new Set(['new1'])), []);
});
