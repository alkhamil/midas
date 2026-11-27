// The default boxes of List and Radio Group: two items to start, at least two (the minus stops there), the Plus adds the seed's template, and a
// List takes a Divider in its item box (the separator, as a preferred instance).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { slotListOf } from '../src/behavior-engine/slot-list.js';

test('List: two List Items to start and never fewer than two; a Divider is accepted in the item box; Separator is on by default', () => {
    const list = TEMPLATES.get('list');
    const items = list.slots.find(s => s.id === 'items');
    assert.equal(items.start, 2);
    assert.equal(items.min, 2);
    assert.ok(items.accepts.includes('antd-divider'), 'a Divider is a preferred instance of the item box');
    assert.equal(list.props.separator.default, true);
    const entry = slotListOf(list, {}).find(e => e.id === 'items');
    assert.equal(entry.addable, true);
    assert.equal(entry.addTemplate, 'antd-list-item', 'the Plus adds a List Item, whatever else the box accepts');
    assert.equal(entry.min, 2);
});

test('Radio Group: two Radios to start and never fewer than two; the Plus adds a Radio, and its options are instances', () => {
    const group = TEMPLATES.get('antd-radio-group');
    const items = group.slots.find(s => s.id === 'items');
    assert.equal(items.start, 2);
    assert.equal(items.min, 2);
    assert.equal(items.holds, 'instance');
    assert.equal(items.seed[0].template, 'radio');
    const entry = slotListOf(group, {}).find(e => e.id === 'items');
    assert.equal(entry.addable, true);
    assert.equal(entry.addTemplate, 'radio');
    assert.equal(entry.min, 2);
});
