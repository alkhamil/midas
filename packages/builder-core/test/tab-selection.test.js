// Selection among a box's items (a Tabs' tabs): turning an exclusive toggle prop on makes the rivals of the same group on; the first item is
// selected when none is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { exclusiveRivals, isBoxSlot, turnsExclusiveOn, selectedAtStart } from '../src/behavior-engine/selection.js';

const tab = TEMPLATES.get('antd-tab');
const item = (id, active, group = 'tab-master') => ({ id, sourceId: group, behavior: { version: 2, props: { active } } });
const asItems = (nodes, prop = 'active') => nodes.map(node => ({ node, group: node.sourceId, on: node.behavior.props[prop] === true }));

test('selecting a tab turns off the others that are selected, and no other prop', () => {
    const tabs = [item('a', true), item('b', false), item('c', false)];
    assert.equal(turnsExclusiveOn(tab, 'active', true), true);
    assert.equal(turnsExclusiveOn(tab, 'active', false), false, 'turning a tab off deselects nothing else');
    assert.equal(turnsExclusiveOn(tab, 'label', true), false, 'a prop that is not the exclusive toggle deselects nothing');
    const rivals = exclusiveRivals({ node: tabs[1], group: 'tab-master' }, asItems(tabs));
    assert.deepEqual(rivals.map(r => r.node.id), ['a']);
});

test('a template with no exclusive toggle turns nothing exclusive', () => {
    const plain = TEMPLATES.get('antd-breadcrumb-item');
    assert.equal(turnsExclusiveOn(plain, 'active', true), false);
});

test('rivals of another group, or that are off, are not deselected', () => {
    const tabs = [item('a', true, 'other-master'), item('b', false), item('c', false)];
    assert.deepEqual(exclusiveRivals({ node: tabs[1], group: 'tab-master' }, asItems(tabs)), []);
});

test('only a box slot is a group of items; a loose parent is not', () => {
    assert.equal(isBoxSlot({ propBind: { slot: 'items' } }), true);
    assert.equal(isBoxSlot({ id: 'page' }), false);
    assert.equal(isBoxSlot(undefined), false);
});

test('the first tab is selected when none of the tabs is', () => {
    assert.equal(selectedAtStart([item('a', false), item('b', false)]), 'a');
    assert.equal(selectedAtStart([item('a', false), item('b', true)]), null, 'a tab already selected is left alone');
    assert.equal(selectedAtStart([]), null);
});
