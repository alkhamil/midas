// Glyph box geometry (vertical-centring fix): the real Play output (generated CSS + DOM)
// is measured as boxes. The box centres the glyph span by flex (exact on both axes), but
// the svg inside the span is an inline element: its vertical position follows the text
// baseline (the inherited strut), not the span box, so the glyph drifts down while the
// horizontal centre stays exact. The computation below models that inline layout; the fix
// must make the geometry independent of it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { GLYPHS } from '../src/behavior-engine/glyphs.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { modelFor, instanceFor } from './helpers/box-template.js';
import { computed, elementsOf } from './helpers/play-compute.js';

const CASES = [
    ['checkbox', 'check', { checked: true }],
    ['checkbox', 'indeterminate', { indeterminate: true }],
    ['checkbox', 'check', { disabled: true, checked: true }],
    ['radio', 'dot', { checked: true }],
    ['radio', 'dot', { disabled: true, checked: true }],
];

function playTree(id, props) {
    const model = modelFor(TEMPLATES.get(id));
    const nodes = instanceFor(model, props);
    const frame = { id: 'top', name: 'Top', type: 'frame', parentId: null, layout: 'vertical', x: 0, y: 0, w: 400, h: 400, fills: [], layoutSizingH: 'hug', layoutSizingV: 'hug' };
    nodes[0].parentId = 'top';
    const { root, styles, problems } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [frame, model.frame, ...model.created, ...nodes] }], variables: model.variables }, 'top');
    assert.deepEqual(problems, []);
    return { root, styles };
}

const px = v => (/^(-?[\d.]+)px$/.exec(String(v ?? '').trim()) ?? [])[1] === undefined ? null : parseFloat(RegExp.$1);

/** The used font size of the chain: the Play chain declares none, so CSS initial `medium` (16px) applies. */
function fontSizeOf(chainStyles) {
    for (const st of chainStyles) if (st['font-size'] !== undefined) return px(st['font-size']);
    return 16;
}

/**
 * The svg rect inside the fixed-height block span, from the CSS inline formatting model.
 * An inline svg sits on the text baseline: its bottom edge is at the strut baseline, which
 * is half-leading plus ascent below the content top. Nothing in the Play chain declares a
 * font or line-height, so the strut is the initial 16px font at `normal` (modelled 1.2 with
 * a 0.8em ascent, as CSS 2.1 suggests). A `display: block` svg instead fills the span.
 */
function svgRect(spanStyle, spanRect, chainStyles) {
    const w = px(spanStyle.width), h = px(spanStyle.height);
    if (spanStyle.svgDisplay === 'block') return { x: spanRect.x, y: spanRect.y, w, h };
    const F = fontSizeOf(chainStyles);
    const baseline = (1.2 * F - F) / 2 + 0.8 * F;
    return { x: spanRect.x, y: spanRect.y + baseline - h, w, h };
}

/** The ink centre of a glyph definition in its 24-space, placed in a rect. */
function inkCentre(name, rect) {
    const pts = GLYPHS[name].points;
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    return {
        x: rect.x + ((Math.min(...xs) + Math.max(...xs)) / 2 / 24) * rect.w,
        y: rect.y + ((Math.min(...ys) + Math.max(...ys)) / 2 / 24) * rect.h,
    };
}

function geometry(id, slot, props) {
    const { root, styles } = playTree(id, props);
    const found = elementsOf(root);
    const box = found.find(({ el }) => el.attrs?.class === `${id}-box`);
    const glyph = found.find(({ el }) => el.attrs?.class === `${id}-${slot}`);
    assert.ok(box && glyph, `${id} ${slot} renders box and glyph`);
    const boxStyle = computed(styles, box.chain);
    const glyphStyle = computed(styles, glyph.chain);
    // The box: fixed size, border-box, so the content rect is inset by the border on every side.
    const bw = px(boxStyle.width), bh = px(boxStyle.height), border = px(boxStyle['border-width']);
    assert.equal(boxStyle['box-sizing'], 'border-box');
    const content = { x: border, y: border, w: bw - 2 * border, h: bh - 2 * border };
    const contentCentre = { x: content.x + content.w / 2, y: content.y + content.h / 2 };
    // The span: a fixed-size flex item of a centred box, so it sits centred in the content.
    const sw = px(glyphStyle.width), sh = px(glyphStyle.height);
    const spanRect = { x: content.x + (content.w - sw) / 2, y: content.y + (content.h - sh) / 2, w: sw, h: sh };
    // The svg: inline (no display declared anywhere in its chain) or block after the fix.
    const chainStyles = glyph.chain.map((_, i) => computed(styles, glyph.chain.slice(0, i + 1)));
    const svgBlock = new RegExp(`\\.${id}-${slot} svg\\s*\\{[^}]*display:\\s*block`).test(styles);
    const rect = svgRect({ ...glyphStyle, svgDisplay: svgBlock ? 'block' : 'inline' }, spanRect, chainStyles);
    const ink = inkCentre(TEMPLATES.get(id).anatomy.find(s => s.id === slot).glyph, rect);
    return { contentCentre, spanRect, svgRect: rect, ink };
}

for (const [id, slot, props] of CASES) {
    test(`${id} ${slot} ${JSON.stringify(props)}: glyph ink centre equals box content centre on both axes`, () => {
        const { contentCentre, ink } = geometry(id, slot, props);
        assert.ok(Math.abs(ink.x - contentCentre.x) <= 0.5, `horizontal: ink ${ink.x.toFixed(2)} vs content ${contentCentre.x.toFixed(2)}`);
        assert.ok(Math.abs(ink.y - contentCentre.y) <= 0.5, `vertical: ink ${ink.y.toFixed(2)} vs content ${contentCentre.y.toFixed(2)}`);
    });

    test(`${id} ${slot} ${JSON.stringify(props)}: the animation end state centres like the rest state`, () => {
        // The draw-in runs scale/rotate about the default origin (the span centre) and fills
        // backwards only, so the finished state is the rest state: no translate survives it.
        // Read the raw stylesheet: the shared evaluator also matches keyframe/media frames.
        const { styles } = playTree(id, props);
        const own = [...styles.matchAll(new RegExp(`\\.${id}-${slot} \\{([^}]*)\\}`, 'g'))].map(m => m[1]).join('\n');
        assert.ok(!/transform\s*:/.test(own), 'the span rule carries no transform of its own');
        assert.ok(!/transform-origin\s*:/.test(own), 'origin stays the span centre');
        assert.ok(/backwards;/.test(own), 'fill runs backwards only: the finished state is natural');
        const { contentCentre, ink } = geometry(id, slot, props);
        assert.ok(Math.abs(ink.x - contentCentre.x) <= 0.5 && Math.abs(ink.y - contentCentre.y) <= 0.5, 'end state is the centred rest state');
    });
}

test('unchecked checkbox and radio hide the glyph: no geometry to measure', () => {
    for (const id of ['checkbox', 'radio']) {
        const { root, styles } = playTree(id, {});
        const found = elementsOf(root);
        for (const entry of found.filter(({ el }) => /-(check|indeterminate|dot)$/.test(el.attrs?.class ?? ''))) {
            assert.equal(computed(styles, entry.chain).display, 'none', `${entry.el.attrs.class} hidden while off`);
        }
    }
});
