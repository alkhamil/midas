// Tab icons: an icon sits before or after the label in the tab's row, only while Has Icon is on, and the row is above the indicator.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const tab = TEMPLATES.get('antd-tab');
const model = modelFor(tab);

/** The layers of an instance under these props, root excluded: the anatomy slot or name of each, and its parent's slot. */
const layersOf = props => instanceFor(model, props).slice(1).map(n => ({ slot: n.behavior?.slot ?? n.name, parent: n.parentId }));

test('Tab is valid with Has Icon, Icon and the icon after the label', () => {
    assert.deepEqual(validateTemplateSchema(tab, { templateIds: new Set(TEMPLATES.keys()) }), []);
    assert.equal(tab.props.hasIcon.type, 'boolean');
    assert.equal(tab.props.iconPlacement.default, 'start');
    assert.ok(tab.props.icon && tab.props.iconEnd);
});

test('no icon when Has Icon is off, the label alone in the row', () => {
    const layers = layersOf({ label: 'Tab' }).map(l => l.slot);
    assert.ok(!layers.includes('iconStart') && !layers.includes('iconEnd'));
    assert.ok(layers.includes('label') && layers.includes('row') && layers.includes('indicator'));
});

test('an icon at the start is the first layer of the row, before the label; at the end, after it', () => {
    const start = instanceFor(model, { label: 'Tab', hasIcon: true, iconPlacement: 'start' });
    const row = start.find(n => n.behavior?.slot === 'row' || n.name === 'row');
    const inRow = start.filter(n => n.parentId === row.id).map(n => n.behavior?.slot ?? n.name);
    assert.deepEqual(inRow, ['iconStart', 'label']);
    const end = instanceFor(model, { label: 'Tab', hasIcon: true, iconPlacement: 'end' });
    const rowEnd = end.find(n => n.behavior?.slot === 'row' || n.name === 'row');
    assert.deepEqual(end.filter(n => n.parentId === rowEnd.id).map(n => n.behavior?.slot ?? n.name), ['label', 'iconEnd']);
});
