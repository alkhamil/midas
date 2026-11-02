// An icon slot that starts to show with no icon chosen takes the library's default icon, in the prop that holds it: a switch turned on, or a
// kind (Input's Text or Icon) changed to Icon. A slot that was already shown, or already holds an icon, is left alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { newlyShownIconDefaults } from '../src/behavior-engine/anatomy.js';

const input = TEMPLATES.get('input');
const button = TEMPLATES.get('button');
const DEFAULT = 'icon-default';

test('Input: a side whose kind becomes Icon takes the default icon, and nothing else does', () => {
    assert.deepEqual(newlyShownIconDefaults(input, { hasPrefix: true }, { hasPrefix: true, prefixKind: 'icon' }, DEFAULT), { prefixIcon: DEFAULT });
    assert.deepEqual(newlyShownIconDefaults(input, { hasSuffix: true }, { hasSuffix: true, suffixKind: 'icon' }, DEFAULT), { suffixIcon: DEFAULT });
});

test('Input: switching a side on takes the default icon only when its remembered kind is Icon', () => {
    assert.deepEqual(newlyShownIconDefaults(input, {}, { hasPrefix: true }, DEFAULT), {}, 'the Text kind needs no icon');
    assert.deepEqual(newlyShownIconDefaults(input, { prefixKind: 'icon' }, { hasPrefix: true, prefixKind: 'icon' }, DEFAULT), { prefixIcon: DEFAULT });
});

test('an icon already chosen is kept, when the kind comes back or the switch is turned on', () => {
    assert.deepEqual(newlyShownIconDefaults(input, { hasPrefix: true, prefixKind: 'text', prefixIcon: 'check' }, { hasPrefix: true, prefixKind: 'icon', prefixIcon: 'check' }, DEFAULT), {});
    assert.deepEqual(newlyShownIconDefaults(input, { prefixKind: 'icon', prefixIcon: 'check' }, { hasPrefix: true, prefixKind: 'icon', prefixIcon: 'check' }, DEFAULT), {});
});

test('a slot that was already shown is not filled again, so an icon cleared on purpose stays cleared', () => {
    assert.deepEqual(newlyShownIconDefaults(input, { hasPrefix: true, prefixKind: 'icon' }, { hasPrefix: true, prefixKind: 'icon', suffixKind: 'icon' }, DEFAULT), {});
});

test('the Text side of the other kind and the other side are not filled', () => {
    assert.deepEqual(newlyShownIconDefaults(input, { hasPrefix: true, hasSuffix: true }, { hasPrefix: true, hasSuffix: true, prefixKind: 'icon' }, DEFAULT), { prefixIcon: DEFAULT });
});

test('Allow Clear takes the default clear icon when it is switched on', () => {
    assert.deepEqual(newlyShownIconDefaults(input, {}, { allowClear: true }, DEFAULT), { clearIcon: DEFAULT });
    assert.deepEqual(newlyShownIconDefaults(input, { allowClear: true }, { allowClear: true, value: 'x' }, DEFAULT), {});
});

test('Button: the icon switch takes the default icon for the placed side only', () => {
    assert.deepEqual(newlyShownIconDefaults(button, {}, { hasIcon: true }, DEFAULT), { icon: DEFAULT });
    assert.deepEqual(newlyShownIconDefaults(button, {}, { hasIcon: true, iconPlacement: 'end' }, DEFAULT), { iconEnd: DEFAULT });
    assert.deepEqual(newlyShownIconDefaults(button, { hasIcon: true }, { hasIcon: true, iconPlacement: 'end' }, DEFAULT), { iconEnd: DEFAULT }, 'the end slot starts to show');
});

test('no default icon in the document gives no writes', () => {
    assert.deepEqual(newlyShownIconDefaults(input, { hasPrefix: true }, { hasPrefix: true, prefixKind: 'icon' }, null), {});
});
