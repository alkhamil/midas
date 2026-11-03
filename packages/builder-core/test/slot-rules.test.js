// Content slots (a frame of a main component that instances fill with their own layers: Figma's slot, a component property of type `slot`).
// Not the icon slots of a template (managed layers, see managed-layers.js). Pure decisions the studio used to hold inline; the studio calls them.
// This file: the limits of a slot, what it accepts, and the words about it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SLOT_OPTIONS, slotAccepts, slotCountLabel, slotCounts, slotFullMessage, slotLimitFrom, slotOptionPatch, slotPreferredWith, slotPreferredWithout } from '../src/behavior-engine/slot-rules.js';

test('a limit typed in the editor: empty is none, a whole number, a maximum is at least 1 and a minimum at least 0', () => {
    assert.equal(slotLimitFrom('', 'min'), null);
    assert.equal(slotLimitFrom('  ', 'max'), null);
    assert.equal(slotLimitFrom('3', 'max'), 3);
    assert.equal(slotLimitFrom('3.9', 'min'), 3, 'rounded down');
    assert.equal(slotLimitFrom('0', 'min'), 0);
    assert.equal(slotLimitFrom('0', 'max'), 1, 'a slot holds at least one layer at most');
    assert.equal(slotLimitFrom('-4', 'min'), 0);
    assert.equal(slotLimitFrom('-4', 'max'), 1);
    assert.equal(slotLimitFrom('abc', 'min'), 0);
    assert.equal(slotLimitFrom('abc', 'max'), 1);
});

test('the counts of a slot against its limits: below the minimum, above the maximum, and full (one more would not fit)', () => {
    assert.deepEqual(slotCounts(undefined, 5), { belowMin: false, aboveMax: false, full: false });
    assert.deepEqual(slotCounts({}, 0), { belowMin: false, aboveMax: false, full: false });
    assert.deepEqual(slotCounts({ min: 2 }, 1), { belowMin: true, aboveMax: false, full: false });
    assert.deepEqual(slotCounts({ min: 2 }, 2), { belowMin: false, aboveMax: false, full: false });
    assert.deepEqual(slotCounts({ max: 2 }, 1), { belowMin: false, aboveMax: false, full: false });
    assert.deepEqual(slotCounts({ max: 2 }, 2), { belowMin: false, aboveMax: false, full: true }, 'at the maximum the slot is full');
    assert.deepEqual(slotCounts({ max: 2 }, 3), { belowMin: false, aboveMax: true, full: true });
    assert.deepEqual(slotCounts({ min: 0, max: null }, 9), { belowMin: false, aboveMax: false, full: false }, 'none and zero mean no limit');
});

test('the words the studio says about a slot', () => {
    assert.equal(slotFullMessage(1), 'This slot holds at most 1 layer.');
    assert.equal(slotFullMessage(3), 'This slot holds at most 3 layers.');
    assert.equal(slotCountLabel(0), 'Empty');
    assert.equal(slotCountLabel(1), '1 layer');
    assert.equal(slotCountLabel(4), '4 layers');
});

test('a slot that only allows preferred instances accepts exactly those; with none preferred, or the option off, it accepts anything', () => {
    assert.equal(slotAccepts({ onlyPreferred: true, preferred: ['a', 'b'] }, 'a'), true);
    assert.equal(slotAccepts({ onlyPreferred: true, preferred: ['a', 'b'] }, 'c'), false);
    assert.equal(slotAccepts({ onlyPreferred: true, preferred: [] }, 'c'), true, 'nothing preferred, nothing to restrict to');
    assert.equal(slotAccepts({ onlyPreferred: true }, 'c'), true);
    assert.equal(slotAccepts({ onlyPreferred: false, preferred: ['a'] }, 'c'), true);
    assert.equal(slotAccepts(undefined, 'c'), true, 'a layer with no slot property accepts anything');
});

test('preferred instances are added once and removed by id, without changing the property', () => {
    const prop = { preferred: ['a'] };
    assert.deepEqual(slotPreferredWith(prop, 'b'), ['a', 'b']);
    assert.deepEqual(slotPreferredWith(prop, 'a'), ['a'], 'no duplicate');
    assert.deepEqual(slotPreferredWith({}, 'a'), ['a']);
    assert.deepEqual(slotPreferredWithout(prop, 'a'), []);
    assert.deepEqual(slotPreferredWithout({}, 'a'), []);
    assert.deepEqual(prop, { preferred: ['a'] }, 'the property is untouched');
});

test('a checkbox of the slot editor writes one of the three options, and nothing else', () => {
    assert.deepEqual(SLOT_OPTIONS, ['onlyPreferred', 'showEmpty', 'fillCounter']);
    assert.deepEqual(slotOptionPatch('onlyPreferred', true), { onlyPreferred: true });
    assert.deepEqual(slotOptionPatch('showEmpty', false), { showEmpty: false });
    assert.deepEqual(slotOptionPatch('fillCounter', true), { fillCounter: true });
    assert.deepEqual(slotOptionPatch('desc', true), {}, 'an unknown key writes nothing');
});


import { slotVisible } from '../src/behavior-engine/slot-rules.js';

test('an empty slot shows only when the slot asks to display it empty; with content it always shows', () => {
    assert.equal(slotVisible({ showEmpty: true }, true, 0), true, 'asked to display empty');
    assert.equal(slotVisible({ showEmpty: false }, true, 0), false, 'empty and not asked: it takes no space');
    assert.equal(slotVisible({}, true, 0), false, 'the option is off by default');
    assert.equal(slotVisible({ showEmpty: false }, true, 1), true, 'content shows the slot');
    assert.equal(slotVisible({}, true, 3), true);
    assert.equal(slotVisible({ showEmpty: true }, true, 2), true);
});

test('a slot the designer hid stays hidden, whatever it holds, and a slot with no property is left as it is', () => {
    assert.equal(slotVisible({ showEmpty: true }, false, 0), false);
    assert.equal(slotVisible({ showEmpty: true }, false, 4), false);
    assert.equal(slotVisible(undefined, true, 0), true, 'no property, no rule');
    assert.equal(slotVisible(undefined, false, 2), false);
});

import { slotFillPatch } from '../src/behavior-engine/slot-rules.js';

test('a layer put into a horizontal slot fills the slot\'s counter axis (its height) on its own, as in Figma, with the option on or off', () => {
    assert.deepEqual(slotFillPatch({}, 'horizontal'), { layoutSizingV: 'fill' });
    assert.deepEqual(slotFillPatch({ fillCounter: false }, 'horizontal'), { layoutSizingV: 'fill' });
    assert.deepEqual(slotFillPatch({ fillCounter: true }, 'horizontal'), { layoutSizingV: 'fill' });
});

test('a layer put into a vertical slot fills the counter axis (its width) only when the slot asks', () => {
    assert.deepEqual(slotFillPatch({ fillCounter: true }, 'vertical'), { layoutSizingH: 'fill' });
    assert.deepEqual(slotFillPatch({ fillCounter: false }, 'vertical'), {});
    assert.deepEqual(slotFillPatch({}, 'vertical'), {});
});

test('a slot that is not an auto layout, or a layer with no slot property, writes nothing', () => {
    assert.deepEqual(slotFillPatch({ fillCounter: true }, null), {});
    assert.deepEqual(slotFillPatch({ fillCounter: true }, 'none'), {});
    assert.deepEqual(slotFillPatch(undefined, 'horizontal'), {});
    assert.deepEqual(slotFillPatch(undefined, 'vertical'), {});
});
