// InputNumber against antd, as structure: the input fills the width; the handler column is attached to the right, the full height inside the border, with a divider on its
// inline-start side and one between the up and down halves, each half 50% of the height, a small chevron centred in each, the outer right corners rounded and the inner ones square.
// Canvas: the column is always there and static. Play and the export: revealed on hover and focus, hover and press colours, a muted half at its limit that takes no click.
// Geometry is computed from the generated stylesheet and the descriptor tree (play-compute.js), not read off a declared rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { previewOf } from '../src/behavior-engine/preview.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { cssVarOf } from '../src/behavior-engine/tokens.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { edgePosition } from '../src/behavior-engine/template-master.js';
import { modelFor, instanceFor } from './helpers/box-template.js';
import { computed, elementsOf } from './helpers/play-compute.js';

const SIZES = ['xs', 'sm', 'md', 'lg', 'xl'];
const number = TEMPLATES.get('inputnumber'), input = TEMPLATES.get('input');
const models = { inputnumber: modelFor(number), input: modelFor(input) };

const modesOf = (model, size) => Object.fromEntries(Object.entries(model.binding.variables).map(([prop, cid]) => {
    const coll = model.variables.collections.find(c => c.id === cid);
    const want = prop === 'size' ? size : model.template.props[prop].defaultMode ?? coll.modes[0].name;
    return [prop, (coll.modes.find(m => m.id === want || m.name === want) ?? coll.modes[0]).id];
}));
const varsAt = (id, size, props = {}) => { const model = models[id]; return previewOf(model.template, model.binding, modesOf(model, size), model.variables, resolveProps(model.template, { ...model.template.sampleProps, ...props }), 'default').vars; };
function playOf(id, props, size) {
    const model = models[id];
    const nodes = instanceFor(model, { ...model.template.sampleProps, ...props });
    const sizeCollection = model.binding.variables.size;
    nodes[0].varModes = { ...nodes[0].varModes, [sizeCollection]: model.variables.collections.find(c => c.id === sizeCollection).modes.find(m => m.name === size).id };
    const frame = { id: 'top', name: 'Top', type: 'frame', parentId: null, layout: 'vertical', x: 0, y: 0, w: 600, h: 600, fills: [], layoutSizingH: 'hug', layoutSizingV: 'hug' };
    nodes[0].parentId = 'top';
    const out = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [frame, model.frame, ...model.created, ...nodes] }], variables: model.variables }, 'top');
    assert.deepEqual(out.problems, []);
    const all = elementsOf(out.root);
    return { ...out, nodes, host: all.find(({ el }) => el.attrs?.class === id), at: cls => all.find(({ el }) => el.attrs?.class === `${id}-${cls}`) };
}
const px = v => parseFloat(String(v));
/** The height of the control from its generated CSS: the taller of the floor (min-height) and the content (the line, with the padding and the border on both sides). */
function controlHeight(id, size, props = {}) {
    const { host, styles } = playOf(id, props, size);
    const vars = varsAt(id, size, props);
    const root = computed(styles, host.chain);
    const border = px(vars[cssVarOf(id, 'borderWidth')]);
    const paddingBlock = Function(`"use strict"; return (${String(root['padding-block']).replace(/max\(/g, 'Math.max(').replace(/calc/g, '').replace(/px/g, '')});`)();
    const line = px(vars[cssVarOf(id, 'valueTypography') + '-line-height']);
    return { height: Math.max(px(root['min-height']), line + 2 * paddingBlock + 2 * border), border, line, root };
}

for (const size of SIZES) {
    test(`${size}: the InputNumber is as tall as the Input, with the same height, padding and line height tokens; the column adds no height`, () => {
        const a = controlHeight('inputnumber', size), b = controlHeight('input', size);
        assert.equal(a.height, b.height, `${size}: InputNumber ${a.height} against Input ${b.height}`);
        assert.equal(a.height, px(varsAt('input', size)[cssVarOf('input', 'height')]) , `${size}: and both are the Size height`);
        assert.equal(a.root['min-height'], b.root['min-height']);
        assert.equal(a.root['padding-block'], b.root['padding-block']);
        // The column is out of the flow, so it cannot make the control taller.
        const { at } = playOf('inputnumber', {}, size);
        assert.equal(computed(playOf('inputnumber', {}, size).styles, at('stepper').chain).position, 'absolute');
    });

    test(`${size}: the column is the full height inside the border and a small control wide; two equal halves, each with its chevron centred and inside it`, () => {
        const { at, styles, nodes } = playOf('inputnumber', {}, size);
        const vars = varsAt('inputnumber', size);
        const height = px(vars[cssVarOf('inputnumber', 'height')]), border = px(vars[cssVarOf('inputnumber', 'borderWidth')]);
        const column = computed(styles, at('stepper').chain);
        // Pinned to the inside of the border on the right, top and bottom: its height is the box's less the border on both sides.
        assert.deepEqual([column.position, column.top, column.right, column.bottom], ['absolute', '0', '0', '0']);
        assert.equal(column.width, vars[cssVarOf('inputnumber', 'stepWidth')]);
        const inner = height - 2 * border, width = px(column.width);
        // The halves share the column by the same flex (fill x fill in a column): equal, and together the whole height.
        const up = computed(styles, at('stepUpBox').chain), down = computed(styles, at('stepDownBox').chain);
        assert.equal(up.flex, down.flex, 'equal shares');
        const shares = (up.flex.split(' ')[0] * 1) / (Number(up.flex.split(' ')[0]) + Number(down.flex.split(' ')[0]));
        assert.equal(shares, 0.5, 'each half is 50%');
        const half = inner / 2;
        assert.equal(half + half, inner, 'the half heights sum to the control height inside the border');
        // The chevron is centred on both axes in its half, and fits it.
        for (const [box, glyph] of [[up, 'stepUp'], [down, 'stepDown']]) {
            assert.equal(box['justify-content'], 'center');
            assert.equal(box['align-items'], 'center');
            const g = computed(styles, at(glyph).chain);
            assert.equal(g.width, g.height, 'a square glyph');
            assert.ok(px(g.width) <= half, `${size}: the chevron (${g.width}) fits the half (${half})`);
            assert.ok(px(g.width) <= width, `${size}: and the column width`);
        }
        // The canvas holds the same: the column pinned to the right edge, the full height inside the border, the halves fill x fill and centring their chevron.
        const stepper = nodes.find(n => n.name === 'stepper');
        assert.deepEqual([stepper.layoutPositioning, stepper.constraintH, stepper.constraintV], ['absolute', 'right', 'stretch']);
        const at2 = edgePosition({ w: 343, h: height }, { w: width }, border);
        assert.deepEqual([at2.x + width + border, at2.y, at2.h], [343, border, inner], 'the column touches the inside of the right border and spans the height inside it');
        for (const name of ['stepUpBox', 'stepDownBox']) {
            const n = nodes.find(x => x.name === name);
            assert.deepEqual([n.layoutSizingH, n.layoutSizingV, n.primaryAlign, n.counterAlign], ['fill', 'fill', 'center', 'center'], name);
        }
    });
}

test('the dividers are the border token on the column\'s inline-start side and on top of the lower half; the outer right corners are rounded to the root radius, the inner ones square', () => {
    const { at, styles } = playOf('inputnumber', {}, 'md');
    const column = computed(styles, at('stepper').chain), up = computed(styles, at('stepUpBox').chain), down = computed(styles, at('stepDownBox').chain);
    const border = varsAt('inputnumber', 'md')[cssVarOf('inputnumber', 'borderWidth')];
    assert.equal(column['border-inline-start-width'], border, 'the inline-start divider of the column is the border token');
    assert.equal(column['border-color'], varsAt('inputnumber', 'md')[cssVarOf('inputnumber', 'step-border')], 'in the divider colour token');
    assert.equal(down['border-top-width'], border, 'the divider between the halves is a border thick');
    assert.equal(up['border-top-width'], undefined, 'nothing above the upper half');
    assert.equal(up['border-inline-start-width'], undefined);
    assert.equal(column['border-top-right-radius'], column['border-bottom-right-radius']);
    assert.equal(column['border-top-right-radius'], varsAt('inputnumber', 'md')[cssVarOf('inputnumber', 'radius')], 'the root radius');
    assert.equal(column['border-top-left-radius'], undefined, 'the inner corners are square');
    assert.equal(column['border-bottom-left-radius'], undefined);
    // Every colour and width is a token: the stylesheet has no literal colour or number in the column's rules.
    const css = generateComponent(number, models.inputnumber.binding, models.inputnumber.variables, 'InputNumber', models.inputnumber.frame, id => models.inputnumber.created.filter(n => n.parentId === id)).files['InputNumber.css'];
    for (const cls of ['stepper', 'stepUpBox', 'stepDownBox', 'stepUp', 'stepDown']) {
        const rules = [...css.matchAll(new RegExp(`\\.inputnumber-${cls} \\{([^}]*)\\}`, 'g'))].map(m => m[1]).join('\n');
        assert.ok(!/#[0-9a-f]{3,8}\b/i.test(rules), `${cls}: no colour literal`);
    }
});

test('hover and press colour the chevron of a half, a half at its limit is muted and takes no click, a disabled control never reveals the column; Play and the export only', () => {
    const css = generateComponent(number, models.inputnumber.binding, models.inputnumber.variables, 'InputNumber', models.inputnumber.frame, id => models.inputnumber.created.filter(n => n.parentId === id)).files['InputNumber.css'];
    const off = ':not(:has(:disabled))';
    assert.ok(css.includes(`.inputnumber:not([data-at-max])${off} .inputnumber-stepUpBox:hover .inputnumber-stepUp {\n  color: var(--inputnumber-step-hover-fg);\n}`), 'hover, not at the max');
    assert.ok(css.includes(`.inputnumber:not([data-at-min])${off} .inputnumber-stepDownBox:hover .inputnumber-stepDown {\n  color: var(--inputnumber-step-hover-fg);\n}`));
    assert.ok(css.includes(`.inputnumber:not([data-at-max])${off} .inputnumber-stepUpBox:active .inputnumber-stepUp {\n  color: var(--inputnumber-step-active-fg);\n}`), 'pressed');
    assert.ok(css.includes('.inputnumber[data-at-max] .inputnumber-stepUpBox {\n  cursor: not-allowed;\n  pointer-events: none;\n}'), 'at the max the up half takes no click');
    assert.ok(css.includes('.inputnumber[data-at-min] .inputnumber-stepDownBox {\n  cursor: not-allowed;\n  pointer-events: none;\n}'));
    assert.match(css, /\[data-at-max\]:not\(:has\(:disabled\)\) \{\s*--inputnumber-step-up-fg: #/, 'and its chevron takes the disabled colour');
    assert.ok(css.includes('.inputnumber:has(:disabled) .inputnumber-stepUpBox {\n  cursor: not-allowed;\n}'));
    assert.match(css, /\.inputnumber:hover:not\(:has\(:disabled\)\) \.inputnumber-stepper,\n\.inputnumber:focus-within:not\(:has\(:disabled\)\) \.inputnumber-stepper \{\s*opacity: 1;/, 'a disabled control never reveals it');
    assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.inputnumber-stepper \{\s*transition: none;/);
    // The canvas knows none of it: no layer is transparent, no hover or press state is drawn.
    for (const n of instanceFor(models.inputnumber, { placeholder: 'x', value: '9', max: 9 })) assert.ok(n.opacity !== 0 && n.visible !== false, n.name);
    assert.ok(!Object.hasOwn(number.previewStates, 'active'));
});

test('no node of the column is hidden, transparent or zero-size, and no fill is an unbound white', () => {
    const white = f => f.type === 'solid' && f.visible !== false && /^#f[a-f0-9]{5}/i.test(f.color);
    for (const props of [{}, { value: '9', max: 9 }, { disabled: true }]) {
        for (const n of instanceFor(models.inputnumber, { ...number.sampleProps, ...props })) {
            assert.ok(n.visible !== false && n.opacity !== 0, n.name);
            assert.ok(!(n.w === 0 && n.h === 0 && n.layoutSizingH === 'fixed' && n.layoutSizingV === 'fixed' && !n.vars?.w && !n.vars?.h), `${n.name} is not zero-size`);
            assert.ok(!(n.fills ?? []).some((f, i) => white(f) && n.vars?.[`fills.${i}`] === undefined), `${n.name} has no unbound white`);
        }
    }
});
