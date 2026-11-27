// The plan of an edit to one instance's prop: the next behaviour, the box siblings it deselects, and whether a placeholder picture is used.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planInstanceEdit } from '../src/behavior-engine/instance-edit.js';
import { PLACEHOLDER_IMAGE_ID } from '../src/behavior-engine/placeholder-image.js';

const master = { id: 'tab-master', behavior: { version: 2, templateId: 'antd-tab', variables: {} } };
const tab = (id, active, sourceId = 'tab-master') => ({ id, sourceId, parentId: 'tabs', behavior: { version: 2, props: { active } } });
const noIcons = { defaultIcon: null, roleIcons: {}, modes: {} };
const box = { id: 'tabs', propBind: { slot: 'items' } };
const loose = { id: 'page' };

test('selecting a tab in a box deselects the other selected tabs of the same master, and returns the new behaviour', () => {
    const items = [tab('a', true), tab('b', false), tab('c', false)];
    const plan = planInstanceEdit({ instance: items[1], master, prop: 'active', value: true, parent: box, siblings: items, iconDefaults: noIcons });
    assert.equal(plan.behavior.props.active, true);
    assert.deepEqual(plan.deselect.map(d => d.id), ['a']);
    assert.equal(plan.deselect[0].behavior.props.active, false);
    assert.equal(plan.usesPlaceholder, false);
});

test('a loose instance (not in a box) deselects nothing, even with same-master siblings', () => {
    const items = [tab('a', true), tab('b', false)];
    const plan = planInstanceEdit({ instance: items[1], master, prop: 'active', value: true, parent: loose, siblings: items, iconDefaults: noIcons });
    assert.deepEqual(plan.deselect, []);
});

test('a sibling from another master is never touched', () => {
    const items = [tab('a', true, 'other-master'), tab('b', false)];
    const plan = planInstanceEdit({ instance: items[1], master, prop: 'active', value: true, parent: box, siblings: items, iconDefaults: noIcons });
    assert.deepEqual(plan.deselect, []);
});

test('turning on a Card cover uses the placeholder picture for it', () => {
    const card = { id: 'card-master', behavior: { version: 2, templateId: 'antd-card', variables: {} } };
    const instance = { id: 'card-1', sourceId: 'card-master', behavior: { version: 2, props: { cover: false } } };
    const plan = planInstanceEdit({ instance, master: card, prop: 'cover', value: true, parent: loose, siblings: [instance], iconDefaults: noIcons });
    assert.equal(plan.usesPlaceholder, true);
    assert.equal(plan.behavior.props.coverImage, PLACEHOLDER_IMAGE_ID);
});

test('turning the item off deselects nothing', () => {
    const items = [tab('a', true), tab('b', false)];
    const plan = planInstanceEdit({ instance: items[0], master, prop: 'active', value: false, parent: box, siblings: items, iconDefaults: noIcons });
    assert.deepEqual(plan.deselect, []);
    assert.equal(plan.behavior.props.active, false);
});
