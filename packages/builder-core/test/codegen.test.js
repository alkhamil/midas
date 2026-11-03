import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { buttonModel } from '../../../scripts/button-model.mjs';

const button = TEMPLATES.get('button');
const model = buttonModel({
    colors: ['primary', 'danger'],
    variantModes: ['solid', 'outlined'],
});
const variables = (skip = []) => ({
    collections: model.collections,
    items: model.items.filter(item => !skip.includes(item.name.replace('', ''))),
});
const binding = (over = {}) => ({ ...model.binding, variables: { ...model.binding.variables, ...over } });
const master = { id: 'm', type: 'frame', layout: 'horizontal', primaryAxisAlign: 'center', counterAxisAlign: 'center' };
const noKids = () => [];

test('the component takes every prop of the schema, with the schema default', () => {
    const { files } = generateComponent(button, binding(), variables(), 'Button', master, noKids);
    const jsx = files['Button.jsx'];
    assert.match(jsx, /export function Button\(\{ variant, color, size, label = "Button", hasIcon = false, iconPlacement = "start", icon = null, iconEnd = null, loading = false, disabled = false, onClick, onHover, onFocus, onBlur \}\)/);
});

test('anatomy renders in order, and a managed icon only when the placement asks for it', () => {
    const jsx = generateComponent(button, binding(), variables(), 'Button', master, noKids).files['Button.jsx'];
    const start = jsx.indexOf('{hasIcon && iconPlacement === "start" && !(loading === true && iconPlacement === "start") && <span className="button-iconStart">{icon}</span>}');
    const label = jsx.indexOf('<span className="button-label">{label}</span>');
    const end = jsx.indexOf('{hasIcon && iconPlacement === "end" && !(loading === true && iconPlacement === "end") && <span className="button-iconEnd">{iconEnd}</span>}');
    assert.ok(start > 0 && label > start && end > label, 'expected iconStart, label, iconEnd in that order');
});

test('loading and disabled block the click', () => {
    const jsx = generateComponent(button, binding(), variables(), 'Button', master, noKids).files['Button.jsx'];
    assert.match(jsx, /disabled=\{disabled\}/);
    assert.match(jsx, /onClick=\{blocked \? undefined : \(e\) => \{ if \(onClick\) onClick\(e\); waveDown\(e\.currentTarget\); \}\}/);
});

test('each variant, colour and size mode gets its base tokens on its own selector', () => {
    const css = generateComponent(button, binding(), variables(), 'Button', master, noKids).files['Button.css'];
    assert.match(css, /\.button\[data-variant="solid"\]\[data-color="primary"\]\[data-size="sm"\] \{\n(?:.*\n)*?\s*--button-bg: #4338ca;/);
    assert.match(css, /\.button\[data-variant="solid"\]\[data-color="danger"\]\[data-size="sm"\] \{\n(?:.*\n)*?\s*--button-bg: #dc2626;/);
    assert.match(css, /\.button\[data-variant="outlined"\]\[data-color="primary"\]\[data-size="sm"\] \{\n(?:.*\n)*?\s*--button-border: #4338ca;/);
});

test('a state block holds only the tokens that state changes', () => {
    const css = generateComponent(button, binding(), variables(), 'Button', master, noKids).files['Button.css'];
    const hover = /\.button\[data-variant="solid"\]\[data-color="primary"\]\[data-size="sm"\]:hover:not\(:disabled\):not\(\[data-blocked\]\) \{\n([^}]*)\}/.exec(css);
    assert.ok(hover, 'expected a hover block');
    assert.match(hover[1], /--button-bg: #3730a3;/);
    assert.doesNotMatch(hover[1], /--button-fg/);
});

test('the border follows its variable in every combo, and no other state touches the border width', () => {
    const css = generateComponent(button, binding(), variables(), 'Button', master, noKids).files['Button.css'];
    assert.match(css, /--button-border-width: 1px;/);
    for (const m of css.matchAll(/^([^{]+)\{([^}]*)\}/gm)) {
        const [sel, body] = [m[1], m[2]];
        if ((/:(hover|active)|:disabled|\[data-blocked\]/.test(sel)) && !/:focus/.test(sel)) {
            assert.doesNotMatch(body, /border-width|--button-border-width/, `a non-focus state must not touch the border width: ${sel.trim()}`);
        }
    }
});

test('a loading Button is faded and inert, and no interaction state applies while it loads', () => {
    const css = generateComponent(button, binding(), variables(), 'Button', master, noKids).files['Button.css'];
    assert.match(css, /\.button\[data-blocked\]:not\(:disabled\) \{\n  opacity: 0\.65;\n  pointer-events: none;\n\}/);
    assert.match(css, /:hover:not\(:disabled\):not\(\[data-blocked\]\) \{/);
    assert.match(css, /:active:not\(:disabled\):not\(\[data-blocked\]\) \{/);
    assert.match(css, /:focus-visible:not\(:disabled\):not\(\[data-blocked\]\) \{/);
});

test('the export marks a blockable root with data-blocked, so the loading rule matches', () => {
    const jsx = generateComponent(button, binding(), variables(), 'Button', master, noKids).files['Button.jsx'];
    assert.match(jsx, /data-blocked=\{blocked \|\| undefined\}/);
});

test('no interaction state applies to a disabled Button: hover, active and focus are guarded, and the disabled block is not', () => {
    const css = generateComponent(button, binding(), variables(), 'Button', master, noKids).files['Button.css'];
    assert.match(css, /:hover:not\(:disabled\):not\(\[data-blocked\]\) \{/);
    assert.match(css, /:active:not\(:disabled\):not\(\[data-blocked\]\) \{/);
    assert.match(css, /:focus-visible:not\(:disabled\):not\(\[data-blocked\]\) \{/);
    assert.doesNotMatch(css, /:(hover|active|focus) \{/);
    assert.match(css, /\.button\[data-variant="solid"\]\[data-color="primary"\]\[data-size="sm"\]:disabled \{/);
});

test('a missing state token refuses the output and names the mode and the reason', () => {
    const result = generateComponent(button, binding(), variables(['bg-hover']), 'Button', master, noKids);
    assert.equal(result.files, null);
    assert.ok(result.problems.some(p => p.token === 'bg-hover' && p.reason === 'no-variable' && p.variant === 'solid'));
});

test('an unbound dimension refuses the output', () => {
    const result = generateComponent(button, binding({ size: null }), variables(), 'Button', master, noKids);
    assert.equal(result.files, null);
    assert.ok(result.problems.some(p => p.dimension === 'size' && p.reason === 'dimension-unbound'));
});

test('the same inputs give the same output', () => {
    const a = generateComponent(button, binding(), variables(), 'Button', master, noKids);
    const b = generateComponent(button, binding(), variables(), 'Button', master, noKids);
    assert.deepEqual(a, b);
});

test('the stylesheet applies each mapped token to its node, from the display mapping', () => {
    const css = generateComponent(button, binding(), variables(), 'Button', master, noKids).files['Button.css'];
    assert.match(css, /^\.button \{\n(?:.*\n)*?\s*background-color: var\(--button-bg\);/);
    assert.match(css, /\.button \{\n(?:.*\n)*?\s*border-radius: var\(--button-radius\);/);
    assert.match(css, /\.button-label \{\n\s*color: var\(--button-fg\);\n\s*font-family: var\(--button-label-typography-font-family\);\n\s*font-size: var\(--button-label-typography-font-size\);\n\s*font-weight: var\(--button-label-typography-font-weight\);\n\s*line-height: var\(--button-label-typography-line-height\);\n\s*letter-spacing: var\(--button-label-typography-letter-spacing\);\n\}/);
    assert.match(css, /\.button-iconStart \{\n\s*color: var\(--button-fg\);\n\s*width: var\(--button-icon-size\);\n\s*height: var\(--button-icon-size\);\n\}/);
});
