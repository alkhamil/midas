// Parity of Input (password and textarea kinds) and InputNumber between the canvas node tree and Play, per Size and state, on the masters as well as the instances. No
// browser: Play's boxes are computed from the generated stylesheet and the descriptor tree (play-compute.js), the canvas's from the nodes the engine builds and the tokens they
// are bound to.
//  - a glyph is the size token wide and high, on both surfaces, and is shown in Play exactly when the canvas holds its layer;
//  - the row is centred on both axes; the text area column starts at the top left;
//  - the text area field is at least rows x line height tall, as rowsBounds gives the canvas text layers, to the pixel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { rowsBounds } from '../src/behavior-engine/display.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { previewOf } from '../src/behavior-engine/preview.js';
import { cssVarOf } from '../src/behavior-engine/tokens.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { modelFor, instanceFor } from './helpers/box-template.js';
import { computed, elementsOf } from './helpers/play-compute.js';

const SIZES = ['xs', 'sm', 'md', 'lg', 'xl'];
const GLYPH_CASES = [
    { id: 'input', label: 'password', kind: { kind: 'password' }, slots: ['eyeOn', 'eyeOff'],
        states: { default: {}, disabled: { disabled: true }, visible: { passwordVisible: true }, 'no toggle': { visibilityToggle: false }, 'with suffix': { hasSuffix: true, suffixText: 'kg' } } },
    { id: 'input', label: 'textarea grip', kind: { kind: 'textarea' }, slots: ['resizeHandle'],
        states: { default: { resize: 'vertical' }, none: {}, counted: { resize: 'vertical', showCount: true, value: 'abc' }, disabled: { resize: 'vertical', disabled: true } } },
    { id: 'inputnumber', label: 'inputnumber', kind: {}, slots: ['stepUp', 'stepDown'],
        states: { default: {}, disabled: { disabled: true }, 'at max': { value: '9', max: 9 }, 'at min': { value: '0', min: 0 }, 'no controls': { controls: false }, 'position none': { controlsPosition: 'none' } } },
];

/** The modes keyed by variable prop at one Size, as previewOf takes them. */
function modesOf(model, size) {
    return Object.fromEntries(Object.entries(model.binding.variables).map(([prop, cid]) => {
        const coll = model.variables.collections.find(c => c.id === cid);
        const want = prop === 'size' ? size : model.template.props[prop].defaultMode ?? coll.modes[0].name;
        return [prop, (coll.modes.find(m => m.id === want || m.name === want) ?? coll.modes[0]).id];
    }));
}
/** Play for an instance at one Size: its elements and the stylesheet. The page sets the size mode on the instance, as the editor does. */
function playOf(model, props, size) {
    const nodes = instanceFor(model, { ...model.template.sampleProps, ...props });
    const sizeCollection = model.binding.variables.size;
    const mode = model.variables.collections.find(c => c.id === sizeCollection).modes.find(m => m.name === size);
    nodes[0].varModes = { ...nodes[0].varModes, [sizeCollection]: mode.id };
    const frame = { id: 'top', name: 'Top', type: 'frame', parentId: null, layout: 'vertical', x: 0, y: 0, w: 600, h: 600, fills: [], layoutSizingH: 'hug', layoutSizingV: 'hug' };
    nodes[0].parentId = 'top';
    const out = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [frame, model.frame, ...model.created, ...nodes] }], variables: model.variables }, 'top');
    assert.deepEqual(out.problems, []);
    return { nodes, ...out };
}
function evalLength(expr, inline) {
    const filled = String(expr).replace(/var\((--[a-z0-9-]+)(?:,\s*([^()]*))?\)/g, (_, name, fallback) => inline[name] ?? fallback ?? 'NaN');
    if (/var\(/.test(filled)) return evalLength(filled, inline);
    return Function(`"use strict"; return (${filled.replace(/calc/g, '').replace(/px/g, '')});`)();
}

for (const { id, label, kind, slots, states } of GLYPH_CASES) {
    const template = TEMPLATES.get(id);
    const model = modelFor(template);
    for (const size of SIZES) {
        for (const [state, extra] of Object.entries(states)) {
            const props = { ...kind, ...extra };
            test(`${label} ${size} ${state}: each glyph is the size token on the canvas and in Play, and Play shows it exactly when the canvas holds its layer`, () => {
                const { nodes, root, styles } = playOf(model, props, size);
                const resolved = resolveProps(template, { ...template.sampleProps, ...props });
                const { vars } = previewOf(template, model.binding, modesOf(model, size), model.variables, resolved, 'default');
                for (const slot of slots) {
                    const layer = nodes.find(n => n.behavior?.slot === slot);
                    const el = elementsOf(root).find(({ el }) => el.attrs?.class === `${id}-${slot}`);
                    const drawn = !!el && computed(styles, el.chain).display !== 'none';
                    assert.equal(drawn, !!layer, `${label} ${state}: ${slot} is drawn exactly when the canvas has the layer`);
                    if (!layer) continue;
                    // A glyph takes its size from its display map; an icon slot from its icon def's size token.
                    const sizeToken = template.display[slot]?.size ?? template.icons.find(d => d.slot === slot).tokens.size;
                    const token = vars[cssVarOf(id, sizeToken)];
                    assert.ok(token, `${slot}: the size token resolves at ${size}`);
                    const play = computed(styles, el.chain);
                    assert.equal(play.width, token, `${slot} width at ${size}`);
                    assert.equal(play.height, token, `${slot} height at ${size}`);
                    assert.equal(layer.layoutSizingH, 'fixed');
                    assert.equal(layer.layoutSizingV, 'fixed');
                }
            });
        }
    }
}

for (const [id, props] of [['input', {}], ['input', { kind: 'password' }], ['inputnumber', {}]]) {
    const template = TEMPLATES.get(id);
    const model = modelFor(template);
    for (const size of SIZES) {
        test(`${id} ${props.kind ?? 'text'} ${size}: the row is centred on both axes on the canvas master and in Play`, () => {
            const { root, styles } = playOf(model, props, size);
            assert.equal(model.frame.counterAlign, 'center', 'canvas: cross axis centred');
            const rule = computed(styles, elementsOf(root).find(({ el }) => el.attrs?.class === id).chain);
            assert.equal(rule['align-items'], 'center', 'Play: align-items centre');
            assert.equal(rule['flex-direction'] ?? 'row', 'row');
        });
    }
}

{
    const template = TEMPLATES.get('input');
    const model = modelFor(template);
    const STATES = { default: {}, 'with value': { value: 'one\ntwo' }, counted: { showCount: true, value: 'abc', maxLength: 20 }, disabled: { disabled: true }, 'auto size': { autoSize: true, minRows: 2, maxRows: 6 }, 'five rows': { rows: 5 } };
    for (const size of SIZES) {
        for (const [state, extra] of Object.entries(STATES)) {
            test(`textarea ${size} ${state}: Play's field is rows x line height tall at least, as the canvas text layers are given it`, () => {
                const props = { kind: 'textarea', ...extra };
                const { root, styles } = playOf(model, props, size);
                const resolved = resolveProps(template, { ...template.sampleProps, ...props });
                const { vars } = previewOf(template, model.binding, modesOf(model, size), model.variables, resolved, 'default');
                const lineHeight = parseFloat(vars[cssVarOf('input', 'valueTypography') + '-line-height']);
                assert.ok(lineHeight > 0, 'the line height token resolves');
                const bounds = rowsBounds(template, resolved, { lineHeight });
                const host = elementsOf(root).find(({ el }) => el.attrs?.class === 'input');
                const field = computed(styles, elementsOf(root).find(({ el }) => el.tag === 'textarea').chain);
                const inline = Object.fromEntries(Object.entries(host.el.style).filter(([k]) => k.startsWith('--')));
                assert.equal(evalLength(field['min-height'], inline), bounds.minH, `${state}: min-height at ${size}`);
                if (bounds.maxH === null) assert.ok(field['max-height'] === undefined || Number.isNaN(evalLength(field['max-height'], inline)), `${state}: no max without maxRows`);
                else assert.equal(evalLength(field['max-height'], inline), bounds.maxH, `${state}: max-height at ${size}`);
            });
        }
    }

    test('textarea: the column starts at the top; the count is right aligned and fills the width, in the footer, on the canvas and in Play', () => {
        const props = { kind: 'textarea', showCount: true, value: 'abc', maxLength: 20 };
        const nodes = instanceFor(model, { ...template.sampleProps, ...props });
        assert.equal(nodes[0].layout, 'vertical');
        const count = nodes.find(n => n.behavior?.slot === 'countArea');
        assert.equal(count.textAlign, 'right');
        assert.equal(count.layoutSizingH, 'fill');
        const { root, styles } = playOf(model, props, 'md');
        const el = elementsOf(root).find(({ el }) => el.attrs?.['data-role'] === 'count').el;
        assert.equal(el.style.textAlign, 'right');
        assert.equal(computed(styles, elementsOf(root).find(({ el }) => el.attrs?.class === 'input').chain)['flex-direction'], 'column');
    });
}
