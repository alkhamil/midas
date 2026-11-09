// Parity of the Input family between the canvas node tree and Play, per Size and state, on the masters as well as the instances. No browser: Play's boxes are computed from the
// generated stylesheet and the descriptor tree (play-compute.js), the canvas's from the nodes the engine builds and the tokens they are bound to.
//  - a glyph is the size token wide and high, on both surfaces, and is shown in Play exactly when the canvas holds its layer;
//  - the row is centred on both axes (Password, InputNumber), the stepper stacks its arrows centred; the TextArea column starts at the top-left;
//  - the TextArea's min height is rows x line height + padding, as rowsBounds writes it on the canvas root, to the pixel.
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
const GLYPHS = { password: ['eye', 'eyeOff'], inputnumber: ['stepUp', 'stepDown'] };
const STATES = {
    password: { default: {}, disabled: { disabled: true }, visible: { passwordVisible: true }, 'no toggle': { visibilityToggle: false }, 'with suffix': { hasSuffix: true, suffixText: 'kg' } },
    inputnumber: { default: {}, disabled: { disabled: true }, 'at max': { value: '9', max: 9 }, 'at min': { value: '0', min: 0 }, 'no controls': { controls: false }, 'position none': { controlsPosition: 'none' } },
    textarea: { default: {}, 'with value': { value: 'one\ntwo' }, counted: { showCount: true, value: 'abc', maxLength: 20 }, disabled: { disabled: true }, 'auto size': { autoSize: true, minRows: 2, maxRows: 6 }, 'five rows': { rows: 5 } },
};

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
const px = value => parseFloat(String(value));
/** A calc() of px lengths and the element's inline custom properties (--template-rows), as a number of px. Only + and * appear in what the engine writes. */
function evalLength(expr, inline) {
    // A fallback is the text up to the closing bracket that is not nested (var(--a, var(--b)) resolves in passes, innermost first).
    const filled = String(expr).replace(/var\((--[a-z0-9-]+)(?:,\s*([^()]*))?\)/g, (_, name, fallback) => inline[name] ?? fallback ?? 'NaN');
    if (/var\(/.test(filled)) return evalLength(filled, inline);
    return Function(`"use strict"; return (${filled.replace(/calc/g, '').replace(/px/g, '')});`)();
}

for (const [id, slots] of Object.entries(GLYPHS)) {
    const template = TEMPLATES.get(id);
    const model = modelFor(template);
    for (const size of SIZES) {
        for (const [state, props] of Object.entries(STATES[id])) {
            test(`${id} ${size} ${state}: each glyph is the size token on the canvas and in Play, and Play shows it exactly when the canvas holds its layer`, () => {
                const { nodes, root, styles } = playOf(model, props, size);
                const resolved = resolveProps(template, { ...template.sampleProps, ...props });
                const { vars } = previewOf(template, model.binding, modesOf(model, size), model.variables, resolved, 'default');
                for (const slot of slots) {
                    const layer = nodes.find(n => n.behavior?.slot === slot);
                    const el = elementsOf(root).find(({ el }) => el.attrs?.class === `${id}-${slot}`);
                    // In the markup only while its container is (the stepper), and then drawn only while its state holds.
                    const drawn = !!el && computed(styles, el.chain).display !== 'none';
                    assert.equal(drawn, !!layer, `${id} ${state}: ${slot} is drawn exactly when the canvas has the layer`);
                    if (!layer) continue;
                    const token = vars[cssVarOf(id, template.display[slot].size)];
                    assert.ok(token, `${slot}: the size token resolves at ${size}`);
                    const play = computed(styles, el.chain);
                    assert.equal(play.width, token, `${slot} width at ${size}`);
                    assert.equal(play.height, token, `${slot} height at ${size}`);
                    assert.equal(layer.layoutSizingH, 'fixed');
                    assert.equal(layer.layoutSizingV, 'fixed');
                }
            });
        }

        test(`${id} ${size}: the row is centred on both axes on the canvas master and in Play`, () => {
            const { root, styles } = playOf(model, {}, size);
            assert.equal(model.frame.counterAlign, 'center', 'canvas: cross axis centred');
            const rootRule = computed(styles, elementsOf(root).find(({ el }) => el.attrs?.class === id).chain);
            assert.equal(rootRule['align-items'], 'center', 'Play: align-items centre');
            assert.equal(rootRule['flex-direction'] ?? 'row', 'row');
        });
    }
}

test('inputnumber: the stepper stacks its arrows and centres them on both axes, on the canvas and in Play', () => {
    const template = TEMPLATES.get('inputnumber');
    const model = modelFor(template);
    const stepper = instanceFor(model, template.sampleProps).find(n => n.behavior?.slot === 'stepper');
    assert.equal(stepper.layout, 'vertical');
    assert.equal(stepper.primaryAlign, 'center');
    assert.equal(stepper.counterAlign, 'center');
    const { root, styles } = playOf(model, {}, 'md');
    const el = elementsOf(root).find(({ el }) => el.attrs?.class === 'inputnumber-stepper');
    const play = computed(styles, el.chain);
    assert.equal(play['flex-direction'], 'column');
    assert.equal(play['justify-content'], 'center');
    assert.equal(play['align-items'], 'center');
});

for (const size of SIZES) {
    const template = TEMPLATES.get('textarea');
    const model = modelFor(template);
    for (const [state, props] of Object.entries(STATES.textarea)) {
        test(`textarea ${size} ${state}: Play's min height is rows x line height + padding, as the canvas root is given it`, () => {
            const { root, styles } = playOf(model, props, size);
            const resolved = resolveProps(template, { ...template.sampleProps, ...props });
            const { vars } = previewOf(template, model.binding, modesOf(model, size), model.variables, resolved, 'default');
            const metrics = { lineHeight: px(vars[cssVarOf('textarea', 'valueTypography') + '-line-height']), paddingY: px(vars[cssVarOf('textarea', 'paddingY')]) };
            assert.ok(metrics.lineHeight > 0 && metrics.paddingY >= 0, 'the tokens resolve');
            const bounds = rowsBounds(template, resolved, metrics);
            const play = computed(styles, elementsOf(root).find(({ el }) => el.attrs?.class === 'textarea').chain);
            const inline = Object.fromEntries(Object.entries(root.children[0].style ?? {}).filter(([k]) => k.startsWith('--')));
            assert.equal(evalLength(play['min-height'], inline), bounds.minH, `${state}: min-height at ${size}`);
            if (bounds.maxH === null) assert.ok(!/var(--textarea-max-rows)/.test(play['max-height'] ?? '') || Number.isNaN(evalLength(play['max-height'], inline)), `${state}: no max height without maxRows`);
            else assert.equal(evalLength(play['max-height'], inline), bounds.maxH, `${state}: max-height at ${size}`);
        });
    }
}

test('textarea: the column starts at the top left; the count is right aligned and fills the width on the canvas and in Play', () => {
    const template = TEMPLATES.get('textarea');
    const model = modelFor(template);
    assert.equal(model.frame.layout, 'vertical');
    assert.equal(model.frame.counterAlign, 'start');
    const props = { showCount: true, value: 'abc', maxLength: 20 };
    const count = instanceFor(model, { ...template.sampleProps, ...props }).find(n => n.behavior?.slot === 'count');
    assert.equal(count.textAlign, 'right');
    assert.equal(count.layoutSizingH, 'fill');
    const { root, styles } = playOf(model, props, 'md');
    // Play draws the count from its canvas layer: right aligned text stretched across the column.
    const el = elementsOf(root).find(({ el }) => el.attrs?.['data-role'] === 'count').el;
    assert.equal(el.style.textAlign, 'right');
    assert.equal(el.style.alignSelf, 'stretch');
    assert.equal(computed(styles, elementsOf(root).find(({ el }) => el.attrs?.class === 'textarea').chain)['flex-direction'], 'column');
});
