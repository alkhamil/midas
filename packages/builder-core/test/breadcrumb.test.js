// Breadcrumb: up to three items; each item after the first comes with the separator before it, and is made only while its text is not empty.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const breadcrumb = TEMPLATES.get('antd-breadcrumb');
const model = modelFor(breadcrumb);
const slotsOf = props => instanceFor(model, props).slice(1).map(n => n.behavior?.slot ?? n.name);

test('Breadcrumb is registered, valid, and takes Size from the variable collection, the rest from literals', () => {
    assert.ok(breadcrumb, 'Breadcrumb is in the registry');
    assert.deepEqual(validateTemplateSchema(breadcrumb, { templateIds: new Set(TEMPLATES.keys()) }), []);
    assert.deepEqual(Object.keys(breadcrumb.props).sort(), ['item1', 'item2', 'item3', 'size']);
    assert.equal(breadcrumb.props.size.source, 'variable');
});

test('the first item always shows; the second and third come with their separator while their text is not empty', () => {
    assert.deepEqual(slotsOf({ item1: 'Home', item2: '', item3: '' }), ['item1']);
    assert.deepEqual(slotsOf({ item1: 'Home', item2: 'App', item3: '' }), ['item1', 'separator1', 'item2']);
    assert.deepEqual(slotsOf({ item1: 'Home', item2: 'App', item3: 'Users' }), ['item1', 'separator1', 'item2', 'separator2', 'item3']);
    assert.deepEqual(slotsOf({ item1: 'Home', item2: '', item3: 'Users' }), ['item1', 'separator2', 'item3'], 'an empty middle item takes no separator of its own, and the last keeps the one before it');
});

test('the separators are static text ("/"), made with the item they precede', () => {
    const seps = breadcrumb.anatomy.filter(a => a.id.startsWith('separator'));
    assert.deepEqual(seps.map(a => a.defaultText), ['/', '/']);
});
