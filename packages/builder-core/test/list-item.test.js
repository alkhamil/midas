// List Item: one row with an optional leading icon, a content column (title, and a description while it is not empty) and an optional trailing icon.
// Size is the one variable dimension; selected and disabled are persistent states; hover is the one preview state.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { generateComponent, componentNameOf } from '../src/behavior-engine/codegen.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const item = TEMPLATES.get('antd-list-item');
const model = modelFor(item);

/** The layers of an instance under these props, root excluded, by their anatomy id (a slot's behavior key). */
const slotsOf = props => instanceFor(model, props).slice(1).map(n => n.behavior?.slot ?? n.name);

test('List Item is registered, valid, and takes Size from the variable collection, the rest from literals', () => {
    assert.ok(item, 'List Item is in the registry');
    assert.equal(item.name, 'List Item');
    assert.deepEqual(validateTemplateSchema(item, { templateIds: new Set(TEMPLATES.keys()) }), []);
    assert.deepEqual(Object.keys(item.props).sort(), ['description', 'disabled', 'hasLeading', 'hasTrailing', 'leading', 'selected', 'size', 'title', 'trailing']);
    assert.equal(item.props.size.source, 'variable');
    for (const [name, def] of Object.entries(item.props)) if (name !== 'size') assert.equal(def.source, 'literal', `${name} is a literal`);
});

test('the title is always drawn; the description shows while it is not empty', () => {
    assert.ok(slotsOf({ title: 'Ada', description: '' }).includes('title'));
    assert.ok(!slotsOf({ title: 'Ada', description: '' }).includes('description'), 'an empty description asks for no layer');
    assert.ok(slotsOf({ title: 'Ada', description: 'Admin' }).includes('description'));
});

test('the leading and trailing icons show by hasLeading and hasTrailing', () => {
    const off = slotsOf({ hasLeading: false, hasTrailing: false });
    assert.ok(!off.includes('leading') && !off.includes('trailing'));
    const on = slotsOf({ hasLeading: true, hasTrailing: true });
    assert.ok(on.includes('leading') && on.includes('trailing'));
});

test('the content column holds the title and the description; the icons sit beside it', () => {
    const nodes = instanceFor(model, { title: 'Ada', description: 'Admin', hasLeading: true, hasTrailing: true });
    const content = nodes.find(n => n.name === 'content');
    assert.ok(content, 'the content column is there');
    const inside = nodes.filter(n => n.parentId === content.id).map(n => n.behavior?.slot ?? n.name);
    assert.deepEqual(inside, ['title', 'description']);
    const row = nodes.filter(n => n.parentId === nodes[0].id).map(n => n.behavior?.slot ?? n.name);
    assert.deepEqual(row, ['leading', 'content', 'trailing']);
});

test('selected and disabled are persistent states; hover is the one preview state', () => {
    assert.deepEqual(Object.keys(item.persistentStates).sort(), ['disabled', 'selected']);
    assert.deepEqual(Object.keys(item.previewStates), ['hover']);
    assert.equal(item.statePseudo.selected, '[data-selected]');
    assert.equal(item.element.disabledState, 'disabled');
});

test('the export draws the title and description, and the icons when they are on', () => {
    const files = generateComponent(item, model.binding, model.variables, componentNameOf(item), model.frame, () => []).files;
    const jsx = files['ListItem.jsx'];
    assert.match(jsx, /className="antd-list-item-title"/);
    assert.match(jsx, /className="antd-list-item-description"/);
});
