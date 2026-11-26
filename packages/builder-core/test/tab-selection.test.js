// Selection among a box's items (a Tabs' tabs): turning an exclusive toggle prop on deselects the siblings that hold it on; the first item is
// selected when none is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { siblingsToDeselect, selectedAtStart } from '../src/behavior-engine/selection.js';

const tab = TEMPLATES.get('antd-tab');
const item = (id, active) => ({ id, sourceId: 'tab-master', behavior: { version: 2, props: { active } } });

test('selecting a tab turns off the others that are selected, and no other prop', () => {
    const tabs = [item('a', true), item('b', false), item('c', false)];
    assert.deepEqual(siblingsToDeselect(tab, 'active', true, tabs, tabs[1]).map(s => s.id), ['a']);
    assert.deepEqual(siblingsToDeselect(tab, 'active', false, tabs, tabs[0]), [], 'turning a tab off deselects nothing else');
    assert.deepEqual(siblingsToDeselect(tab, 'label', true, tabs, tabs[1]), [], 'a prop that is not the exclusive toggle deselects nothing');
});

test('a template with no exclusive toggle selects nothing else', () => {
    const plain = TEMPLATES.get('antd-breadcrumb-item');
    assert.deepEqual(siblingsToDeselect(plain, 'active', true, [item('a', true), item('b', false)], { id: 'b' }), []);
});

test('the first tab is selected when none of the tabs is', () => {
    assert.equal(selectedAtStart([item('a', false), item('b', false)]), 'a');
    assert.equal(selectedAtStart([item('a', false), item('b', true)]), null, 'a tab already selected is left alone');
    assert.equal(selectedAtStart([]), null);
});
