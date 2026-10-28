import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';

const button = TEMPLATES.get('button');
const sizeColl = { id: 'c-size', name: 'Size', modes: [{ id: 'sm', name: 'Small' }] };
const variantColl = { id: 'c-variant', name: 'Variant', modes: [{ id: 'primary', name: 'Primary' }, { id: 'danger', name: 'Danger' }] };
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
const variantItems = (skip = []) => [
    ['bg', { primary: '#4338ca', danger: '#dc2626' }],
    ['bg-hover', { primary: '#3730a3', danger: '#b91c1c' }],
    ['bg-active', { primary: '#312e81', danger: '#991b1b' }],
    ['bg-disabled', { primary: '#a5b4fc', danger: '#fca5a5' }],
    ['fg', { primary: '#ffffff', danger: '#ffffff' }],
    ['border', { primary: '#4338ca', danger: '#dc2626' }],
].filter(([name]) => !skip.includes(name)).map(([name, values]) => col(`i-${name}`, name, 'c-variant', values));
const variables = (skip = []) => ({
    collections: [sizeColl, variantColl],
    items: [...sizeItems(), ...variantItems(skip)],
});
const binding = (over = {}) => ({ version: 1, templateId: 'button', variables: { size: 'c-size', variant: 'c-variant', ...over } });

test('the component takes every prop of the schema, with the schema default', () => {
    const { files } = generateComponent(button, binding(), variables(), 'Button');
    const jsx = files['Button.jsx'];
    assert.match(jsx, /export function Button\(\{ variant, size, label = "Button", hasIcon = false, iconPlacement = "start", icon = null, loading = false, disabled = false, fullWidth = false, onClick, onHover, onFocus, onBlur \}\)/);
});

test('anatomy renders in order, and a managed icon only when the placement asks for it', () => {
    const jsx = generateComponent(button, binding(), variables(), 'Button').files['Button.jsx'];
    const start = jsx.indexOf('{hasIcon && iconPlacement === "start" && <span className="button-iconStart">{icon}</span>}');
    const label = jsx.indexOf('<span className="button-label">{label}</span>');
    const end = jsx.indexOf('{hasIcon && iconPlacement === "end" && <span className="button-iconEnd">{icon}</span>}');
    assert.ok(start > 0 && label > start && end > label, 'expected iconStart, label, iconEnd in that order');
});

test('loading and disabled block the click', () => {
    const jsx = generateComponent(button, binding(), variables(), 'Button').files['Button.jsx'];
    assert.match(jsx, /disabled=\{disabled\}/);
    assert.match(jsx, /onClick=\{blocked \? undefined : onClick\}/);
});

test('each variant and size mode gets its base tokens on its own selector', () => {
    const css = generateComponent(button, binding(), variables(), 'Button').files['Button.css'];
    assert.match(css, /\.button\[data-variant="primary"\]\[data-size="sm"\] \{\n(?:.*\n)*?\s*--button-bg: #4338ca;/);
    assert.match(css, /\.button\[data-variant="danger"\]\[data-size="sm"\] \{\n(?:.*\n)*?\s*--button-bg: #dc2626;/);
});

test('a state block holds only the tokens that state changes', () => {
    const css = generateComponent(button, binding(), variables(), 'Button').files['Button.css'];
    const hover = /\.button\[data-variant="primary"\]\[data-size="sm"\]:hover \{\n([^}]*)\}/.exec(css);
    assert.ok(hover, 'expected a hover block');
    assert.match(hover[1], /--button-bg: #3730a3;/);
    assert.doesNotMatch(hover[1], /--button-fg/);
});

test('a missing state token refuses the output and names the mode and the reason', () => {
    const result = generateComponent(button, binding(), variables(['bg-hover']), 'Button');
    assert.equal(result.files, null);
    assert.ok(result.problems.some(p => p.token === 'bg-hover' && p.reason === 'no-variable' && p.variant === 'primary'));
});

test('an unbound dimension refuses the output', () => {
    const result = generateComponent(button, binding({ size: null }), variables(), 'Button');
    assert.equal(result.files, null);
    assert.ok(result.problems.some(p => p.dimension === 'size' && p.reason === 'dimension-unbound'));
});

test('the same inputs give the same output', () => {
    const a = generateComponent(button, binding(), variables(), 'Button');
    const b = generateComponent(button, binding(), variables(), 'Button');
    assert.deepEqual(a, b);
});
