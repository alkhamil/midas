import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTokens, variableIdNamed, ratioVariableOf } from '../src/behavior-engine/tokens.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { buttonModel } from '../../../scripts/button-model.mjs';

const button = TEMPLATES.get('button');
const model = buttonModel({
    colors: ['primary', 'danger'],
    variantModes: ['solid', 'outlined'],
    sizeModes: [{ id: 'sm', name: 'Small' }, { id: 'lg', name: 'Large' }],
    sizeValues: {
        fontSize: { sm: 14, lg: 18 }, lineHeight: { sm: 1.5, lg: 1.5 }, paddingX: { sm: 12, lg: 16 }, paddingY: { sm: 6, lg: 8 },
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
    assert.equal(vars['--button-font-size'], '14px');
    assert.equal(vars['--button-line-height'], '1.5');
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
    const items = withItem('button/fontSize', i => ({ values: { ...i.values, xl: 20 } }));
    const { vars } = resolveTokens(button, binding(), modes({ size: 'xl' }), variables(items, [{ id: 'xl', name: 'Extra large' }]));
    assert.equal(vars['--button-font-size'], '20px');
});

test('an alias into the Color collection is read in the instance\'s Color mode', () => {
    assert.equal(resolveTokens(button, binding(), modes({ variant: 'solid', color: 'danger' }), variables()).vars['--button-bg'], '#dc2626');
});

test('a dimension with no bound collection reports every token of that dimension, and no value is invented', () => {
    const result = resolveTokens(button, binding({ size: null }), modes(), variables());
    assert.equal(result.unresolved.find(u => u.token === 'fontSize').reason, 'dimension-unbound');
    assert.equal(result.unresolved.filter(u => u.dimension === 'size').every(u => u.reason === 'dimension-unbound'), true);
    assert.equal('--button-font-size' in result.vars, false);
    assert.equal(result.vars['--button-bg'], '#4338ca');
});

test('each unresolved reason is reported for its token', () => {
    const without = name => baseItems().filter(i => i.name !== `button/${name}`);
    const cases = [
        ['collection-missing', resolveTokens(button, binding({ size: 'c-gone' }), modes(), variables()), 'fontSize'],
        ['no-mode-selected', resolveTokens(button, binding(), modes({ size: undefined }), variables()), 'fontSize'],
        ['mode-missing', resolveTokens(button, binding(), modes({ size: 'nope' }), variables()), 'fontSize'],
        ['no-variable', resolveTokens(button, binding(), modes(), variables(without('gap'))), 'gap'],
        ['no-value-in-mode', resolveTokens(button, binding(), modes({ size: 'lg' }), variables(withItem('button/fontSize', () => ({ values: { sm: 14 } })))), 'fontSize'],
        ['ambiguous', resolveTokens(button, binding(), modes(), variables([...baseItems(), { id: 'dup-gap', name: 'button/gap', type: 'number', collectionId: model.ids.size, values: { sm: 1, lg: 1 } }])), 'gap'],
        ['type-mismatch', resolveTokens(button, binding(), modes(), variables(withItem('button/fontSize', () => ({ type: 'color' })))), 'fontSize'],
        ['alias-missing', resolveTokens(button, binding(), modes(), variables(withItem('button/border', () => ({ values: { solid: { alias: 'nope' }, outlined: '#ffffff' } })))), 'border'],
        ['alias-cycle', resolveTokens(button, binding(), modes(), variables(withItem('button/bg', () => ({ values: { solid: { alias: 'v-border' }, outlined: '#ffffff' } })).map(i => (i.id === 'v-border' ? { ...i, values: { solid: { alias: 'v-bg' }, outlined: '#ffffff' } } : i)))), 'border'],
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
    assert.equal(keys.length, 39);
    assert.equal(keys[0], '--button-height');
    assert.equal(keys[8], '--button-bg');
    assert.equal(keys[20], '--button-color');
});

test('a colour alias with its own opacity fades the aliased colour, the way the editor draws it', () => {
    const items = withItem('button/border', () => ({ values: { solid: { alias: 'c-color', opacity: 50 }, outlined: '#ffffff' } }));
    assert.equal(resolveTokens(button, binding(), modes(), variables(items)).vars['--button-border'], '#4338ca80');
});

test('a value of the wrong form for its kind is reported as invalid, not written', () => {
    const items = baseItems().map(i => (i.name === 'button/fontSize' ? { ...i, values: { sm: 'big', lg: 18 } } : i.name === 'button/bg' ? { ...i, values: { solid: 12, outlined: '#ffffff' } } : i));
    const result = resolveTokens(button, binding(), modes(), variables(items));
    assert.equal(reasonsOf(result).fontSize, 'invalid-value');
    assert.equal(reasonsOf(result).bg, 'invalid-value');
    assert.equal('--button-font-size' in result.vars, false);
});

test('a variable is found by name the way a token is matched: case and dashes do not count', () => {
    const items = [{ id: 's-iconSize', name: 'button/iconSize', collectionId: 'c-size' }];
    assert.equal(variableIdNamed(items, 'c-size', 'button/icon-size'), 's-iconSize');
    assert.equal(variableIdNamed(items, 'c-size', 'Button/ICON-SIZE'), 's-iconSize');
    assert.equal(variableIdNamed(items, 'c-other', 'button/icon-size'), null);
    assert.equal(variableIdNamed(items, 'c-size', 'button/icon-size-x'), null);
});

test('a variable is a ratio token when a template names it so: the Button line height is a unitless ratio, not pixels', () => {
    assert.equal(ratioVariableOf({ name: 'button/lineHeight' }), true);
    assert.equal(ratioVariableOf({ name: 'Button/Line-Height' }), true);
    assert.equal(ratioVariableOf({ name: 'button/fontSize' }), false);
    assert.equal(ratioVariableOf({ name: 'lineHeight' }), false);
});
