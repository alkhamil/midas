// Tag (antd Tag): a label, an optional leading icon (hasIcon) and an optional close icon (closable), in a box whose fill, border and text come from the
// Color preset and the Variant (filled, solid, outlined). Each optional layer is made while its prop is on and removed while it is off; the label is always there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { modelFor, instanceFor } from './helpers/box-template.js';
import { COLOR_PRESETS } from '../src/templates/color-presets.js';
import { iconDefsOf, createdIconDefaults } from '../src/behavior-engine/anatomy.js';

const tag = TEMPLATES.get('antd-tag');
const model = tag && modelFor(tag);

/** The names of the layers an instance holds under these props (the root is not one of them). */
const layers = props => instanceFor(model, props).slice(1).map(n => n.name);

test('Tag is registered: a non-control whose primary slot is the label, with the props it declares', () => {
    assert.ok(tag, 'Tag is in the registry');
    assert.equal(tag.isControl, undefined);
    assert.equal(tag.primarySlot, 'label');
    assert.deepEqual(Object.keys(tag.props).sort(), ['closable', 'closeIcon', 'color', 'hasIcon', 'icon', 'label', 'size', 'variant']);
    assert.deepEqual(tag.props.color.modes, COLOR_PRESETS);
    assert.deepEqual(tag.props.variant.modes, ['filled', 'solid', 'outlined']);
});

test('the label is always a layer of an instance, with no switch', () => {
    assert.ok(layers({}).includes('label'));
    assert.ok(layers({ hasIcon: true, closable: true }).includes('label'));
});

test('hasIcon adds the leading icon layer while on and removes it while off', () => {
    assert.ok(!layers({}).includes('icon'), 'off: no icon layer');
    assert.ok(layers({ hasIcon: true }).includes('icon'), 'on: the icon layer');
});

test('closable adds the close icon layer while on and removes it while off', () => {
    assert.ok(!layers({}).includes('close'), 'off: no close layer');
    assert.ok(layers({ closable: true }).includes('close'), 'on: the close layer');
});

test('both props together give both layers, with exactly one layer per optional part', () => {
    const names = layers({ hasIcon: true, closable: true });
    assert.equal(names.filter(n => n === 'icon').length, 1);
    assert.equal(names.filter(n => n === 'close').length, 1);
    assert.equal(names.filter(n => n === 'label').length, 1);
});

test('the close icon takes the close glyph of the file when it has one; a file with none falls back to the default icon', () => {
    const closeDef = iconDefsOf(tag).find(d => d.slot === 'close');
    assert.equal(closeDef.role, 'close', 'the close def names the close role');
    const withClose = createdIconDefaults(tag, { closable: true }, 'def-circle', { close: 'icon-close' });
    assert.equal(withClose.closeIcon, 'icon-close');
    assert.equal(createdIconDefaults(tag, { closable: true }, 'def-circle', {}).closeIcon, 'def-circle');
});
