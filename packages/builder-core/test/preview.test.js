import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewOf } from '../src/behavior-engine/preview.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';

const button = TEMPLATES.get('button');
const sizeColl = { id: 'c-size', name: 'Size', modes: [{ id: 'sm', name: 'Small' }] };
const variantColl = { id: 'c-variant', name: 'Variant', modes: [{ id: 'primary', name: 'Primary' }] };
const num = (id, name, collectionId, values) => ({ id, name, type: 'number', collectionId, values });
const col = (id, name, collectionId, values) => ({ id, name, type: 'color', collectionId, values });
const sizeItems = () => [
    num('i-fs', 'fontSize', 'c-size', { sm: 14 }),
    num('i-lh', 'lineHeight', 'c-size', { sm: 1.4 }),
    num('i-px', 'paddingX', 'c-size', { sm: 12 }),
    num('i-py', 'paddingY', 'c-size', { sm: 6 }),
    num('i-gap', 'gap', 'c-size', { sm: 6 }),
    num('i-radius', 'radius', 'c-size', { sm: 6 }),
    num('i-icon', 'iconSize', 'c-size', { sm: 14 }),
];
const variantItems = (over = {}) => ({
    bg: '#4338ca',
    'bg-hover': '#3730a3',
    'bg-active': '#312e81',
    'bg-disabled': '#a5b4fc',
    fg: '#ffffff',
    border: '#4338ca',
    ...over,
});
const variantsOf = values => Object.entries(values).map(([name, value]) => col(`i-${name}`, name, 'c-variant', { primary: value }));
const variables = (values = variantItems()) => ({
    collections: [sizeColl, variantColl],
    items: [...sizeItems(), ...variantsOf(values)],
});
const binding = () => ({ version: 1, templateId: 'button', variables: { size: 'c-size', variant: 'c-variant' } });
const stored = (over = {}) => ({ size: 'sm', variant: 'primary', ...over });
const reasonsOf = result => Object.fromEntries(result.unresolved.map(u => [u.token, u.reason]));

test('the default state draws the base colour of the variant', () => {
    const { vars } = previewOf(button, binding(), stored(), variables(), 'default');
    assert.equal(vars['--button-bg'], '#4338ca');
});

test('hover draws the hover colour, and only the colours it overrides change', () => {
    const base = previewOf(button, binding(), stored(), variables(), 'default').vars;
    const { vars } = previewOf(button, binding(), stored(), variables(), 'hover');
    assert.equal(vars['--button-bg'], '#3730a3');
    assert.equal(vars['--button-fg'], base['--button-fg']);
    assert.equal(vars['--button-border'], base['--button-border']);
    assert.equal(vars['--button-font-size'], base['--button-font-size']);
});

test('active draws the active colour', () => {
    const { vars } = previewOf(button, binding(), stored(), variables(), 'active');
    assert.equal(vars['--button-bg'], '#312e81');
});

test('a disabled instance draws the disabled colour, whatever state is asked for', () => {
    const { vars } = previewOf(button, binding(), stored({ disabled: true }), variables(), 'hover');
    assert.equal(vars['--button-bg'], '#a5b4fc');
});

test('focus and loading draw the default colour', () => {
    assert.equal(previewOf(button, binding(), stored(), variables(), 'focus').vars['--button-bg'], '#4338ca');
    assert.equal(previewOf(button, binding(), stored({ loading: true }), variables(), 'default').vars['--button-bg'], '#4338ca');
});

test('a missing state token leaves the base colour out, and is reported, never replaced by the base colour', () => {
    const values = variantItems();
    delete values['bg-hover'];
    const result = previewOf(button, binding(), stored(), variables(values), 'hover');
    assert.equal('--button-bg' in result.vars, false);
    assert.equal(reasonsOf(result)['bg-hover'], 'no-variable');
});

test('props are the resolved values of the stored props', () => {
    const { props } = previewOf(button, binding(), stored({ label: 'Save' }), variables(), 'default');
    assert.equal(props.label, 'Save');
    assert.equal(props.disabled, false);
    assert.equal(props.hasIcon, false);
});

test('a state the template does not have is refused', () => {
    assert.throws(() => previewOf(button, binding(), stored(), variables(), 'pressed'), /unknown state "pressed"/);
});
