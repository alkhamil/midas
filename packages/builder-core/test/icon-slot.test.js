import { test } from 'node:test';
import assert from 'node:assert/strict';
import { iconRuleOf, iconSlotBindings, iconSlotTargets, isIconCandidate, isIconSlotVarKey, missingIconVariable } from '../src/behavior-engine/icon-slot.js';
import { BUTTON } from '../src/templates/button.js';

const names = { colour: 'button/fg', disabledColour: 'button/fg-disabled', size: 'button/icon-size' };
const vars = { fg: 'v-fg', fgDisabled: 'v-fg-disabled', size: 'v-icon-size', names };

test('the icon variables are named from the template: its group and its icon tokens, with the dimension that holds them', () => {
    assert.deepEqual(iconSlotTargets(BUTTON, 'iconStart'), {
        colour: { name: 'button/fg', dimension: 'variant' },
        disabledColour: { name: 'button/fg-disabled', dimension: 'variant' },
        size: { name: 'button/icon-size', dimension: 'size' },
    });
});

test('the slot binds its width and height to the icon size variable', () => {
    assert.deepEqual(iconSlotBindings({ ...vars, disabled: false, layers: [] }).slot, { w: 'v-icon-size', h: 'v-icon-size' });
});

test('every visible fill of an icon layer binds to the foreground colour, by fill index', () => {
    const { layers } = iconSlotBindings({ ...vars, disabled: false, layers: [{ id: 'p1', fillIndexes: [0, 2], stroke: false }] });
    assert.deepEqual(layers, [{ id: 'p1', vars: { 'fills.0': 'v-fg', 'fills.2': 'v-fg' } }]);
});

test('a layer with no fill but a stroke binds its stroke to the foreground colour', () => {
    const { layers } = iconSlotBindings({ ...vars, disabled: false, layers: [{ id: 'p2', fillIndexes: [], stroke: true }] });
    assert.deepEqual(layers, [{ id: 'p2', vars: { stroke: 'v-fg' } }]);
});

test('a layer with neither a fill nor a stroke binds nothing', () => {
    const { layers } = iconSlotBindings({ ...vars, disabled: false, layers: [{ id: 'p3', fillIndexes: [], stroke: false }] });
    assert.deepEqual(layers, [{ id: 'p3', vars: {} }]);
});

test('disabled switches the icon colour to the disabled foreground', () => {
    const { layers } = iconSlotBindings({ ...vars, disabled: true, layers: [{ id: 'p1', fillIndexes: [0], stroke: false }] });
    assert.deepEqual(layers, [{ id: 'p1', vars: { 'fills.0': 'v-fg-disabled' } }]);
});

test('a missing variable is reported and nothing is guessed in its place', () => {
    const result = iconSlotBindings({ fg: null, fgDisabled: 'v-fg-disabled', size: null, disabled: false, names, layers: [{ id: 'p1', fillIndexes: [0], stroke: false }] });
    assert.deepEqual(result.missing, ['button/fg', 'button/icon-size']);
    assert.deepEqual(result.slot, {});
    assert.deepEqual(result.layers, [{ id: 'p1', vars: {} }]);
});

test('disabled with no disabled foreground variable is reported, never the plain foreground', () => {
    const result = iconSlotBindings({ fg: 'v-fg', fgDisabled: null, size: 'v-icon-size', disabled: true, names, layers: [{ id: 'p1', fillIndexes: [0], stroke: false }] });
    assert.deepEqual(result.missing, ['button/fg-disabled']);
    assert.deepEqual(result.layers, [{ id: 'p1', vars: {} }]);
});

test('the keys the icon slot owns are fills by index, stroke, and the slot size', () => {
    assert.equal(isIconSlotVarKey('fills.0'), true);
    assert.equal(isIconSlotVarKey('fills.12'), true);
    assert.equal(isIconSlotVarKey('stroke'), true);
    assert.equal(isIconSlotVarKey('w'), true);
    assert.equal(isIconSlotVarKey('h'), true);
    assert.equal(isIconSlotVarKey('fill'), false);
    assert.equal(isIconSlotVarKey('radius'), false);
});

test('a missing icon variable is named with the collection it was searched in and the mode of the instance', () => {
    assert.equal(
        missingIconVariable({ name: 'button/icon-size', collectionName: 'Size', modeName: 'Small' }),
        'button/icon-size in the Size collection (mode Small)',
    );
});

test('the button template declares its icon naming rule', () => {
    assert.deepEqual(iconRuleOf(BUTTON), { prefix: 'Icon/' });
    assert.equal(iconRuleOf({}), null);
});

test('an imported-style name matches the template rule', () => {
    const rule = iconRuleOf(BUTTON);
    assert.equal(isIconCandidate({ component: true, name: 'Icon/check' }, rule), true);
    assert.equal(isIconCandidate({ component: true, name: 'Icon/arrows/Arrow Left' }, rule), true);
});

test('a flagged component is an icon whatever its name', () => {
    const rule = iconRuleOf(BUTTON);
    assert.equal(isIconCandidate({ component: true, name: 'eye', isIcon: true }, rule), true);
    assert.equal(isIconCandidate({ componentSet: true, name: 'arrows', isIcon: true }, rule), true);
    assert.equal(isIconCandidate({ component: true, name: 'eye', isIcon: true }, null), true);
});

test('a plain layer is never an icon, and an unflagged odd name is not', () => {
    const rule = iconRuleOf(BUTTON);
    assert.equal(isIconCandidate({ type: 'frame', name: 'Icon/check' }, rule), false);
    assert.equal(isIconCandidate({ component: true, name: 'eye' }, rule), false);
    assert.equal(isIconCandidate(null, rule), false);
});
