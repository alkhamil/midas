// Play glyph geometry (round 4): the real Play output (generated CSS + DOM) is measured
// as boxes, not rules. Per state x Checkbox/Radio the glyph centre must equal the box
// centre within 0.5px at rest and at the animation end state, and the draw-in must
// compose with centring (no translate in its from-frame, centred origin, backwards fill).
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { modelFor, instanceFor } from './helpers/box-template.js';
import { elementsOf } from './helpers/play-compute.js';
import { styleOf, flexChildOffset, centreOf, length } from './helpers/play-geometry.js';

const GLYPH_SLOTS = { checkbox: ['check', 'indeterminate'], radio: ['dot'] };
const STATES = ['unchecked', 'checked', 'indeterminate', 'disabled', 'disabled+checked'];
const PROPS = {
    unchecked: {}, checked: { checked: true }, indeterminate: { indeterminate: true },
    disabled: { disabled: true }, 'disabled+checked': { disabled: true, checked: true },
};
const on = (slot, props) => slot === 'indeterminate' ? props.indeterminate === true : props.checked === true;

function playTree(id, props) {
    const model = modelFor(TEMPLATES.get(id));
    const nodes = instanceFor(model, props);
    const frame = { id: 'top', name: 'Top', type: 'frame', parentId: null, layout: 'vertical', x: 0, y: 0, w: 400, h: 400, fills: [], layoutSizingH: 'hug', layoutSizingV: 'hug' };
    nodes[0].parentId = 'top';
    const { root, styles, problems } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [frame, model.frame, ...model.created, ...nodes] }], variables: model.variables }, 'top');
    assert.deepEqual(problems, []);
    return { root, styles };
}

/** The @keyframes from-frame declarations of a named animation in the CSS text. */
function keyframeFrom(css, name) {
    const m = new RegExp(`@keyframes ${name} \\{\\s*from \\{([^}]*)\\}`).exec(css);
    assert.ok(m, `@keyframes ${name} exists`);
    return Object.fromEntries([...m[1].matchAll(/([a-z-]+)\s*:\s*([^;]+);/g)].map(x => [x[1], x[2].trim()]));
}

/** The animation shorthand of the first rule whose selector targets `sel` (as its subject). */
function animationOf(css, sel) {
    for (const m of css.matchAll(/([^{}@]+)\{([^}]*)\}/g)) {
        if (m[1].split(',').map(s => s.trim().split(/\s+/).pop()).some(last => last === sel || last?.startsWith(`${sel}:`))) {
            const a = /animation\s*:\s*([^;]+);/.exec(m[2]);
            if (a) return a[1].trim();
        }
    }
    return null;
}

for (const [id, slots] of Object.entries(GLYPH_SLOTS)) {
    for (const slot of slots) {
        for (const state of STATES) {
            if (id === 'radio' && state === 'indeterminate') continue;
            test(`${id} ${slot} ${state}: Play glyph centre equals box centre within 0.5px`, () => {
                const props = PROPS[state];
                const { root, styles } = playTree(id, props);
                const box = elementsOf(root).find(({ el }) => el.attrs?.class === `${id}-box`);
                const glyph = elementsOf(root).find(({ el }) => el.attrs?.class === `${id}-${slot}`);
                assert.ok(box && glyph, 'box and glyph elements exist');
                const boxStyle = styleOf(styles, box.chain);
                const glyphStyle = styleOf(styles, glyph.chain);
                // No manual positioning: the glyph is a flow item centred by its box.
                assert.ok(!glyphStyle.position || glyphStyle.position === 'static', 'glyph is not absolutely positioned');
                assert.ok(glyphStyle.margin === undefined || glyphStyle.margin === '0px', 'glyph has no manual offsets');
                const gw = length(glyphStyle.width), gh = length(glyphStyle.height);
                assert.ok(gw !== null && gh !== null && gw > 0 && gh > 0, `glyph has a resolved size (got ${glyphStyle.width} x ${glyphStyle.height})`);
                const at = flexChildOffset(boxStyle, gw, gh);
                assert.ok(at, `box has a resolved size (got ${boxStyle.width} x ${boxStyle.height})`);
                const boxC = centreOf(0, 0, at.boxW, at.boxH);
                const glyphC = centreOf(at.x, at.y, gw, gh);
                assert.ok(Math.abs(glyphC.x - boxC.x) <= 0.5, `centred horizontally (glyph ${glyphC.x.toFixed(2)} vs box ${boxC.x.toFixed(2)})`);
                assert.ok(Math.abs(glyphC.y - boxC.y) <= 0.5, `centred vertically (glyph ${glyphC.y.toFixed(2)} vs box ${boxC.y.toFixed(2)})`);
            });
        }
    }
}

for (const [id, slot, animState] of [['checkbox', 'check', 'checked'], ['checkbox', 'indeterminate', 'indeterminate'], ['radio', 'dot', 'checked']]) {
    test(`${id} ${slot}: the draw-in composes with centring and ends at the rest state`, () => {
        const props = { [animState === 'indeterminate' ? 'indeterminate' : 'checked']: true };
        const { root, styles } = playTree(id, props);
        const glyph = elementsOf(root).find(({ el }) => el.attrs?.class === `${id}-${slot}`);
        const glyphStyle = styleOf(styles, glyph.chain);
        // No transform-origin override: scaling/rotation stays around the glyph centre.
        assert.ok(glyphStyle['transform-origin'] === undefined, 'no transform-origin override (default 50% 50% keeps the centre)');
        const anim = animationOf(styles, `.${id}-${slot}`);
        const name = (anim ?? '').split(/\s+/)[0];
        assert.ok(name?.startsWith('midas-'), `the glyph plays a draw-in (${anim})`);
        // The from-frame carries no translation, so the entrance never leaves the centre.
        const from = keyframeFrom(styles, name);
        assert.ok(!/translate/.test(from.transform ?? ''), `from-frame has no translate (${from.transform})`);
        // Backwards fill: during the delay the glyph shows the from-frame, then lands on rest.
        assert.ok(/\bbackwards\b|\bboth\b/.test(anim), `animation fills backwards through the delay (${anim})`);
    });
}
