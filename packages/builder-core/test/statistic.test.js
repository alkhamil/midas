// Statistic: a title above a value, with an optional prefix and suffix icon beside the value. The title is a managed text, made while it is not empty; the value
// is always drawn; the icons show by hasPrefix and hasSuffix. No variable props: the typography and colours are tokens of the template's roles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { generateComponent, componentNameOf } from '../src/behavior-engine/codegen.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const statistic = TEMPLATES.get('antd-statistic');
const model = modelFor(statistic);

/** The layers of an instance under these props, root excluded, by their anatomy id (a slot's behavior key). */
const slotsOf = props => instanceFor(model, props).slice(1).map(n => n.behavior?.slot ?? n.name);

test('Statistic is registered, valid, and takes its Size from the variable collection, the rest from literals', () => {
    assert.ok(statistic, 'Statistic is in the registry');
    assert.equal(statistic.name, 'Statistic');
    assert.deepEqual(validateTemplateSchema(statistic, { templateIds: new Set(TEMPLATES.keys()) }), []);
    assert.deepEqual(Object.keys(statistic.props).sort(), ['hasPrefix', 'hasSuffix', 'prefix', 'size', 'suffix', 'title', 'value']);
    assert.equal(statistic.props.size.source, 'variable');
    for (const [name, def] of Object.entries(statistic.props)) if (name !== 'size') assert.equal(def.source, 'literal', `${name} is a literal`);
    assert.ok(!statistic.element.disabledState, 'a status-like element has no disabled state');
});

test('the title shows while it is not empty; the value is always drawn', () => {
    assert.ok(slotsOf({ title: 'Active users', value: '112' }).includes('title'));
    assert.ok(!slotsOf({ title: '', value: '112' }).includes('title'), 'an empty title asks for no layer');
    assert.ok(slotsOf({ title: '', value: '112' }).includes('value'), 'the value is there without a title');
});

test('the prefix and suffix icons show by hasPrefix and hasSuffix', () => {
    const off = slotsOf({ hasPrefix: false, hasSuffix: false, value: '1' });
    assert.ok(!off.includes('prefix') && !off.includes('suffix'));
    const on = slotsOf({ hasPrefix: true, hasSuffix: true, value: '1' });
    assert.ok(on.includes('prefix') && on.includes('suffix'));
});

test('the value is the text the props give it', () => {
    const value = instanceFor(model, { value: '93%' }).find(n => (n.behavior?.slot ?? n.name) === 'value');
    assert.equal(value.text, '93%');
});

test('the export draws the title and value, and the value takes the value typography', () => {
    const files = generateComponent(statistic, model.binding, model.variables, componentNameOf(statistic), model.frame, () => []).files;
    assert.match(files['Statistic.jsx'], /className="antd-statistic-value"/, 'the value is drawn');
    assert.match(files['Statistic.jsx'], /className="antd-statistic-title"/, 'the title is drawn');
});

test('the value row keeps the anatomy order: the prefix before the value, the suffix after it, whatever order the props turn them on', () => {
    const row = props => { const nodes = instanceFor(model, props); const box = nodes.find(n => n.name === 'valueBox'); return nodes.filter(n => n.parentId === box.id).map(n => n.behavior?.slot ?? n.name); };
    assert.deepEqual(row({ hasPrefix: true, hasSuffix: true, value: '112' }), ['prefix', 'value', 'suffix']);
    assert.deepEqual(row({ hasPrefix: false, hasSuffix: true, value: '112' }), ['value', 'suffix']);
    assert.deepEqual(row({ hasPrefix: true, hasSuffix: false, value: '112' }), ['prefix', 'value']);
});
