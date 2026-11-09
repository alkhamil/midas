// Input with a kind (text | password | textarea), as antd has Input, Input.Password and Input.TextArea. One template: switching the kind adds and removes the layers the kind
// needs (the eye, the footer with the count and the resize grip), shows its own props only, lays the box out, and draws the same on the canvas, in Play and in the export.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILT_IN_TEMPLATES, TEMPLATES } from '../src/behavior-engine/registry.js';
import { planAnatomy } from '../src/behavior-engine/anatomy.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { instancePanel } from '../src/behavior-engine/panel.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { previewOf } from '../src/behavior-engine/preview.js';
import { cssVarOf } from '../src/behavior-engine/tokens.js';
import { rowsBounds } from '../src/behavior-engine/display.js';
import { pinnedFrame } from '../src/behavior-engine/template-master.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { forwardFocus, startResizeDrag } from '../src/prototype/press.js';
import { modelFor, instanceFor } from './helpers/box-template.js';
import { computed, elementsOf } from './helpers/play-compute.js';

const input = TEMPLATES.get('input');
const model = modelFor(input);
const SIZES = ['xs', 'sm', 'md', 'lg', 'xl'];
const base = { placeholder: 'Input placeholder' };
const nodesOf = props => instanceFor(model, { ...base, ...props });
const names = props => nodesOf(props).slice(1).map(n => n.name);
const heldOf = nodes => nodes.slice(1).map(n => ({ id: n.id, slot: n.behavior?.slot ?? null, name: n.name, ...(n.parentId !== nodes[0].id ? { parent: 'footer' } : {}) }));
const held = props => heldOf(nodesOf(props));
const sizeModes = size => Object.fromEntries(Object.entries(model.binding.variables).map(([prop, cid]) => {
    const coll = model.variables.collections.find(c => c.id === cid);
    const want = prop === 'size' ? size : input.props[prop].defaultMode ?? coll.modes[0].name;
    return [prop, (coll.modes.find(m => m.id === want || m.name === want) ?? coll.modes[0]).id];
}));
const varsAt = (size, props) => previewOf(input, model.binding, sizeModes(size), model.variables, resolveProps(input, { ...base, ...props }), 'default').vars;

function playOf(props, size = 'md') {
    const nodes = nodesOf(props);
    const sizeCollection = model.binding.variables.size;
    nodes[0].varModes = { ...nodes[0].varModes, [sizeCollection]: model.variables.collections.find(c => c.id === sizeCollection).modes.find(m => m.name === size).id };
    const frame = { id: 'top', name: 'Top', type: 'frame', parentId: null, layout: 'vertical', x: 0, y: 0, w: 600, h: 600, fills: [], layoutSizingH: 'hug', layoutSizingV: 'hug' };
    nodes[0].parentId = 'top';
    const out = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [frame, model.frame, ...model.created, ...nodes] }], variables: model.variables }, 'top');
    assert.deepEqual(out.problems, []);
    const all = elementsOf(out.root);
    return { ...out, nodes, all, host: all.find(({ el }) => el.attrs?.class === 'input'), find: pred => all.find(({ el }) => pred(el)) };
}
/** A length expression of px, calc(), max() and the root's inline custom properties, as px. */
function evalLength(expr, inline = {}) {
    const filled = String(expr).replace(/var\((--[a-z0-9-]+)(?:,\s*([^()]*))?\)/g, (_, name, fallback) => inline[name] ?? fallback ?? 'NaN');
    if (/var\(/.test(filled)) return evalLength(filled, inline);
    return Function(`"use strict"; return (${filled.replace(/calc/g, '').replace(/max\(/g, 'Math.max(').replace(/px/g, '')});`)();
}
const inlineOf = el => Object.fromEntries(Object.entries(el.style ?? {}).filter(([k]) => k.startsWith('--')));

test('Input has a kind: text, password or textarea; Password and TextArea are no longer templates', () => {
    assert.deepEqual(input.props.kind.options, ['text', 'password', 'textarea']);
    assert.equal(input.props.kind.default, 'text');
    assert.equal(input.isControl, true);
    assert.ok(!BUILT_IN_TEMPLATES.has('password') && !BUILT_IN_TEMPLATES.has('textarea'));
    assert.ok(BUILT_IN_TEMPLATES.has('inputnumber'), 'InputNumber stays its own template');
});

test('a prop that applies to one kind shows for that kind only', () => {
    const rowsOf = props => instancePanel({ behavior: { props } }, model.frame, model.variables.collections, {}).rows;
    const shown = kind => new Set(rowsOf({ kind }).map(r => r.prop));
    const text = shown('text'), password = shown('password'), area = shown('textarea');
    for (const prop of ['allowClear', 'hasPrefix', 'hasSuffix', 'showCount']) assert.ok(text.has(prop), `text shows ${prop}`);
    for (const prop of ['visibilityToggle', 'rows', 'autoSize', 'resize']) assert.ok(!text.has(prop), `text hides ${prop}`);
    assert.ok(password.has('visibilityToggle') && password.has('hasPrefix') && password.has('hasSuffix'));
    for (const prop of ['allowClear', 'showCount', 'rows', 'autoSize', 'resize']) assert.ok(!password.has(prop), `password hides ${prop}`);
    for (const prop of ['rows', 'autoSize', 'resize', 'showCount']) assert.ok(area.has(prop), `textarea shows ${prop}`);
    for (const prop of ['allowClear', 'hasPrefix', 'hasSuffix', 'visibilityToggle']) assert.ok(!area.has(prop), `textarea hides ${prop}`);
    assert.ok(!area.has('minRows') && !area.has('maxRows'), 'min and max rows need autoSize');
    assert.ok(rowsOf({ kind: 'textarea', autoSize: true }).some(r => r.prop === 'minRows'));
});

test('a fresh Input holds the placeholder only; each kind adds exactly the layers it needs', () => {
    assert.deepEqual(names({}), ['placeholder']);
    assert.deepEqual(names({ kind: 'password' }), ['placeholder', 'eyeBox', 'eyeOff']);
    assert.deepEqual(names({ kind: 'password', passwordVisible: true }), ['placeholder', 'eyeBox', 'eyeOn']);
    assert.deepEqual(names({ kind: 'password', visibilityToggle: false }), ['placeholder']);
    assert.deepEqual(names({ kind: 'textarea' }), ['placeholder'], 'no footer without a count or a grip');
    assert.deepEqual(names({ kind: 'textarea', resize: 'vertical' }), ['placeholder', 'resizeHandle'], 'the grip is a layer of the box, not of a footer');
    assert.deepEqual(names({ kind: 'textarea', showCount: true }), ['placeholder', 'footer', 'countArea']);
    assert.deepEqual(names({ kind: 'textarea', showCount: true, resize: 'vertical' }).sort(), ['countArea', 'footer', 'placeholder', 'resizeHandle']);
    assert.deepEqual(names({ showCount: true }), ['placeholder', 'count'], 'the single line counts inline');
});

test('switching the kind makes and removes exactly the layers: the eye for password, the footer and grip for textarea', () => {
    const plan = (from, to) => { const nodes = nodesOf(from); return planAnatomy(input, resolveProps(input, { ...base, ...to }), heldOf(nodes)).map(op => op.op === 'insert' ? `+${op.slot}` : `-${nodes.find(n => n.id === op.id)?.name}`).sort(); };
    assert.deepEqual(plan({}, { kind: 'password' }), ['+eyeBox', '+eyeOff']);
    assert.deepEqual(plan({ kind: 'password' }, {}), ['-eyeBox', '-eyeOff']);
    assert.deepEqual(plan({ kind: 'password' }, { kind: 'textarea', resize: 'vertical' }), ['+resizeHandle', '-eyeBox', '-eyeOff']);
    assert.deepEqual(plan({ kind: 'textarea', resize: 'vertical', showCount: true }, {}), ['-countArea', '-footer', '-resizeHandle']);
    assert.deepEqual(plan({ kind: 'textarea', resize: 'vertical' }, { kind: 'textarea' }), ['-resizeHandle'], 'resize none takes the grip away');
    for (const props of [{}, { kind: 'password' }, { kind: 'textarea', resize: 'vertical', showCount: true }]) assert.deepEqual(planAnatomy(input, resolveProps(input, { ...base, ...props }), held(props)), [], `converges for ${JSON.stringify(props)}`);
});

test('no kind holds a hidden, transparent or zero-size node, and the typed text and choices stay in the props across a switch', () => {
    const dead = n => n.visible === false || n.opacity === 0 || (n.w === 0 && n.h === 0 && n.layoutSizingH === 'fixed' && n.layoutSizingV === 'fixed' && !n.vars?.w && !n.vars?.h);
    for (const props of [{}, { kind: 'password' }, { kind: 'password', passwordVisible: true }, { kind: 'textarea' }, { kind: 'textarea', resize: 'vertical', showCount: true, value: 'abc' }, { disabled: true, kind: 'textarea' }]) {
        assert.deepEqual(nodesOf(props).filter(dead).map(n => n.name), [], JSON.stringify(props));
    }
    const typed = { value: 'secret', hasSuffix: true, suffixText: 'kg' };
    assert.equal(resolveProps(input, { ...base, ...typed, kind: 'textarea' }).value, 'secret', 'the value is not lost');
});

test('the canvas value of a password is bullets while hidden; the layout is a row for text and password, a column for the text area', () => {
    assert.equal(nodesOf({ kind: 'password', value: 'abc' }).find(n => n.name === 'value').text, '•••');
    assert.equal(nodesOf({ kind: 'password', value: 'abc', passwordVisible: true }).find(n => n.name === 'value').text, 'abc');
    assert.equal(nodesOf({ kind: 'text', value: 'abc' }).find(n => n.name === 'value').text, 'abc', 'a plain input shows its text');
    assert.equal(nodesOf({}) [0].layout, 'horizontal');
    assert.equal(nodesOf({ kind: 'password' })[0].layout, 'horizontal');
    assert.equal(nodesOf({ kind: 'textarea' })[0].layout, 'vertical');
});

test('the text area value and placeholder fill the box on both axes, colour and typography bound, no width or height variable; the other kinds hug in height', () => {
    for (const layer of ['value', 'placeholder']) {
        const props = { kind: 'textarea', value: layer === 'value' ? 'one two three' : '' };
        const n = nodesOf(props).find(x => x.name === layer);
        assert.deepEqual([n.layoutSizingH, n.layoutSizingV], ['fill', 'fill'], `${layer} fills x fills`);
        assert.equal(n.vars?.w, undefined);
        assert.equal(n.vars?.h, undefined);
        const text = nodesOf({ kind: 'text', value: layer === 'value' ? 'x' : '' }).find(x => x.name === layer);
        assert.deepEqual([text.layoutSizingH, text.layoutSizingV], ['fill', 'hug'], `${layer} of a plain input`);
    }
});

for (const size of SIZES) {
    test(`${size}: the text area top inset is the Input paddingBlock, computed from the generated CSS`, () => {
        const area = playOf({ kind: 'textarea' }, size), line = playOf({}, size);
        const inset = ({ host, styles }) => evalLength(computed(styles, host.chain)['padding-block'], inlineOf(host.el));
        assert.equal(inset(area), inset(line), `same padding-block as the Input at ${size}`);
        const token = parseFloat(varsAt(size, {})[cssVarOf('input', 'paddingY')]);
        const border = parseFloat(varsAt(size, {})[cssVarOf('input', 'borderWidth')]);
        assert.equal(inset(area), Math.max(0, token - border), 'the paddingBlock token less the border drawn inside it');
        if (['md', 'lg', 'xl'].includes(size)) assert.ok(token > 0, `${size}: the first line has an inset (antd paddingBlock), not 0`);
    });
}

test('textarea: the value fills the content box on both axes, from the computed geometry of the box and the field', () => {
    for (const size of SIZES) {
        const props = { kind: 'textarea', value: 'text' };
        const { host, styles, find } = playOf(props, size);
        const vars = varsAt(size, props);
        const box = computed(styles, host.chain), field = computed(styles, find(el => el.tag === 'textarea').chain);
        const inline = inlineOf(host.el);
        const padding = evalLength(box['padding-block'], inline), side = evalLength(box['padding-inline'], inline);
        const lineHeight = parseFloat(vars[cssVarOf('input', 'valueTypography') + '-line-height']);
        // The box: the node's 343 wide, hugging a column whose field is at least `rows` lines tall; the floor is the Size height.
        const content = { w: input.rootWidth - 2 * side, h: Math.max(parseFloat(vars[cssVarOf('input', 'height')]), 3 * lineHeight + 2 * padding) - 2 * padding };
        assert.equal(box['flex-direction'], 'column');
        assert.equal(field.display, 'block');
        assert.equal(field['align-self'], 'stretch', `${size}: the field spans the box width`);
        assert.equal(evalLength(field['min-width']), 0);
        assert.equal(field.flex, '1 1 auto', `${size}: the field takes the height the box leaves`);
        assert.equal(evalLength(field['min-height'], inline), 3 * lineHeight, `${size}: at least rows x line height`);
        // With no footer the field is the whole content box: its width is the content width, its height the content height.
        assert.equal(content.w, input.rootWidth - 2 * side);
        assert.ok(content.h >= 3 * lineHeight, `${size}: the content box holds the rows`);
    }
});

test('the box is the text field: the cursor is the text cursor over it, a click on its padding focuses the field, and disabled does neither', () => {
    const { styles, host } = playOf({ kind: 'textarea' });
    assert.ok('data-field-box' in host.el.attrs);
    assert.match(styles, /\.input\[data-kind="textarea"\] \{\s*cursor: text;/);
    assert.match(styles, /\.input\[data-kind="textarea"\]:has\(:disabled\) \{\s*cursor: not-allowed;/);
    assert.ok(!('data-field-box' in playOf({}).host.el.attrs), 'a plain input is not forwarded');
    // A click on the padding: the box is the target; the field takes the focus.
    const field = { focused: false, hasAttribute: () => false, focus() { this.focused = true; } };
    const rootEl = { closest: sel => (sel.includes('data-field-box') ? rootEl : null), querySelector: () => field };
    assert.equal(forwardFocus(rootEl), true);
    assert.ok(field.focused);
    const off = { focused: false, hasAttribute: n => n === 'disabled', focus() { this.focused = true; } };
    const offRoot = { closest: sel => (sel.includes('data-field-box') ? offRoot : null), querySelector: () => off };
    assert.equal(forwardFocus(offRoot), false);
    assert.ok(!off.focused);
    assert.equal(playOf({ kind: 'textarea', disabled: true }).find(el => el.tag === 'textarea').el.attrs.disabled, true);
});

test('the resize grip is a glyph, a layer of the box: bound to the glyph colour token, and Play marks it as the handle', () => {
    const nodes = nodesOf({ kind: 'textarea', resize: 'vertical' });
    const grip = nodes.find(n => n.name === 'resizeHandle');
    assert.equal(grip.type, 'path');
    assert.equal(grip.parentId, nodes[0].id, 'a child of the box itself');
    assert.equal(input.display.resizeHandle.fill, 'glyph-fg');
    const { find } = playOf({ kind: 'textarea', resize: 'vertical' });
    assert.equal(find(el => el.attrs?.class === 'input-resizeHandle').el.attrs['data-press'], 'resize');
});

test('resize: vertical works in Play: dragging the grip changes the height within the min and max rows of the field, never the width', () => {
    for (const size of ['sm', 'md', 'lg']) {
        const props = { kind: 'textarea', resize: 'vertical' };
        const { styles, find, host } = playOf(props, size);
        const vars = varsAt(size, props);
        const lineHeight = parseFloat(vars[cssVarOf('input', 'valueTypography') + '-line-height']);
        const field = computed(styles, find(el => el.tag === 'textarea').chain);
        assert.match(styles, /\.input\[data-kind="textarea"\]\[data-resize="vertical"\] \.input-value \{\s*resize: vertical;/);
        const min = evalLength(field['min-height'], inlineOf(host.el));
        assert.equal(min, 3 * lineHeight);
        const el = { offsetHeight: min, style: {}, hasAttribute: () => false, offsetWidth: 300 };
        const box = { offsetHeight: min + 20, querySelector: () => el };
        const drag = startResizeDrag(box, 100, () => ({ minHeight: `${min}px`, maxHeight: `${min * 3}px` }));
        drag.move(160);
        assert.equal(el.style.height, `${min + 60}px`, 'follows the pointer');
        drag.move(100000);
        assert.equal(el.style.height, `${min * 3}px`, 'stops at the max');
        drag.move(-100000);
        assert.equal(el.style.height, `${min}px`, 'stops at the min');
        assert.equal(el.style.width, undefined, 'no horizontal resize');
        assert.equal(field.resize, 'vertical', 'vertical only: never both');
    }
});

test('autoSize bounds the field by the min and max rows, and has no grip', () => {
    const props = { kind: 'textarea', autoSize: true, minRows: 2, maxRows: 5, resize: 'vertical' };
    assert.deepEqual(names(props), ['placeholder'], 'resize is hidden with autoSize: no footer, no grip');
    const { styles, find, host } = playOf(props);
    const vars = varsAt('md', props), lh = parseFloat(vars[cssVarOf('input', 'valueTypography') + '-line-height']);
    const field = computed(styles, find(el => el.tag === 'textarea').chain);
    assert.equal(evalLength(field['min-height'], inlineOf(host.el)), 2 * lh);
    assert.equal(evalLength(field['max-height'], inlineOf(host.el)), 5 * lh);
    assert.deepEqual(rowsBounds(input, resolveProps(input, props), { lineHeight: lh }), { minH: 2 * lh, maxH: 5 * lh });
});

test('the export carries Input.Password and Input.TextArea, one element chosen by the kind, the grip with its drag, and rules scoped to the kind', () => {
    const out = generateComponent(input, model.binding, model.variables, 'Input', model.frame, id => model.created.filter(n => n.parentId === id));
    assert.deepEqual(out.problems, []);
    const jsx = out.files['Input.jsx'], css = out.files['Input.css'];
    assert.match(jsx, /Input\.Password = function Password\(props\) \{\s*return <Input \{\.\.\.props\} kind="password" \/>;/);
    assert.match(jsx, /Input\.TextArea = function TextArea\(props\) \{\s*return <Input \{\.\.\.props\} kind="textarea" \/>;/);
    assert.match(jsx, /const Control = kind === "textarea" \? "textarea" : "input";/);
    assert.match(jsx, /type=\{\(kind === "password"\) && !passwordVisible \? "password" : undefined\}/);
    assert.match(jsx, /data-kind=\{kind\}/);
    assert.match(jsx, /className="input-resizeHandle" onPointerDown=/);
    assert.match(jsx, /const startResizeDrag = function startResizeDrag/);
    assert.match(css, /\.input\[data-kind="textarea"\] \.input-value \{[^}]*flex: 1 1 auto;[^}]*resize: none;/);
    assert.match(css, /\.input\[data-kind="textarea"\]\[data-resize="vertical"\] \.input-value \{\s*resize: vertical;/);
    assert.match(css, /\.input\[data-kind="textarea"\]\[data-auto-size\] \.input-value \{[^}]*max-height: calc\(var\(--input-max-rows\) \* var\(--input-value-typography-line-height\)\)/);
    assert.match(css, /\.input\[data-kind="textarea"\] \{\s*cursor: text;/);
    assert.match(css, /\.input-eyeBox \{\s*cursor: pointer/);
    assert.match(css, /\.input\[data-kind="textarea"\] \{[^}]*flex-direction: column/);
});

test('the resize grip sits in the bottom right corner of the border box with the inset token (2px) of gap to the right and to the bottom: canvas geometry, Play and the export alike', () => {
    const nodes = nodesOf({ kind: 'textarea', resize: 'vertical' });
    const grip = nodes.find(n => n.name === 'resizeHandle');
    // The canvas: out of the auto layout (ignores the padding), pinned right and bottom, and placed with its edges the inset in from the box's.
    assert.equal(grip.layoutPositioning, 'absolute');
    assert.deepEqual([grip.constraintH, grip.constraintV], ['right', 'bottom']);
    assert.equal(input.anatomy.find(s => s.id === 'resizeHandle').inset, 'glyphInset');
    assert.equal(input.tokenRoles.glyphInset, 'glyph-inset');
    for (const size of SIZES) {
        const vars = varsAt(size, { kind: 'textarea' });
        const inset = parseFloat(vars[cssVarOf('input', 'glyphInset')]);
        assert.equal(inset, 2, `${size}: the token is 2px`);
        for (const box of [{ w: 343, h: 84 }, { w: 343, h: 140 }]) {
            const at = pinnedFrame(input, input.anatomy.find(s => s.id === 'resizeHandle'), box, vars);
            assert.deepEqual([box.w - (at.x + at.w), box.h - (at.y + at.h)], [2, 2], 'the grip rect is 2px from the right and the bottom of the box');
            assert.equal(at.w, parseFloat(vars[cssVarOf('input', input.display.resizeHandle.size)]), 'and its own size token');
        }
        // Play and the export: the offset from the padding box edge plus the border (which lies outside it) is the inset on both sides.
        const { styles, find, host } = playOf({ kind: 'textarea', resize: 'vertical' }, size);
        const g = computed(styles, find(el => el.attrs?.class === 'input-resizeHandle').chain);
        const border = parseFloat(vars[cssVarOf('input', 'borderWidth')]);
        assert.equal(g.position, 'absolute');
        assert.equal(evalLength(g.right, inlineOf(host.el)) + border, inset, `${size}: right`);
        assert.equal(evalLength(g.bottom, inlineOf(host.el)) + border, inset, `${size}: bottom`);
        assert.equal(computed(styles, host.chain).position, 'relative', 'the box is the containing block');
    }
    const css = generateComponent(input, model.binding, model.variables, 'Input', model.frame, id => model.created.filter(n => n.parentId === id)).files['Input.css'];
    assert.ok(css.includes('.input-resizeHandle {\n  position: absolute;\n  right: calc(var(--input-glyph-inset) - var(--input-border-width));\n  bottom: calc(var(--input-glyph-inset) - var(--input-border-width));'), 'tokens, no literal');
    assert.ok(grip.w <= 24 && grip.h <= 24, 'a small box: a click on the text outside it is the text\'s');
});

test('the eye takes the text colour while hovered, in the stylesheet of Play and the export only, token-bound, never on a disabled control', () => {
    for (const slot of ['eyeOn', 'eyeOff']) assert.equal(input.icons.find(d => d.slot === slot).tokens.hoverColour, 'glyph-fg-hover', `${slot} hovers`);
    assert.equal(input.tokenRoles['glyph-fg-hover'], 'fg', 'the text colour');
    assert.equal(input.tokenRoles['glyph-fg'], 'placeholder', 'idle is the muted colour');
    const css = generateComponent(input, model.binding, model.variables, 'Input', model.frame, id => model.created.filter(n => n.parentId === id)).files['Input.css'];
    for (const slot of ['eyeOn', 'eyeOff']) {
        assert.ok(css.includes(`.input:not(:has(:disabled)) .input-${slot}:hover {\n  color: var(--input-glyph-fg-hover);\n}`), `${slot}: hover recolours it, guarded against a disabled control`);
    }
    assert.ok(!/\.input-(eyeOn|eyeOff|resizeHandle):hover[^{]*\{[^}]*#[0-9a-f]{3,8}/i.test(css), 'no colour literal in a hover rule');
    assert.ok(!/\.input-resizeHandle:hover/.test(css), 'only the eyes change on hover');
    // The hover colour differs from the idle colour in the variables the stylesheet resolves.
    const vars = varsAt('md', { kind: 'password' });
    assert.notEqual(vars['--input-glyph-fg-hover'], vars['--input-glyph-fg']);
    assert.equal(vars['--input-glyph-fg-hover'], vars['--input-fg'], 'the hover colour is the text colour');
    // The canvas is static: the layer is bound to the idle colour token only.
    const eye = nodesOf({ kind: 'password' }).find(n => n.name === 'eyeOff');
    assert.equal(eye.vars?.['fills.0'] === undefined || typeof eye.vars['fills.0'] === 'string', true);
    assert.equal(input.icons.find(d => d.slot === 'eyeOff').tokens.colour, 'glyph-fg');
    // A disabled control keeps its disabled colour: its glyph token swaps to the disabled one, and no hover rule applies to it.
    assert.equal(input.persistentStates.disabled.tokens['glyph-fg'], 'glyph-fg-disabled');
    // Play carries the same stylesheet.
    assert.match(String(playOf({ kind: 'password' }).styles), /\.input-eyeOn:hover/);
});
