// Closable tabs: a Tab shows its close icon in its own box after the label while Closable is on, and a click on that box dismisses the tab (Play). Tabs
// owns Closable and copies it to its tabs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const tab = TEMPLATES.get('antd-tab');
const tabs = TEMPLATES.get('antd-tabs');

test('Tab and Tabs are valid with Closable', () => {
    assert.deepEqual(validateTemplateSchema(tab, { templateIds: new Set(TEMPLATES.keys()) }), []);
    assert.deepEqual(validateTemplateSchema(tabs, { templateIds: new Set(TEMPLATES.keys()) }), []);
    assert.deepEqual(tab.press, [{ slot: 'closer', dismiss: true }]);
});

test('the close icon is shown only while Closable is on, in the row after the label', () => {
    const model = modelFor(tab);
    const slotsOf = props => instanceFor(model, props).slice(1).map(n => n.behavior?.slot ?? n.behavior?.group ?? n.name);
    assert.ok(!slotsOf({ label: 'Tab' }).includes('close'));
    const on = slotsOf({ label: 'Tab', closable: true });
    assert.ok(on.includes('close') && on.includes('closer'));
});

test('Tabs copies Closable to the tabs it makes', () => {
    assert.equal(tabs.slots.find(s => s.id === 'items').propagate.closable, 'closable');
});
