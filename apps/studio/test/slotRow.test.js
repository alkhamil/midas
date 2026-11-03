// The row of a content slot in the instance's Design panel: the "Add instances" button with what the slot holds, and two small actions beside
// it: Clear (shown while the slot holds layers) and Reset (shown while the instance owns the slot, so there is something to give back).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slotRowHtml } from '../src/engine/slotRow.js';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const icons = { slot: '<i-slot/>', plus: '<i-plus/>', clear: '<i-clear/>', reset: '<i-reset/>' };
const row = (count, owned, slotId = 's1') => slotRowHtml({ slotId, count, owned, esc, icons });

test('the Add instances button says what the slot holds, as it always did', () => {
    assert.equal(row(0, false), '<button class="cmp-slot add" data-slot-add="s1" title="Add instances to this slot"><i-slot/><span>Empty</span><i><i-plus/></i></button>');
    assert.match(row(1, false), /<span>1 layer<\/span>/);
    assert.match(row(3, false), /<span>3 layers<\/span>/);
});

test('Clear is offered only while the slot holds layers', () => {
    assert.doesNotMatch(row(0, true), /data-slot-clear/);
    assert.match(row(2, false), /<button class="icon-button small" data-slot-clear="s1" title="Clear slot" aria-label="Clear slot"><i-clear\/><\/button>/);
});

test('Reset is offered only while the instance owns the slot', () => {
    assert.doesNotMatch(row(2, false), /data-slot-reset/);
    assert.match(row(0, true), /<button class="icon-button small" data-slot-reset="s1" title="Reset slot" aria-label="Reset slot"><i-reset\/><\/button>/);
});

test('both actions follow the Add button, Clear first, and nothing else is added to a slot that is empty and not owned', () => {
    const both = row(2, true);
    assert.ok(both.indexOf('data-slot-add') < both.indexOf('data-slot-clear') && both.indexOf('data-slot-clear') < both.indexOf('data-slot-reset'));
    assert.equal((row(0, false).match(/<button/g) ?? []).length, 1);
});

test('the slot id is escaped', () => {
    assert.match(row(0, true, 'a"b'), /data-slot-add="a&quot;b"/);
    assert.match(row(0, true, 'a"b'), /data-slot-reset="a&quot;b"/);
});
