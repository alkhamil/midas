import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTokens } from '../src/behavior-engine/tokens.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';

const button = TEMPLATES.get('button');
const sizeColl = { id: 'c-size', name: 'Size', modes: [{ id: 'sm', name: 'Small' }, { id: 'lg', name: 'Large' }] };
const variantColl = { id: 'c-variant', name: 'Variant', modes: [{ id: 'primary', name: 'Primary' }, { id: 'danger', name: 'Danger' }] };
const num = (id, name, collectionId, values) => ({ id, name, type: 'number', collectionId, values });
const col = (id, name, collectionId, values) => ({ id, name, type: 'color', collectionId, values });
const baseItems = () => [
    num('i-fs', 'button/fontSize', 'c-size', { sm: 14, lg: 18 }),
    num('i-lh', 'button/lineHeight', 'c-size', { sm: 1.5, lg: 1.5 }),
    num('i-px', 'button/paddingX', 'c-size', { sm: 12, lg: 16 }),
    num('i-py', 'button/paddingY', 'c-size', { sm: 6, lg: 8 }),
    num('i-gap', 'button/gap', 'c-size', { sm: 6, lg: 8 }),
    num('i-radius', 'button/radius', 'c-size', { sm: 6, lg: 8 }),
    num('i-icon', 'button/iconSize', 'c-size', { sm: 14, lg: 16 }),
    col('i-bg', 'button/bg', 'c-variant', { primary: '#4338ca', danger: '#dc2626' }),
    col('i-fg', 'button/fg', 'c-variant', { primary: '#ffffff', danger: '#ffffff' }),
    col('i-border', 'button/border', 'c-variant', { primary: { alias: 'i-bg' }, danger: '#dc2626' }),
    col('i-bg-hover', 'button/bg-hover', 'c-variant', { primary: '#3730a3', danger: '#b91c1c' }),
    col('i-bg-active', 'button/bg-active', 'c-variant', { primary: '#312e81', danger: '#991b1b' }),
    col('i-bg-disabled', 'button/bg-disabled', 'c-variant', { primary: '#a5b4fc', danger: '#fca5a5' }),
    col('i-fg-disabled', 'button/fg-disabled', 'c-variant', { primary: '#e0e7ff', danger: '#fee2e2' }),
    col('i-border-focus', 'button/border-focus', 'c-variant', { primary: '#818cf8', danger: '#f87171' }),
];
const variables = (items = baseItems(), extraModes = []) => ({
    collections: [{ ...sizeColl, modes: [...sizeColl.modes, ...extraModes] }, variantColl],
    items,
});
const binding = (over = {}) => ({ version: 2, templateId: 'button', variables: { size: 'c-size', variant: 'c-variant', ...over } });
const modes = (over = {}) => ({ size: 'sm', variant: 'primary', ...over });
const reasonsOf = result => Object.fromEntries(result.unresolved.map(u => [u.token, u.reason]));

test('size and variant tokens resolve to CSS custom properties, with the stored form of each value', () => {
    const { vars, unresolved } = resolveTokens(button, binding(), modes(), variables());
    assert.deepEqual(vars, {
        '--button-font-size': '14px',
        '--button-line-height': '1.5',
        '--button-padding-x': '12px',
        '--button-padding-y': '6px',
        '--button-gap': '6px',
        '--button-radius': '6px',
        '--button-icon-size': '14px',
        '--button-bg': '#4338ca',
        '--button-fg': '#ffffff',
        '--button-border': '#4338ca',
        '--button-bg-hover': '#3730a3',
        '--button-bg-active': '#312e81',
        '--button-bg-disabled': '#a5b4fc',
        '--button-fg-disabled': '#e0e7ff',
        '--button-border-focus': '#818cf8',
    });
    assert.deepEqual(unresolved, []);
});

test('a custom mode resolves with no special handling', () => {
    const items = baseItems().map(i => (i.id === 'i-fs' ? { ...i, values: { ...i.values, xl: 20 } } : i));
    const { vars } = resolveTokens(button, binding(), modes({ size: 'xl' }), variables(items, [{ id: 'xl', name: 'Extra large' }]));
    assert.equal(vars['--button-font-size'], '20px');
});

test('an alias resolves to the value it points at, in the same mode', () => {
    const { vars } = resolveTokens(button, binding(), modes({ variant: 'danger' }), variables());
    assert.equal(vars['--button-border'], '#dc2626');
});

test('a dimension with no bound collection reports every token of that dimension, and no value is invented', () => {
    const result = resolveTokens(button, binding({ size: null }), modes(), variables());
    assert.equal(reasonsOf(result).fontSize ?? result.unresolved.find(u => u.token === 'fontSize').reason, 'dimension-unbound');
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
        ['no-value-in-mode', resolveTokens(button, binding(), modes({ size: 'lg' }), variables(baseItems().map(i => (i.name === 'button/fontSize' ? { ...i, values: { sm: 14 } } : i)))), 'fontSize'],
        ['ambiguous', resolveTokens(button, binding(), modes(), variables([...baseItems(), num('i-gap2', 'button/gap', 'c-size', { sm: 1 })])), 'gap'],
        ['type-mismatch', resolveTokens(button, binding(), modes(), variables(baseItems().map(i => (i.name === 'button/fontSize' ? { ...i, type: 'color' } : i)))), 'fontSize'],
        ['alias-missing', resolveTokens(button, binding(), modes(), variables(baseItems().map(i => (i.name === 'button/border' ? { ...i, values: { primary: { alias: 'nope' }, danger: '#dc2626' } } : i)))), 'border'],
        ['alias-cycle', resolveTokens(button, binding(), modes(), variables(baseItems().map(i => (i.name === 'button/bg' ? { ...i, values: { primary: { alias: 'i-border' }, danger: '#dc2626' } } : i)))), 'border'],
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

test('the same inputs give the same output, in token order', () => {
    const first = resolveTokens(button, binding(), modes(), variables());
    const second = resolveTokens(button, binding(), modes(), variables());
    assert.deepEqual(second, first);
    assert.deepEqual(Object.keys(first.vars), [
        '--button-font-size', '--button-line-height', '--button-padding-x', '--button-padding-y', '--button-gap',
        '--button-radius', '--button-icon-size', '--button-bg', '--button-fg', '--button-border',
        '--button-bg-hover', '--button-bg-active', '--button-bg-disabled', '--button-fg-disabled', '--button-border-focus',
    ]);
});

test('a colour alias with its own opacity fades the aliased colour, the way the editor draws it', () => {
    const items = baseItems().map(i => (i.id === 'i-border' ? { ...i, values: { primary: { alias: 'i-bg', opacity: 50 }, danger: '#dc2626' } } : i));
    assert.equal(resolveTokens(button, binding(), modes(), variables(items)).vars['--button-border'], '#4338ca80');
});

test('a value of the wrong form for its kind is reported as invalid, not written', () => {
    const items = baseItems().map(i => (i.name === 'button/fontSize' ? { ...i, values: { sm: 'big', lg: 18 } } : i.name === 'button/bg' ? { ...i, values: { primary: 12, danger: '#dc2626' } } : i));
    const result = resolveTokens(button, binding(), modes(), variables(items));
    assert.equal(reasonsOf(result).fontSize, 'invalid-value');
    assert.equal(reasonsOf(result).bg, 'invalid-value');
    assert.equal('--button-font-size' in result.vars, false);
});

test('a token group with no variable prop of its dimension is reported, not guessed', () => {
    const extended = structuredClone(button);
    extended.tokens.fromWidth = ['gap'];
    const result = resolveTokens(extended, binding(), modes(), variables());
    assert.equal(result.unresolved.some(u => u.token === 'gap' && u.reason === 'no-dimension'), true);
});

test('a variable named with dashes is the camel-case token: button/icon-size resolves iconSize', () => {
    const items = baseItems().map(i => (i.name === 'button/iconSize' ? { ...i, name: 'button/icon-size', values: { sm: 14, lg: 18 } } : i));
    const { vars, unresolved } = resolveTokens(button, binding(), modes(), variables(items));
    assert.equal(vars['--button-icon-size'], '14px');
    assert.equal(unresolved.some(u => u.token === 'iconSize'), false);
    const large = resolveTokens(button, binding(), modes({ size: 'lg' }), variables(items));
    assert.equal(large.vars['--button-icon-size'], '18px');
});
