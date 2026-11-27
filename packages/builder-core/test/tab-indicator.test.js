// Tab indicator: a bar in its own box. Full width by default; Fixed takes the width (px), placed by the box's align. Tabs owns the props and copies
// them to its tabs (the items slot's `propagate`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { literalFields } from '../src/behavior-engine/display.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';

const tab = TEMPLATES.get('antd-tab');
const tabs = TEMPLATES.get('antd-tabs');

/** The field values a template's props write on one node key. */
const fieldsOn = (template, props, key) => Object.fromEntries(literalFields(template, resolveProps(template, props)).filter(w => w.key === key).map(w => [w.field, w.value]));

test('Tab and Tabs are valid, and the indicator sits in its own box', () => {
    assert.deepEqual(validateTemplateSchema(tab, { templateIds: new Set(TEMPLATES.keys()) }), []);
    assert.deepEqual(validateTemplateSchema(tabs, { templateIds: new Set(TEMPLATES.keys()) }), []);
    assert.equal(tab.anatomy.find(a => a.id === 'indicator').parent, 'indicatorBox');
});

test('the indicator fills the tab by default, and Fixed takes the width', () => {
    assert.equal(fieldsOn(tab, {}, 'indicator').widthSizing, 'fill');
    assert.deepEqual(fieldsOn(tab, { indicatorFixed: true, indicatorWidth: 40 }, 'indicator'), { width: 40, widthSizing: 'fixed' });
});

test('the box places the indicator by Align, centred by default', () => {
    assert.equal(fieldsOn(tab, {}, 'indicatorBox').primaryAlign, 'center');
    assert.equal(fieldsOn(tab, { indicatorAlign: 'end' }, 'indicatorBox').primaryAlign, 'end');
});

test('Tabs propagates its indicator props to the tab it makes', () => {
    const slot = tabs.slots.find(s => s.id === 'items');
    assert.deepEqual(slot.propagate, { indicatorWidth: 'indicatorWidth', indicatorFixed: 'indicatorFixed', indicatorAlign: 'indicatorAlign', closable: 'closable' });
    for (const [from, to] of Object.entries(slot.propagate)) {
        assert.ok(tabs.props[from], `Tabs has ${from}`);
        assert.ok(tab.props[to], `Tab has ${to}`);
    }
});
