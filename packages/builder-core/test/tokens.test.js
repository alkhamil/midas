import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTokens, variableIdNamed } from '../src/behavior-engine/tokens.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { buttonModel } from '../../../scripts/button-model.mjs';

const button = TEMPLATES.get('button');
const model = buttonModel({
    colors: ['primary', 'danger'],
    variantModes: ['solid', 'outlined'],
    sizeModes: [{ id: 'sm', name: 'Small' }, { id: 'lg', name: 'Large' }],
    sizeValues: {
        paddingX: { sm: 12, lg: 16 }, paddingY: { sm: 6, lg: 8 },
        gap: { sm: 6, lg: 8 }, radius: { sm: 6, lg: 8 }, iconSize: { sm: 14, lg: 16 },
    },
});
const baseItems = () => model.items;
const variables = (items = baseItems(), extraModes = []) => ({
    collections: model.collections.map(c => (c.id === model.ids.size ? { ...c, modes: [...c.modes, ...extraModes] } : c)),
    items,
});
const binding = (over = {}) => ({ ...model.binding, variables: { ...model.binding.variables, ...over } });
const modes = (over = {}) => ({ size: 'sm', variant: 'solid', color: 'primary', ...over });
const reasonsOf = result => Object.fromEntries(result.unresolved.map(u => [u.token, u.reason]));
const withItem = (name, change) => baseItems().map(i => (i.name === name ? { ...i, ...change(i) } : i));

test('size, variant and colour tokens resolve to CSS custom properties, with the stored form of each value', () => {
    const { vars, unresolved } = resolveTokens(button, binding(), modes(), variables());
    assert.equal(vars['--button-label-typography-font-family'], 'Inter');
    assert.equal(vars['--button-label-typography-font-size'], '12px');
    assert.equal(vars['--button-label-typography-font-weight'], '400');
    assert.equal(vars['--button-label-typography-line-height'], '16px');
    assert.equal(vars['--button-label-typography-letter-spacing'], '0px');
    assert.equal(vars['--button-padding-x'], '12px');
    assert.equal(vars['--button-bg'], '#4338ca');
    assert.equal(vars['--button-fg'], '#ffffff');
    assert.equal(vars['--button-border'], '#00000000');
    assert.equal(vars['--button-bg-hover'], '#3730a3');
    assert.equal(vars['--button-bg-active'], '#312e81');
    assert.equal(vars['--button-color'], '#4338ca');
    assert.deepEqual(unresolved, []);
});

test('a custom size mode resolves with no special handling', () => {
    const items = withItem('labelTypography', i => ({ values: { ...i.values, xl: { alias: 'ts-textXl' } } }));
    const { vars } = resolveTokens(button, binding(), modes({ size: 'xl' }), variables(items, [{ id: 'xl', name: 'Extra large' }]));
    assert.equal(vars['--button-label-typography-font-size'], '20px');
    assert.equal(vars['--button-label-typography-line-height'], '28px');
});

test('an alias into the Color collection is read in the instance\'s Color mode', () => {
    assert.equal(resolveTokens(button, binding(), modes({ variant: 'solid', color: 'danger' }), variables()).vars['--button-bg'], '#dc2626');
});

test('a dimension with no bound collection reports every token of that dimension, and no value is invented', () => {
    const result = resolveTokens(button, binding({ size: null }), modes(), variables());
    assert.equal(result.unresolved.find(u => u.token === 'labelTypography').reason, 'dimension-unbound');
    assert.equal(result.unresolved.filter(u => u.dimension === 'size').every(u => u.reason === 'dimension-unbound'), true);
    assert.equal('--button-label-typography-font-size' in result.vars, false);
    assert.equal(result.vars['--button-bg'], '#4338ca');
});

test('each unresolved reason is reported for its token', () => {
    const without = name => baseItems().filter(i => i.name !== `${name}`);
    const cases = [
        ['collection-missing', resolveTokens(button, binding({ size: 'c-gone' }), modes(), variables()), 'labelTypography'],
        ['no-mode-selected', resolveTokens(button, binding(), modes({ size: undefined }), variables()), 'labelTypography'],
        ['mode-missing', resolveTokens(button, binding(), modes({ size: 'nope' }), variables()), 'labelTypography'],
        ['no-variable', resolveTokens(button, binding(), modes(), variables(without('gap'))), 'gap'],
        ['no value in this mode', resolveTokens(button, binding(), modes({ size: 'lg' }), variables(withItem('labelTypography', () => ({ values: {} })))), 'labelTypography'],
        ['ambiguous', resolveTokens(button, binding(), modes(), variables([...baseItems(), { id: 'dup-gap', name: 'gap', type: 'number', collectionId: model.ids.size, values: { sm: 1, lg: 1 } }])), 'gap'],
        ['type-mismatch', resolveTokens(button, binding(), modes(), variables(withItem('labelTypography', () => ({ type: 'color' })))), 'labelTypography'],
        ['alias-missing', resolveTokens(button, binding(), modes(), variables(withItem('border', () => ({ values: { solid: { alias: 'nope' }, outlined: '#ffffff' } })))), 'border'],
        ['alias-cycle', resolveTokens(button, binding(), modes(), variables(withItem('bg', () => ({ values: { solid: { alias: 'v-border' }, outlined: '#ffffff' } })).map(i => (i.id === 'v-border' ? { ...i, values: { solid: { alias: 'v-bg' }, outlined: '#ffffff' } } : i)))), 'border'],
    ];
    for (const [reason, result, token] of cases) {
        assert.equal(reasonsOf(result)[token], reason, `${token} should be ${reason}`);
        assert.equal(result.vars[`--button-${token.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}`], undefined, `${token} is not guessed`);
    }
});

test('a token the resolver has no kind for is reported, not guessed', () => {
    const extended = structuredClone(button);
    extended.tokens.fromVariant = [...extended.tokens.fromVariant, 'shadow'];
    assert.equal(reasonsOf(resolveTokens(extended, binding(), modes(), variables())).shadow, 'no-kind');
});

test('the same inputs give the same output, in token order: size, then variant, then colour', () => {
    const first = resolveTokens(button, binding(), modes(), variables());
    const second = resolveTokens(button, binding(), modes(), variables());
    assert.deepEqual(second, first);
    const keys = Object.keys(first.vars);
    assert.equal(keys.length, 44);
    assert.equal(keys[0], '--button-height');
    assert.equal(keys[11], '--button-bg');
    assert.equal(keys[23], '--button-outline-color-active');
    assert.equal(keys[25], '--button-color');
});

test('a colour alias with its own opacity fades the aliased colour, the way the editor draws it', () => {
    const items = withItem('border', () => ({ values: { solid: { alias: 'c-color', opacity: 50 }, outlined: '#ffffff' } }));
    assert.equal(resolveTokens(button, binding(), modes(), variables(items)).vars['--button-border'], '#4338ca80');
});

test('a value of the wrong form for its kind is reported as invalid, not written', () => {
    const items = baseItems().map(i => (i.name === 'labelTypography' ? { ...i, values: { sm: { fontFamily: 'Inter', fontSize: 'big', fontWeight: 'Regular', lineHeight: 16, letterSpacing: 0 }, lg: { alias: 'ts-textLg' } } } : i.name === 'bg' ? { ...i, values: { solid: 12, outlined: '#ffffff' } } : i));
    const result = resolveTokens(button, binding(), modes(), variables(items));
    assert.equal(reasonsOf(result).labelTypography, 'fontSize has no number value');
    assert.equal(reasonsOf(result).bg, 'invalid-value');
    assert.equal('--button-label-typography-font-size' in result.vars, false);
});

test('a variable is found by name the way a token is matched: case and dashes do not count', () => {
    const items = [{ id: 's-iconSize', name: 'iconSize', collectionId: 'c-size' }];
    assert.equal(variableIdNamed(items, 'c-size', 'icon-size'), 's-iconSize');
    assert.equal(variableIdNamed(items, 'c-size', 'ICON-SIZE'), 's-iconSize');
    assert.equal(variableIdNamed(items, 'c-other', 'icon-size'), null);
    assert.equal(variableIdNamed(items, 'c-size', 'icon-size-x'), null);
});
