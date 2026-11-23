// Breadcrumb: a box of Link items (two to start, one more per Plus), a separator before each item but the first, and Truncated over the row.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { BREADCRUMB } from '../src/templates/breadcrumb.js';

const breadcrumb = TEMPLATES.get('antd-breadcrumb');
const items = BREADCRUMB.slots[0];

test('Breadcrumb is registered and valid; Size comes from the variable collection, the rest from literals', () => {
    assert.ok(breadcrumb, 'Breadcrumb is in the registry');
    assert.deepEqual(validateTemplateSchema(breadcrumb, { templateIds: new Set(TEMPLATES.keys()) }), []);
    assert.deepEqual(Object.keys(BREADCRUMB.props).sort(), ['separatorIcon', 'separatorKind', 'size', 'truncated']);
    assert.equal(BREADCRUMB.props.size.source, 'variable');
});

test('the items box holds only Link instances, two to start, and each Plus adds one', () => {
    assert.equal(items.box, 'itemsBox');
    assert.deepEqual(items.accepts, ['antd-link']);
    assert.equal(items.onlyAccepts, true);
    assert.equal(items.start, 2);
    assert.equal(items.seed.length, 1, 'a seed is one item, so a Plus adds exactly one');
});

test('the separator is a plain text layer or an icon, chosen by Separator; Truncated names the ellipsis', () => {
    assert.deepEqual(BREADCRUMB.props.separatorKind.options, ['text', 'icon']);
    assert.equal(BREADCRUMB.props.separatorIcon.type, 'iconComponent');
    assert.deepEqual(items.between, { kind: 'separatorKind', icon: 'separatorIcon', layer: 'separator', text: '/' });
    assert.deepEqual(items.overflow, { prop: 'truncated', layer: 'ellipsis', text: '…' });
});
