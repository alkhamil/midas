import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewOf, canvasColorsOf } from '../src/behavior-engine/preview.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';

const button = TEMPLATES.get('button');
const sizeColl = { id: 'c-size', name: 'Size', modes: [{ id: 'sm', name: 'Small' }] };
const variantColl = { id: 'c-variant', name: 'Variant', modes: [{ id: 'primary', name: 'Primary' }] };
const num = (id, name, collectionId, values) => ({ id, name, type: 'number', collectionId, values });
const col = (id, name, collectionId, values) => ({ id, name, type: 'color', collectionId, values });
const sizeItems = () => [
    num('i-fs', 'button/fontSize', 'c-size', { sm: 14 }),
    num('i-lh', 'button/lineHeight', 'c-size', { sm: 20 }),
    num('i-px', 'button/paddingX', 'c-size', { sm: 12 }),
    num('i-py', 'button/paddingY', 'c-size', { sm: 6 }),
    num('i-gap', 'button/gap', 'c-size', { sm: 6 }),
    num('i-radius', 'button/radius', 'c-size', { sm: 6 }),
    num('i-icon', 'button/iconSize', 'c-size', { sm: 14 }),
];
const variantItems = (over = {}) => ({
    bg: '#4338ca',
    'bg-hover': '#3730a3',
    'bg-active': '#312e81',
    'bg-disabled': '#a5b4fc',
    fg: '#ffffff',
    border: '#4338ca',
    'border-focus': '#818cf8',
    ...over,
});
const variantsOf = values => Object.entries(values).map(([name, value]) => col(`i-${name}`, `button/${name}`, 'c-variant', { primary: value }));
const variables = (values = variantItems()) => ({
    collections: [sizeColl, variantColl],
    items: [...sizeItems(), ...variantsOf(values)],
});
const binding = () => ({ version: 2, templateId: 'button', variables: { size: 'c-size', variant: 'c-variant' } });
const modes = () => ({ size: 'sm', variant: 'primary' });
const props = (over = {}) => ({ ...resolveProps(button, {}), ...over });
const draw = (preview = 'default', over = {}, values = variantItems()) => previewOf(button, binding(), modes(), variables(values), props(over), preview);
const reasonsOf = result => Object.fromEntries(result.unresolved.map(u => [u.token, u.reason]));

test('the default state draws the base colour of the variant', () => {
    assert.equal(draw().vars['--button-bg'], '#4338ca');
});

test('hover draws the hover colour, and only the colours it overrides change', () => {
    const base = draw().vars;
    const { vars } = draw('hover');
    assert.equal(vars['--button-bg'], '#3730a3');
    assert.equal(vars['--button-fg'], base['--button-fg']);
    assert.equal(vars['--button-border'], base['--button-border']);
    assert.equal(vars['--button-font-size'], base['--button-font-size']);
});

test('active draws the active colour', () => {
    assert.equal(draw('active').vars['--button-bg'], '#312e81');
});

test('a disabled instance draws the disabled colour, whatever preview state is asked for', () => {
    const result = draw('hover', { disabled: true });
    assert.equal(result.vars['--button-bg'], '#a5b4fc');
    assert.equal(result.state, 'disabled');
});

test('focus changes the border colour only; loading draws the default colour', () => {
    const base = draw().vars;
    const focused = draw('focus').vars;
    assert.equal(focused['--button-border'], '#818cf8');
    assert.equal(focused['--button-bg'], base['--button-bg']);
    assert.equal(draw('default', { loading: true }).vars['--button-bg'], '#4338ca');
});

test('a missing state token leaves the base colour out, and is reported, never replaced by the base colour', () => {
    const values = variantItems();
    delete values['bg-hover'];
    const result = draw('hover', {}, values);
    assert.equal('--button-bg' in result.vars, false);
    assert.equal(reasonsOf(result)['bg-hover'], 'no-variable');
});

test('the resolved props hold the stored values, and the schema default for the rest', () => {
    const resolved = resolveProps(button, { label: 'Save' });
    assert.equal(resolved.label, 'Save');
    assert.equal(resolved.disabled, false);
    assert.equal(resolved.hasIcon, false);
});

test('a preview state the template does not have is refused', () => {
    assert.throws(() => draw('pressed'), /unknown preview state "pressed"/);
});

// The canvas draws a preview only for the root's background and border. Text colour stays in the Preview section.
const canvasDraw = (preview = 'default', over = {}, values = variantItems()) => canvasColorsOf(button, binding(), modes(), variables(values), props(over), preview);

test('the default state has no canvas preview: the instance draws its own colours', () => {
    assert.equal(canvasDraw('default'), null);
});

test('hover substitutes the root fill only: the state does not change the border', () => {
    assert.deepEqual(canvasDraw('hover'), { fill: '#3730a3' });
});

test('focus substitutes the root stroke only, and never the fill or the text colour', () => {
    assert.deepEqual(canvasDraw('focus'), { stroke: '#818cf8' });
});

test('a disabled instance has no canvas preview: the persistent state wins over hover and focus', () => {
    assert.equal(canvasDraw('hover', { disabled: true }), null);
    assert.equal(canvasDraw('focus', { disabled: true }), null);
});

test('a preview colour that does not resolve gives no substitute, so nothing is drawn with a wrong colour', () => {
    const { 'bg-hover': _dropped, ...withoutHover } = variantItems();
    assert.equal(canvasDraw('hover', {}, withoutHover), null);
});

test('the canvas preview never carries a text colour', () => {
    for (const preview of ['hover', 'active', 'focus']) {
        const result = canvasDraw(preview);
        assert.ok(result === null || Object.keys(result).every(key => key === 'fill' || key === 'stroke'), preview);
    }
});
