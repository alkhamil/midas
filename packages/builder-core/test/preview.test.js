import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewOf, canvasColorsOf, textColorTokenOf } from '../src/behavior-engine/preview.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { buttonModel } from '../../../scripts/button-model.mjs';

const button = TEMPLATES.get('button');
const model = buttonModel({
    colors: ['primary', 'danger'],
    variantModes: ['solid', 'outlined'],
    sizeModes: [{ id: 'sm', name: 'Small' }],
    sizeValues: { fontSize: { sm: 14 }, lineHeight: { sm: 1.5 }, paddingX: { sm: 12 }, paddingY: { sm: 6 }, gap: { sm: 6 }, radius: { sm: 6 }, iconSize: { sm: 14 } },
});
/** The model's items, without the ones named in `drop`. */
const items = (drop = []) => model.items.filter(item => !drop.includes(item.name));
const variables = (drop = []) => ({ collections: model.collections, items: items(drop) });
const binding = () => model.binding;
const modes = () => ({ size: 'sm', variant: 'solid', color: 'primary' });
const props = (over = {}) => ({ ...resolveProps(button, {}), ...over });
const draw = (preview = 'default', over = {}, drop = []) => previewOf(button, binding(), modes(), variables(drop), props(over), preview);
const reasonsOf = result => Object.fromEntries(result.unresolved.map(u => [u.token, u.reason]));

test('the default state draws the base colour of the variant', () => {
    assert.equal(draw().vars['--button-bg'], '#4338ca');
});

test('hover draws the hover colours, and only the colours it overrides change', () => {
    const base = draw().vars;
    const { vars } = draw('hover');
    assert.equal(vars['--button-bg'], '#3730a3');
    assert.equal(vars['--button-fg'], base['--button-fg']);
    assert.equal(vars['--button-font-size'], base['--button-font-size']);
});

test('active draws the active colour', () => {
    assert.equal(draw('active').vars['--button-bg'], '#312e81');
});

test('a disabled instance draws the disabled colour, whatever preview state is asked for', () => {
    const result = draw('hover', { disabled: true });
    assert.equal(result.vars['--button-bg'], '#f4f4f5');
    assert.equal(result.state, 'disabled');
});

test('focus changes the outline colour only; loading draws the default colour', () => {
    const base = draw().vars;
    const focused = draw('focus').vars;
    assert.equal(base['--button-outline-color'], '#00000000');
    assert.equal(focused['--button-outline-color'], '#4338ca33');
    assert.equal(focused['--button-bg'], base['--button-bg']);
    assert.equal(focused['--button-border'], base['--button-border']);
    assert.equal(draw('default', { loading: true }).vars['--button-bg'], '#4338ca');
});

test('a missing state token leaves the base colour out, and is reported, never replaced by the base colour', () => {
    const result = draw('hover', {}, ['button/bg-hover']);
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
const canvasDraw = (preview = 'default', over = {}, drop = []) => canvasColorsOf(button, binding(), modes(), variables(drop), props(over), preview);

test('the default state has no canvas preview: the instance draws its own colours', () => {
    assert.equal(canvasDraw('default'), null);
});

test('hover substitutes the root fill and border: both are the hover values of the variant', () => {
    assert.deepEqual(canvasDraw('hover'), { fill: '#3730a3', stroke: '#00000000' });
});

test('focus has no canvas preview: the outline is not drawn on the canvas, which keeps bg and border only', () => {
    assert.equal(canvasDraw('focus'), null);
});

test('a disabled instance has no canvas preview: the persistent state wins over hover and focus', () => {
    assert.equal(canvasDraw('hover', { disabled: true }), null);
    assert.equal(canvasDraw('focus', { disabled: true }), null);
});

test('a preview colour that does not resolve gives no substitute, so nothing is drawn with a wrong colour', () => {
    assert.deepEqual(canvasDraw('hover', {}, ['button/bg-hover']), { stroke: '#00000000' });
});

test('the canvas preview never carries a text colour', () => {
    for (const preview of ['hover', 'active', 'focus']) {
        const result = canvasDraw(preview);
        assert.ok(result === null || Object.keys(result).every(key => key === 'fill' || key === 'stroke'), preview);
    }
});

test('the text colour token is the one the label layer draws its fill with', () => {
    assert.equal(textColorTokenOf(button), 'fg');
});

test('a template with no label fill has no text colour token', () => {
    assert.equal(textColorTokenOf({ ...button, display: { ...button.display, label: {} } }), null);
});
