// List: a column of List Item instances only. Its Items box holds List Items (one at the start), and Separator puts a Divider between two items.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { LIST } from '../src/templates/list.js';

test('List is valid and registered', () => {
    assert.deepEqual(validateTemplateSchema(LIST, { templateIds: new Set(TEMPLATES.keys()) }), []);
    assert.ok(TEMPLATES.get('list'));
});

test('the Items box holds List Items only, and a new List starts with one', () => {
    const items = LIST.slots.find(s => s.id === 'items');
    assert.equal(items.holds, 'instance');
    assert.deepEqual(items.accepts, ['antd-list-item']);
    assert.equal(items.onlyAccepts, true);
    assert.equal(items.box, 'listBox');
    assert.equal(items.seed.length, 1);
    assert.equal(items.seed[0].template, 'antd-list-item');
    assert.deepEqual(items.seed[0].follow, { size: 'size' });
});

test('Separator is a boolean prop that puts a Divider between the items', () => {
    assert.deepEqual(LIST.props.separator, { source: 'literal', type: 'boolean', default: false });
    const items = LIST.slots.find(s => s.id === 'items');
    assert.deepEqual(items.separator, { template: 'antd-divider', prop: 'separator', follow: { size: 'size' } }, 'the Dividers follow the List Size');
});

test('the validator refuses a Separator that names no template or no boolean prop', () => {
    const bad = structuredClone(LIST);
    bad.slots[0].separator = { template: 'antd-divider', prop: 'size' };
    assert.ok(validateTemplateSchema(bad, { templateIds: new Set(TEMPLATES.keys()) }).some(p => /separator/.test(p)));
    const unknown = structuredClone(LIST);
    unknown.slots[0].separator = { template: 'nope', prop: 'separator' };
    assert.ok(validateTemplateSchema(unknown, { templateIds: new Set(TEMPLATES.keys()) }).some(p => /separator/.test(p)));
});

test('a box that holds instances must restrict them (accepts and onlyAccepts)', () => {
    const open = structuredClone(LIST);
    delete open.slots[0].onlyAccepts;
    assert.ok(validateTemplateSchema(open, { templateIds: new Set(TEMPLATES.keys()) }).some(p => /needs accepts and onlyAccepts/.test(p)));
});
