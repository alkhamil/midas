// Radio Group's options take Radio only: a List Item (another template) is refused by the slot's rule, the same rule the Design tab's picker and placement use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { slotAccepts, slotRestricts } from '../src/behavior-engine/slot-rules.js';

const group = TEMPLATES.get('antd-radio-group');
const options = group.slots.find(s => s.id === 'items');
const prop = { name: 'Options', ...options };

test('the options slot restricts its templates to Radio', () => {
    assert.equal(slotRestricts(prop), true);
    assert.deepEqual(options.accepts, ['radio']);
});

test('a Radio is taken, a List Item is refused', () => {
    assert.equal(slotAccepts(prop, { ids: ['r1'], templates: ['radio'] }), true);
    assert.equal(slotAccepts(prop, { ids: ['li1'], templates: ['antd-list-item'] }), false);
});
