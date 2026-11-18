// Empty: a centred placeholder. An image (the file's default icon, shown by hasImage), a description (a managed text, made while it is not empty) and an
// action (a content slot of a Button or Link, shown by hasAction). Every size is a token of the Size mode.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { modelFor, instanceFor } from './helpers/box-template.js';
import { SIZE_MODES } from '../src/templates/size-modes.js';

const empty = TEMPLATES.get('antd-empty');
const model = modelFor(empty);

/** The layers of an instance under these props, root excluded, by their anatomy id (a slot's behavior key). */
const slotsOf = props => instanceFor(model, props).slice(1).map(n => n.behavior?.slot ?? n.name);

test('Empty is registered, valid, and holds an image, a description and an action', () => {
    assert.ok(empty, 'Empty is in the registry');
    assert.equal(empty.name, 'Empty');
    assert.deepEqual(validateTemplateSchema(empty, { templateIds: new Set(TEMPLATES.keys()) }), []);
    assert.deepEqual(Object.keys(empty.props).sort(), ['description', 'hasAction', 'hasImage', 'icon', 'size']);
    assert.deepEqual(empty.props.size.modes, SIZE_MODES);
    assert.equal(empty.props.description.default, 'No Data');
    assert.deepEqual(empty.slots.map(s => s.id), ['action']);
    assert.deepEqual(empty.slots[0].accepts, ['button', 'antd-link']);
});

test('the image shows by hasImage; the description shows while it is not empty', () => {
    assert.ok(slotsOf({ hasImage: true, description: 'No Data' }).includes('icon'));
    assert.ok(!slotsOf({ hasImage: false, description: 'No Data' }).includes('icon'));
    assert.ok(slotsOf({ description: 'Nothing here' }).includes('description'));
    assert.ok(!slotsOf({ description: '' }).includes('description'), 'an empty description asks for no layer');
});

test('the action is an instance slot that shows only while hasAction is on', () => {
    assert.deepEqual(empty.slots[0].shownWhen, { prop: 'hasAction', is: true });
});

test('the action starts with a Button, is required, and is not drawn empty', () => {
    const action = empty.slots[0];
    assert.deepEqual(action.seed, [{ template: 'button', props: { label: 'Action' }, follow: { size: 'size' } }]);
    assert.equal(action.required, true, 'Play says when it is empty');
    assert.equal(action.showEmpty, undefined, 'an empty action takes no space in Play');
});
