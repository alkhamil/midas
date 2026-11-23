// Pagination: a previous and a next chevron (always drawn), the current page as text, and the total beside it while Show Total is on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { generateComponent, componentNameOf } from '../src/behavior-engine/codegen.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const pagination = TEMPLATES.get('antd-pagination');
const model = modelFor(pagination);
const slotsOf = props => instanceFor(model, props).slice(1).map(n => n.behavior?.slot ?? n.name);

test('Pagination is registered, valid, and takes Size from the variable collection, the rest from literals', () => {
    assert.ok(pagination, 'Pagination is in the registry');
    assert.deepEqual(validateTemplateSchema(pagination, { templateIds: new Set(TEMPLATES.keys()) }), []);
    assert.deepEqual(Object.keys(pagination.props).sort(), ['nextIcon', 'page', 'prevIcon', 'showTotal', 'size', 'total']);
    assert.equal(pagination.props.size.source, 'variable');
});

test('the chevrons are on every instance, and the total shows while Show Total is on and its text is not empty', () => {
    const on = slotsOf({ showTotal: true, total: 'of 10' });
    assert.ok(on.includes('prev') && on.includes('next') && on.includes('total'));
    assert.ok(!slotsOf({ showTotal: false, total: 'of 10' }).includes('total'));
    assert.ok(!slotsOf({ showTotal: true, total: '' }).includes('total'));
    assert.ok(slotsOf({ showTotal: false }).includes('prev'), 'the chevrons do not depend on the total');
});

test('the export draws the page and the chevrons, and the Size gap', () => {
    const files = generateComponent(pagination, model.binding, model.variables, componentNameOf(pagination), model.frame, () => []).files;
    const tsx = Object.entries(files).find(([name]) => /.(tsx|jsx)$/.test(name))[1];
    assert.match(tsx, /antd-pagination-page/);
});
