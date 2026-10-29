import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTokens } from '../src/behavior-engine/tokens.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';

// The Button model with a Color collection: Variant values alias into Color, and each is read in the instance's Color mode.
const base = TEMPLATES.get('button');
const button = {
    ...base,
    props: { ...base.props, color: { source: 'variable', collection: 'Color' } },
    tokens: { ...base.tokens, fromColor: ['color'] },
    tokenKinds: { ...base.tokenKinds, color: 'color' },
};
const sizeColl = { id: 'c-size', name: 'Size', modes: [{ id: 'sm', name: 'Small' }] };
const variantColl = { id: 'c-variant', name: 'Variant', modes: [{ id: 'solid', name: 'Solid' }, { id: 'outlined', name: 'Outlined' }] };
const colorColl = { id: 'c-color', name: 'Color', modes: [{ id: 'default', name: 'Default' }, { id: 'primary', name: 'Primary' }, { id: 'danger', name: 'Danger' }] };
const num = (id, name, collectionId, values) => ({ id, name, type: 'number', collectionId, values });
const col = (id, name, collectionId, values) => ({ id, name, type: 'color', collectionId, values });
const sizeItems = () => [num('i-fs', 'button/fontSize', 'c-size', { sm: 14 }), num('i-icon', 'button/iconSize', 'c-size', { sm: 14 })];
const colorItems = () => [
    col('i-color', 'button/color', 'c-color', { default: '#000000', primary: '#1677ff', danger: '#ff4d4f' }),
];
const variantItems = (over = {}) => [
    col('i-bg', 'button/bg', 'c-variant', { solid: { alias: 'i-color' }, outlined: '#ffffff', ...over.bg }),
    col('i-border', 'button/border', 'c-variant', { solid: { alias: 'i-color' }, outlined: { alias: 'i-color' }, ...over.border }),
    col('i-fg', 'button/fg', 'c-variant', { solid: '#ffffff', outlined: { alias: 'i-color' }, ...over.fg }),
];
const variables = (items = [...sizeItems(), ...colorItems(), ...variantItems()]) => ({
    collections: [sizeColl, variantColl, colorColl],
    items,
});
const binding = { version: 2, templateId: 'button', variables: { size: 'c-size', variant: 'c-variant', color: 'c-color' } };
const resolve = (modes, items) => resolveTokens(button, binding, { size: 'sm', ...modes }, variables(items)).vars;
const reasonsOf = (modes, items) => Object.fromEntries(resolveTokens(button, binding, { size: 'sm', ...modes }, variables(items)).unresolved.map(u => [u.token, u.reason]));

test('solid + primary: the background is the primary colour, read in the Color mode', () => {
    assert.equal(resolve({ variant: 'solid', color: 'primary' })['--button-bg'], '#1677ff');
});

test('solid + danger: the same Variant value follows the Color mode to the danger colour', () => {
    assert.equal(resolve({ variant: 'solid', color: 'danger' })['--button-bg'], '#ff4d4f');
});

test('outlined + danger: the border follows the danger colour, the background stays the variant\'s own', () => {
    const vars = resolve({ variant: 'outlined', color: 'danger' });
    assert.equal(vars['--button-border'], '#ff4d4f');
    assert.equal(vars['--button-bg'], '#ffffff');
});

test('the same variant under two colours resolves to two colours: the colour is read per mode, not once', () => {
    assert.equal(resolve({ variant: 'outlined', color: 'primary' })['--button-border'], '#1677ff');
    assert.equal(resolve({ variant: 'outlined', color: 'default' })['--button-border'], '#000000');
});

test('an unset Color mode reads the first Color mode (default)', () => {
    assert.equal(resolve({ variant: 'solid', color: undefined })['--button-bg'], '#000000');
});

test('a Color mode the alias target has no value for is reported, not guessed', () => {
    const items = [...sizeItems(), col('i-color', 'button/color', 'c-color', { default: '#000000', primary: '#1677ff' }), ...variantItems()];
    assert.equal(reasonsOf({ variant: 'solid', color: 'danger' }, items)['bg'], 'no-value-in-mode');
});

test('an alias that loops back into the Variant collection is a cycle, reported', () => {
    const items = [...sizeItems(), ...colorItems(), ...variantItems({ bg: { solid: { alias: 'i-border' } }, border: { solid: { alias: 'i-bg' } } })];
    assert.equal(reasonsOf({ variant: 'solid', color: 'primary' }, items)['bg'], 'alias-cycle');
});
