// Switch handle geometry (round 4): the real Play output (generated CSS + DOM) is measured
// as boxes. The track hugs its content with the token width as the minimum (44 default,
// 28 small); the handle (18, small 12) is placed by alignment — flex-start unchecked,
// flex-end checked — so the travel always spans the real track width. For both sizes,
// checked and unchecked, idle and pressed, the handle rect must lie inside the track
// minus padding. Pressed grows 4px toward the inside, never past the padding.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { modelFor, instanceFor } from './helpers/box-template.js';
import { elementsOf } from './helpers/play-compute.js';
import { styleOf, paddingOf, borderOf, length, calcPx, translateXOf } from './helpers/play-geometry.js';

/** A px length from a resolved value (plain px or the calc() the motion rules emit). */
const px = v => {
    const s = String(v ?? '').trim();
    const m = /^calc\((.*)\)$/.exec(s);
    return m ? calcPx(m[1]) : length(s);
};

const sw = TEMPLATES.get('switch');
const EXPECT = { default: { min: 44, h: 22, handle: 18 }, small: { min: 28, h: 16, handle: 12 } };

function modesOf(model, size) {
    return Object.fromEntries(Object.entries(model.binding.variables).map(([prop, cid]) => {
        const coll = model.variables.collections.find(c => c.id === cid);
        const want = prop === 'size' ? size : (model.template.props[prop].defaultMode ?? coll.modes[0].name);
        return [prop, coll.modes.find(m => m.name === want).id];
    }));
}

function playTree(size, checked) {
    const model = modelFor(sw);
    const nodes = instanceFor(model, { checked });
    nodes[0].varModes = Object.fromEntries(Object.entries(model.binding.variables).map(([prop, cid]) => [cid, modesOf(model, size)[prop]]));
    const frame = { id: 'top', name: 'Top', type: 'frame', parentId: null, layout: 'vertical', x: 0, y: 0, w: 400, h: 400, fills: [], layoutSizingH: 'hug', layoutSizingV: 'hug' };
    nodes[0].parentId = 'top';
    const { root, styles, problems } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [frame, model.frame, ...model.created, ...nodes] }], variables: model.variables }, 'top');
    assert.deepEqual(problems, []);
    return { root, styles };
}

/** Declarations of :active rules for the handle that apply when checked is as given. */
function activeDecls(css, checked) {
    const out = {};
    for (const m of css.matchAll(/([^{}@]+)\{([^}]*)\}/g)) {
        for (const sel of m[1].split(',')) {
            const s = sel.trim();
            if (!s.includes(':active') || !s.endsWith('.switch-handle')) continue;
            if (s.includes('[data-checked]') !== checked) continue;
            if (/:disabled(?!\))/.test(s)) continue;
            for (const d of m[2].matchAll(/([a-z-]+)\s*:\s*([^;]+);/g)) out[d[1]] = d[2].trim();
        }
    }
    return out;
}

function resolveVars(value, vars) {
    return value.replace(/var\((--[a-z0-9-]+)\)/g, (_, v) => vars[v] ?? `var(${v})`);
}

for (const size of ['default', 'small']) {
    for (const checked of [false, true]) {
        for (const pressed of [false, true]) {
            test(`switch ${size} ${checked ? 'checked' : 'unchecked'} ${pressed ? 'pressed' : 'idle'}: handle lies inside track minus padding`, () => {
                const { root, styles } = playTree(size, checked);
                const found = elementsOf(root);
                const track = found.find(({ el }) => el.attrs?.class === 'switch');
                const handle = found.find(({ el, chain }) => el.attrs?.class === 'switch-handle' && chain.includes(track.el));
                const trackStyle = styleOf(styles, track.chain);
                let handleStyle = styleOf(styles, handle.chain);
                if (pressed) {
                    // The generic pressed rule (no checked-specific one: alignment holds the far edge).
                    const decls = activeDecls(styles, false);
                    assert.deepEqual(Object.keys(decls), ['width'], 'one press rule, no checked variant');
                    handleStyle = { ...handleStyle };
                    for (const [p, v] of Object.entries(decls)) handleStyle[p] = resolveVars(v, trackStyle);
                }
                // The track hugs: no width declaration, the token minimum clamps the content.
                assert.equal(trackStyle.width, undefined, 'the track hugs: no fixed width');
                const tmin = px(trackStyle['min-width']);
                assert.equal(tmin, EXPECT[size].min, 'min-width is the track token');
                assert.equal(px(trackStyle.height), EXPECT[size].h, 'track height');
                const pad = paddingOf(trackStyle), border = borderOf(trackStyle);
                assert.deepEqual([pad.l, pad.r, pad.t, pad.b], [2, 2, 2, 2], 'track padding is 2');
                assert.deepEqual([border.l, border.r, border.t, border.b], [0, 0, 0, 0], 'track draws no border of its own');
                const hw = px(handleStyle.width);
                const wantIdle = EXPECT[size].handle, wantPressed = pressed ? wantIdle + 4 : wantIdle;
                assert.equal(hw, wantPressed, `handle width ${pressed ? '(grown)' : ''}`);
                // Alignment places the handle: start unchecked, end checked (no transform travel).
                assert.equal(translateXOf(handleStyle.transform), 0, 'no transform travel: alignment slides the handle');
                assert.equal(trackStyle['justify-content'], checked ? 'flex-end' : 'flex-start', `root justifies to the ${checked ? 'end' : 'start'}`);
                const tw = Math.max(tmin, pad.l + hw + pad.r);
                assert.ok(pad.l + hw + pad.r <= tmin + 0.5, 'the bare track fits its minimum');
                const hx = checked ? tw - pad.r - hw : pad.l;
                const contentH = px(trackStyle.height) - pad.t - pad.b;
                const hy = pad.t + (contentH - px(handleStyle.height)) / 2;
                const hh = px(handleStyle.height);
                assert.ok(hx >= pad.l - 0.5, `handle starts inside left padding (x=${hx.toFixed(2)})`);
                assert.ok(hx + hw <= tw - pad.r + 0.5, `handle ends inside right padding (right=${(hx + hw).toFixed(2)} vs ${tw - pad.r})`);
                assert.ok(hy >= pad.t - 0.5 && hy + hh <= px(trackStyle.height) - pad.b + 0.5, 'handle fits vertically');
            });
        }
    }
}
