// Alert (antd Alert): a type icon, a message, an optional description and close, and an optional action in a content slot. Each optional layer is made while
// its prop is on and removed while it is off; the message is always there. The type icon takes its type's glyph and follows the type until the user picks one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { modelFor, instanceFor } from './helpers/box-template.js';
import { iconRoleOf, iconRolesOf } from '../src/behavior-engine/icon-set.js';
import { ICON_SET } from '../src/behavior-engine/icon-set.js';
import { iconDefsOf, createdIconDefaults, newlyShownIconDefaults } from '../src/behavior-engine/anatomy.js';

const alert = TEMPLATES.get('antd-alert');
const model = alert && modelFor(alert);

/** The names of the layers an instance holds under these props (the root is not one of them). */
const layers = props => instanceFor(model, props).slice(1).map(n => n.name);

const ROLES = { alertSuccess: 'icon-success', alertInfo: 'icon-info', alertWarning: 'icon-warning', alertError: 'icon-error', close: 'icon-close' };

test('Alert is registered with the props it declares, the Type modes and a Button action slot', () => {
    assert.ok(alert, 'Alert is in the registry');
    assert.equal(alert.primarySlot, 'label');
    assert.deepEqual(Object.keys(alert.props).sort(), ['action', 'banner', 'closable', 'closeIcon', 'description', 'descriptionText', 'fillWidth', 'fills', 'icon', 'iconShown', 'label', 'showIcon', 'size', 'type', 'variant']);
    assert.deepEqual(alert.props.type.modes, ['success', 'info', 'warning', 'error']);
    assert.equal(alert.props.type.defaultMode, 'info');
    assert.equal(alert.props.showIcon.default, true);
    assert.equal(alert.props.closable.default, false);
    assert.equal(alert.props.banner.default, false);
    assert.deepEqual(alert.slots.map(s => [s.id, s.accepts]), [['actionButton', ['button']]]);
});

test('the message is always a layer of an instance, with no switch', () => {
    assert.ok(layers({}).includes('label'));
    assert.ok(layers({ showIcon: false, closable: true, description: true }).includes('label'));
});

test('showIcon adds the type icon layer while on and removes it while off', () => {
    assert.ok(!layers({ showIcon: false }).includes('icon'), 'off: no icon layer');
    assert.ok(layers({}).includes('icon'), 'on (the default): the icon layer');
});

test('closable adds the close layer while on and removes it while off', () => {
    assert.ok(!layers({}).includes('close'), 'off: no close layer');
    assert.ok(layers({ closable: true }).includes('close'), 'on: the close layer');
});

test('description adds the description layer while on and removes it while off', () => {
    assert.ok(!layers({}).includes('description'), 'off: no description layer');
    assert.ok(layers({ description: true }).includes('description'), 'on: the description layer');
});

test('the type icon takes the glyph of its type; the close takes the close glyph', () => {
    const typeDef = iconDefsOf(alert).find(d => d.slot === 'icon');
    assert.deepEqual(typeDef.role, { prop: 'type', map: { success: 'alertSuccess', info: 'alertInfo', warning: 'alertWarning', error: 'alertError' } });
    assert.equal(iconRoleOf(typeDef, { type: 'error' }), 'alertError');
    assert.equal(createdIconDefaults(alert, { showIcon: true }, 'icon-default', ROLES, { type: 'warning' }).icon, 'icon-warning');
    assert.equal(createdIconDefaults(alert, { showIcon: true }, 'icon-default', {}, { type: 'warning' }).icon, 'icon-default', 'a file with no glyph falls back to the default icon');
    assert.equal(createdIconDefaults(alert, { showIcon: true, closable: true }, 'icon-default', ROLES, { type: 'info' }).closeIcon, 'icon-close');
});

test('a type change swaps the glyph the slot holds while it is a type glyph, and keeps one the user picked', () => {
    const before = { showIcon: true, icon: 'icon-info' };
    assert.equal(newlyShownIconDefaults(alert, before, before, 'icon-default', ROLES, { type: 'error' }).icon, 'icon-error');
    const picked = { showIcon: true, icon: 'icon-custom' };
    assert.deepEqual(newlyShownIconDefaults(alert, picked, picked, 'icon-default', ROLES, { type: 'error' }), {});
});

test('the Alert type glyph roles are in the icon set, one per type', () => {
    const names = ICON_SET.map(e => e.role);
    for (const role of ['alertSuccess', 'alertInfo', 'alertWarning', 'alertError']) assert.ok(names.includes(role), role);
    assert.ok(iconRolesOf([alert]).includes('alertError'));
});

test('action is a Button layer while the prop is on: the plan adds it when on and removes it when off', async () => {
    const { planAnatomy } = await import('../src/behavior-engine/anatomy.js');
    const { resolveProps } = await import('../src/behavior-engine/instance-props.js');
    const on = planAnatomy(alert, resolveProps(alert, { action: true }), []);
    assert.ok(on.some(op => op.op === 'insert' && op.slot === 'actionBox'), 'on: the Action box is inserted');
    const off = planAnatomy(alert, resolveProps(alert, { action: false }), [{ id: 'action-layer', slot: 'actionBox', name: 'Action', component: null }]);
    assert.deepEqual(off.filter(op => op.op === 'remove').map(op => op.id), ['action-layer'], 'off: the Action box is removed');
});

test('the master holds no Action layer at the sample props (action off)', () => {
    assert.equal(layers({ action: false }).includes('Action'), false);
});

test('banner fills the width of the root and draws no radius and no border; showIcon is on by default with it', async () => {
    const { literalFields } = await import('../src/behavior-engine/display.js');
    const { resolveProps } = await import('../src/behavior-engine/instance-props.js');
    const sizing = props => literalFields(alert, resolveProps(alert, props)).find(w => w.key === 'root' && w.field === 'widthSizing')?.value;
    assert.equal(sizing({ banner: true }), 'fill');
    assert.equal(sizing({ banner: false }), 'fill', 'an Alert fills its container by default');
    assert.equal(sizing({ banner: false, fillWidth: false }), 'hug');
    assert.equal(sizing({ banner: true, fillWidth: false }), 'fill', 'a banner always fills');
    assert.equal(resolveProps(alert, { banner: true }).showIcon, true);
    assert.equal(alert.persistentStates.banner.marker, true);
    assert.deepEqual(alert.persistentStates.banner.tokens, { radius: 'radiusNone', borderWidth: 'borderWidthNone' });
});

test('the icon swaps to its large size with a description (a persistent state on the size token)', () => {
    assert.deepEqual(alert.persistentStates.withDescription.tokens, { labelTypography: 'titleTypography', iconSize: 'iconSizeLarge', paddingX: 'paddingXLarge', paddingY: 'paddingYLarge', gap: 'gapLarge' });
    assert.ok(alert.tokenRoles.iconSizeLarge && alert.tokenKinds.iconSizeLarge === 'length');
});

test('a description aligns the icon and the close to the top; without one the row is centred', async () => {
    const { literalFields, fieldStyleOf } = await import('../src/behavior-engine/display.js');
    const { resolveProps } = await import('../src/behavior-engine/instance-props.js');
    const cross = props => literalFields(alert, resolveProps(alert, props)).find(w => w.key === 'root' && w.field === 'counterAlign')?.value;
    assert.equal(cross({ description: true }), 'start');
    assert.equal(cross({ description: false }), 'center');
    assert.equal(fieldStyleOf(alert, resolveProps(alert, { description: true })).attrs['data-description-cross'], 'start');
});

test('a banner shows its icon whatever showIcon says', async () => {
    const { resolveProps } = await import('../src/behavior-engine/instance-props.js');
    assert.equal(resolveProps(alert, { banner: true, showIcon: false }).iconShown, true);
    assert.equal(resolveProps(alert, { banner: false, showIcon: false }).iconShown, false);
    assert.ok(layers({ banner: true, showIcon: false }).includes('icon'));
});
