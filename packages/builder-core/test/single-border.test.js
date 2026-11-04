// Single border element: each Button/Input root draws its border on the host itself,
// never on an overlay. The host carries border, radius, background and background-clip;
// a custom dash/gap unbound stroke is the only SVG-overlay case, and then the host draws none.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { buttonModel } from '../../../scripts/button-model.mjs';
import { inputModel } from '../../../scripts/input-model.mjs';

const white = [{ type: 'solid', color: '#ffffff', opacity: 1, visible: true }];

const bmodel = buttonModel({ colors: ['primary'], variantModes: ['outlined', 'dashed'] });
const bvars = { collections: bmodel.collections, items: bmodel.items };
const imodel = inputModel({});
const ivars = { collections: imodel.collections, items: imodel.items };

function buttonMaster(over = {}) {
  return { id: 'btn', name: 'Button', type: 'frame', parentId: null, component: true, layout: 'horizontal', gap: 6, padding: 12, fills: white, radius: 6, x: 0, y: 0, w: 120, h: 32, stroke: '#18181b', strokeWidth: 1, strokeAlign: 'inside', behavior: { version: 2, templateId: 'button', variables: bmodel.binding.variables }, ...over };
}
function buttonInstance(masterId, extra = {}, variant = 'outlined') {
  return { id: 'i1', name: 'Add', type: 'frame', parentId: null, x: 0, y: 0, w: 120, h: 32, isInstance: true, sourceId: masterId, behavior: { version: 2, props: { label: 'Add' } }, varModes: { 'c-variant': variant, 'c-color': 'primary', 'c-size': 'md' }, fills: white, radius: 6, stroke: '#18181b', strokeWidth: 1, strokeAlign: 'inside', ...extra };
}
function inputMaster(over = {}) {
  return { id: 'm', name: 'Input', type: 'frame', parentId: null, component: true, layout: 'horizontal', gap: 8, padding: 12, x: 0, y: 0, w: 200, h: 40, fills: white, radius: 6, stroke: '#000000', strokeWidth: 1, strokeAlign: 'inside', behavior: { version: 2, templateId: 'input', variables: imodel.binding.variables }, vars: { 'fills.0': 'v-bg', stroke: 'v-border', radius: 's-radius', padH: 's-paddingX', padV: 's-paddingY', gap: 's-gap' }, ...over };
}
function inputValue(over = {}) {
  return { id: 'm-value', name: 'Value', type: 'text', parentId: 'm', text: '', x: 12, y: 8, w: 120, h: 24, fills: white, fontSize: 14, ...over };
}

/** Every element in the Play tree whose style draws a visible border. */
function borderElements(el) {
  const found = [];
  const hasBorder = (s = {}) => {
    if (s.border && !/^0px/.test(s.border) && s.border !== 'none') return true;
    if (s.borderWidth && s.borderWidth !== '0px' && s.borderWidth !== '0') return true;
    for (const k of ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth']) {
      if (s[k] && s[k] !== '0px' && s[k] !== '0') return true;
    }
    if (s.borderStyle && s.borderStyle !== 'none' && s.borderStyle !== undefined) {
      // A non-none style with no width still draws when the width comes from a shorthand elsewhere.
      if (s.borderWidth && s.borderWidth !== '0px') return true;
    }
    return false;
  };
  const walk = n => {
    if (hasBorder(n.style)) found.push(n);
    for (const c of n.children || []) walk(c);
    if (n.html && /stroke-width="(?!0)/.test(n.html)) found.push(n);
  };
  walk(el);
  return found;
}

test('Play Button: exactly one border element, the host, with an explicit width', () => {
  const master = buttonMaster();
  const inst = buttonInstance('btn');
  const { root } = toDomTree({ pages: [{ id: 'p', name: 'Screens', nodes: [master, inst] }], variables: bvars }, 'i1');
  const borders = borderElements(root);
  assert.equal(borders.length, 1, `one border element, saw ${borders.length}`);
  assert.equal(borders[0], root, 'the host draws the border');
  assert.match(root.style.borderWidth ?? '', /^\d+px$/, 'every border element has an explicit width');
});

test('Play Input: exactly one border element, the host', () => {
  const m = inputMaster();
  const v = inputValue();
  const inst = { id: 'i1', name: 'In', type: 'frame', parentId: null, x: 0, y: 0, w: 200, h: 40, isInstance: true, sourceId: 'm', behavior: { version: 2, props: {} }, varModes: {}, fills: white, radius: 6, stroke: '#000000', strokeWidth: 1, strokeAlign: 'inside' };
  const { root } = toDomTree({ pages: [{ id: 'p', name: 'Screens', nodes: [m, v, inst] }], variables: ivars }, 'i1');
  const borders = borderElements(root);
  assert.equal(borders.length, 1, `one border element, saw ${borders.length}`);
  assert.equal(borders[0], root, 'the host draws the border');
});

test('Play: solid opaque uses padding-box, dashed/translucent use border-box', () => {
  const solid = toDomTree({ pages: [{ id: 'p', name: 'Screens', nodes: [buttonMaster(), buttonInstance('btn', { stroke: '#18181b', strokeWidth: 1, strokeStyle: undefined })] }], variables: bvars }, 'i1').root;
  assert.equal(solid.style.backgroundClip, 'padding-box', 'solid opaque clips the fill inside the border');
  const dashed = toDomTree({ pages: [{ id: 'p', name: 'Screens', nodes: [buttonMaster(), buttonInstance('btn', { stroke: '#18181b', strokeWidth: 1, strokeStyle: 'dash' })] }], variables: bvars }, 'i1').root;
  assert.equal(dashed.style.backgroundClip, 'border-box', 'dashed lets the fill show through the gaps');
  const translucent = toDomTree({ pages: [{ id: 'p', name: 'Screens', nodes: [buttonMaster(), buttonInstance('btn', { stroke: '#18181b33', strokeWidth: 1, strokeStyle: undefined })] }], variables: bvars }, 'i1').root;
  assert.equal(translucent.style.backgroundClip, 'border-box', 'translucent matches canvas, where the fill sits under the stroke');
});

test('Play custom dash/gap: the SVG overlay draws the border and the host draws none', () => {
  const master = buttonMaster();
  const inst = buttonInstance('btn', { stroke: '#18181b', strokeWidth: 2, strokeStyle: 'dash', strokeDash: 6, strokeGap: 4 });
  const { root } = toDomTree({ pages: [{ id: 'p', name: 'Screens', nodes: [master, inst] }], variables: bvars }, 'i1');
  const borders = borderElements(root);
  assert.equal(borders.length, 1, `one border element in the custom case, saw ${borders.length}`);
  assert.notEqual(borders[0], root, 'the SVG overlay draws the border, not the host');
  assert.ok(borders[0].html?.includes('stroke-dasharray'), 'the overlay draws the custom pattern');
  assert.equal(root.style.borderStyle, 'none', 'the host draws no border style while the overlay draws');
  assert.equal(root.style.borderWidth, '0px', 'the host draws no border width while the overlay draws');
});

test('Export Button: the host carries border and background, no ::before border, no border-width: 0', () => {
  const css = generateComponent(TEMPLATES.get('button'), bmodel.binding, bvars, 'Button', buttonMaster(), () => []).files['Button.css'];
  assert.doesNotMatch(css, /\.button::before\s*\{[^}]*border-width/, 'no ::before border');
  assert.doesNotMatch(css, /border-width:\s*0;/, 'no host border-width: 0 workaround');
  assert.match(css, /\.button\s*\{[^}]*border-width:\s*1px;/, 'the host carries the border width');
  assert.match(css, /\.button\s*\{[^}]*border-style:/, 'the host carries the border style');
  assert.match(css, /\.button\s*\{[^}]*background-color:\s*var\(--button-bg\);/, 'the host carries the background');
});

test('Export Input: the host carries border and background, no ::before border', () => {
  const m = inputMaster();
  const css = generateComponent(TEMPLATES.get('input'), imodel.binding, ivars, 'Input', m, id => (id === m.id ? [inputValue()] : [])).files['Input.css'];
  assert.doesNotMatch(css, /\.input::before\s*\{[^}]*border-width/, 'no ::before border');
  assert.match(css, /\.input\s*\{[^}]*border-width:\s*1px;/, 'the host carries the border width');
});

test('No generated stylesheet contains an inline comment', () => {
  const bcss = generateComponent(TEMPLATES.get('button'), bmodel.binding, bvars, 'Button', buttonMaster(), () => []).files['Button.css'];
  const m = inputMaster();
  const icss = generateComponent(TEMPLATES.get('input'), imodel.binding, ivars, 'Input', m, id => (id === m.id ? [inputValue()] : [])).files['Input.css'];
  const { styles: bplay } = toDomTree({ pages: [{ id: 'p', name: 'Screens', nodes: [buttonMaster(), buttonInstance('btn')] }], variables: bvars }, 'i1');
  assert.ok(!bcss.includes('/*'), 'export Button has no /*');
  assert.ok(!icss.includes('/*'), 'export Input has no /*');
  assert.ok(!(bplay ?? '').includes('/*'), 'Play stylesheet has no /*');
});

test('Play host is byte-identical across states except classes and attrs', () => {
  const master = buttonMaster();
  const base = buttonInstance('btn');
  const docOf = inst => ({ pages: [{ id: 'p', name: 'Screens', nodes: [master, inst] }], variables: bvars });
  const strip = root => {
    const { attrs, ...rest } = root;
    return JSON.stringify({ ...rest, children: rest.children.map(c => JSON.stringify(c)) });
  };
  const rest = strip(toDomTree(docOf(base), 'i1').root);
  const hovered = strip(toDomTree(docOf({ ...base, id: 'i1' }), 'i1').root);
  assert.equal(hovered, rest, 'the host element carries no state in its inline style');
});
