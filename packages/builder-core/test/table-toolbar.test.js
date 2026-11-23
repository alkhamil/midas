// Table Toolbar: a title and a selected count (managed texts), then a search field and the actions (content slots, each shown by its switch).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const toolbar = TEMPLATES.get('table-toolbar');
const model = modelFor(toolbar);
const slotsOf = props => instanceFor(model, props).slice(1).map(n => n.behavior?.slot ?? n.name);

test('Table Toolbar is registered, valid, and takes Size from the variable collection, the rest from literals', () => {
    assert.ok(toolbar, 'Table Toolbar is in the registry');
    assert.deepEqual(validateTemplateSchema(toolbar, { templateIds: new Set(TEMPLATES.keys()) }), []);
    assert.equal(toolbar.props.size.source, 'variable');
    for (const [name, def] of Object.entries(toolbar.props)) if (name !== 'size') assert.equal(def.source, 'literal', `${name} is a literal`);
});

test('the title and the selected count are drawn while their text is not empty', () => {
    assert.ok(slotsOf({ title: 'Users', selectedText: '' }).includes('title'));
    assert.ok(!slotsOf({ title: '', selectedText: '' }).includes('title'));
    assert.ok(slotsOf({ title: 'Users', selectedText: '2 selected' }).includes('selectedText'));
    assert.ok(!slotsOf({ title: 'Users', selectedText: '' }).includes('selectedText'));
});

test('the search field and the actions are shown by their switches, off by default', () => {
    assert.deepEqual(toolbar.slots.find(s => s.id === 'search').shownWhen, { prop: 'hasSearch', is: true });
    assert.deepEqual(toolbar.slots.find(s => s.id === 'actions').shownWhen, { prop: 'hasActions', is: true });
    assert.equal(toolbar.props.hasSearch.default, false);
    assert.equal(toolbar.props.hasActions.default, false);
});

test('the search holds only a Search Field and the actions only Buttons or Icon Buttons', () => {
    const search = toolbar.slots.find(s => s.id === 'search');
    const actions = toolbar.slots.find(s => s.id === 'actions');
    assert.deepEqual(search.accepts, ['antd-search']);
    assert.deepEqual(actions.accepts, ['button', 'icon-button']);
    assert.equal(search.onlyAccepts, true);
    assert.equal(actions.onlyAccepts, true);
});
