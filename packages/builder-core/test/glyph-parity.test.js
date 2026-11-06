// Round 3 glyph size/position: canvas and Play agree per state. Sizes come from Size
// tokens (box 16, dot/dash 8, switch tracks/handles/padding); the glyph is centred by
// the box's centre alignment on both surfaces (no manual offsets).
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { planManagedTextBindings, applyBindTokens } from '../src/behavior-engine/bind-tokens.js';
import { previewOf } from '../src/behavior-engine/preview.js';
import { cssVarOf } from '../src/behavior-engine/tokens.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { modelFor, instanceFor } from './helpers/box-template.js';
import { computed, elementsOf } from './helpers/play-compute.js';

const GLYPH_SLOTS = { checkbox: ['check', 'indeterminate'], radio: ['dot'] };
const STATES = ['unchecked', 'checked', 'indeterminate', 'disabled', 'disabled+checked'];
const PROPS = {
    unchecked: {}, checked: { checked: true }, indeterminate: { indeterminate: true },
    disabled: { disabled: true }, 'disabled+checked': { disabled: true, checked: true },
};

/** Modes keyed by variable prop, as previewOf takes them. */
function modesOf(model, sizeName = null) {
    return Object.fromEntries(Object.entries(model.binding.variables).map(([prop, cid]) => {
        const coll = model.variables.collections.find(c => c.id === cid);
        const want = prop === 'size' && sizeName ? sizeName : model.template.props[prop].defaultMode;
        return [prop, (coll.modes.find(m => m.id === want || m.name === want) ?? coll.modes[0]).id];
    }));
}

/** The bound canvas glyph layer for the props (vars applied), with its box. */
function canvasGlyph(id, slot, props) {
    const model = modelFor(TEMPLATES.get(id));
    const nodes = instanceFor(model, props);
    const box = nodes.find(n => n.behavior?.group === 'box');
    const glyph = nodes.find(n => n.behavior?.slot === slot) ?? null;
    if (glyph) {
        const layers = [{ key: slot, node: glyph }];
        applyBindTokens(layers, planManagedTextBindings({ template: model.template, binding: model.binding, props: resolveProps(model.template, props), layers, variables: model.variables }).ops);
    }
    return { model, nodes, box, glyph };
}

/** The Play elements and stylesheet for the same props. */
function playTree(id, props) {
    const model = modelFor(TEMPLATES.get(id));
    const nodes = instanceFor(model, props);
    const frame = { id: 'top', name: 'Top', type: 'frame', parentId: null, layout: 'vertical', x: 0, y: 0, w: 400, h: 400, fills: [], layoutSizingH: 'hug', layoutSizingV: 'hug' };
    nodes[0].parentId = 'top';
    const { root, styles, problems } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [frame, model.frame, ...model.created, ...nodes] }], variables: model.variables }, 'top');
    assert.deepEqual(problems, []);
    return { model, nodes, root, styles };
}

const cssRules = css => [...css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map(m => ({ selector: m[1].trim(), decls: m[2] }));
const ruleFor = (css, selector) => cssRules(css).filter(r => r.selector.split(',').map(s => s.trim()).includes(selector)).map(r => r.decls).join('\n');

for (const [id, slots] of Object.entries(GLYPH_SLOTS)) {
    test(`${id}: the box is a centred container on the canvas`, () => {
        const { box } = canvasGlyph(id, slots[0], {});
        assert.equal(box.primaryAlign, 'center', 'box primary centres the glyph');
        assert.equal(box.counterAlign, 'center', 'box counter centres the glyph');
    });

    for (const slot of slots) {
        for (const state of STATES) {
            if (id === 'radio' && state === 'indeterminate') continue;
            test(`${id} ${slot} ${state}: canvas and Play draw it at the same size, centred`, () => {
                const props = PROPS[state];
                const on = slot === 'indeterminate' ? props.indeterminate === true : props.checked === true;
                const { model, glyph } = canvasGlyph(id, slot, props);
                const { root, styles } = playTree(id, props);
                assert.equal(!!glyph, on, `${id} ${state}: the canvas layer exists exactly when on`);
                const found = elementsOf(root).find(({ el }) => el.attrs?.class === `${id}-${slot}`);
                assert.ok(found, `${id} ${state}: Play has the ${slot} element`);
                const play = computed(styles, found.chain);
                assert.equal(play.display !== 'none', on, `${id} ${state}: shown exactly when on`);
                if (!on) return;
                // Size: the Play element is the token's size, as the canvas layer is.
                const { vars } = previewOf(model.template, model.binding, modesOf(model), model.variables, props, 'default');
                const size = vars[cssVarOf(id, model.template.display[slot].size)];
                assert.ok(size, `${id} ${slot}: the size token resolves`);
                assert.equal(play.width, size, `${id} ${state}: width is the size token`);
                assert.equal(play.height, size, `${id} ${state}: height is the size token`);
                // Centring: the box centres via the schema alignment on both surfaces; the glyph carries no manual offsets.
                const boxRule = ruleFor(styles, `.${id}-box`);
                assert.match(boxRule, /justify-content:\s*center/, `${id} ${state}: Play box centres on the main axis`);
                assert.match(boxRule, /align-items:\s*center/, `${id} ${state}: Play box centres on the cross axis`);
                assert.ok(!play.position || play.position === 'static', `${id} ${state}: glyph is not manually positioned`);
                assert.ok(play.margin === undefined || play.margin === '0px', `${id} ${state}: glyph has no manual offset`);
            });
        }
    }
}

test('checkbox/radio sizes: box 16, border 1, radius 4, dot/dash 8', () => {
    for (const id of ['checkbox', 'radio']) {
        const model = modelFor(TEMPLATES.get(id));
        const { vars } = previewOf(model.template, model.binding, modesOf(model), model.variables, {}, 'default');
        const px = token => vars[cssVarOf(id, token)];
        assert.equal(px('boxSize'), '16px', `${id} box is 16px`);
        assert.equal(px('borderWidth'), '1px', `${id} border is 1px`);
        if (id === 'checkbox') assert.equal(px('boxRadius'), '4px', 'checkbox radius is 4px');
        assert.equal(px('indicatorSize'), '8px', `${id} dot/dash is 8px (50% of box)`);
    }
});

test('switch sizes come from tokens: 44x22 handle 18, small 28x16 handle 12, padding 2; travel is track - handle - 2*padding', () => {
    const template = TEMPLATES.get('switch');
    const model = modelFor(template);
    const px = (vars, token) => vars[cssVarOf('switch', token)];
    for (const [size, w, h, handle] of [['default', '44px', '22px', '18px'], ['small', '28px', '16px', '12px']]) {
        const { vars } = previewOf(template, model.binding, modesOf(model, size), model.variables, {}, 'default');
        assert.equal(px(vars, 'trackWidth'), w, `switch ${size} track width`);
        assert.equal(px(vars, 'trackHeight'), h, `switch ${size} track height`);
        assert.equal(px(vars, 'handleSize'), handle, `switch ${size} handle`);
        assert.equal(px(vars, 'trackPadding'), '2px', 'switch padding is 2');
        const travel = parseFloat(w) - parseFloat(handle) - 2 * parseFloat(px(vars, 'trackPadding'));
        assert.equal(travel, parseFloat(w) - parseFloat(handle) - 4, `switch ${size} travel is track - handle - 2*padding`);
    }
    // The handle slides by alignment (schema field rule), the same rule canvas and Play read.
    const out = generateComponent(template, model.binding, model.variables, 'Switch', model.frame, p => model.created.filter(n => n.parentId === p));
    assert.match(out.files['Switch.css'], /\[data-checked-align="end"\][\s\S]*justify-content:\s*flex-end/, 'checked moves the handle to the end');
    assert.match(out.files['Switch.css'], /\[data-checked-align="start"\][\s\S]*justify-content:\s*flex-start/, 'unchecked keeps it at the start');
});
