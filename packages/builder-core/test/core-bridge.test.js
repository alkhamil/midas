import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coreVersion, paintLayer, pictureExtent, strokeArea } from '../src/core/index.js';
import { strokeAreaAtSize, strokeAreaOf, strokeAreaSourceOf, strokeGeometryOf } from '../src/geometry/stroke-area.js';
import { toDomTree } from '../src/index.js';

/** The coordinates of absolute path data, as [x, y] pairs (every command of the core's output has pairs only). */
const points = d => {
    const n = d.match(/-?\d+(?:\.\d+)?/g).map(Number);
    return Array.from({ length: n.length / 2 }, (_, i) => [n[2 * i], n[2 * i + 1]]);
};
const bounds = d => {
    const p = points(d), xs = p.map(q => q[0]), ys = p.map(q => q[1]);
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
};
const rect = (w, h, r = 0) => [{ op: 'R', w, h, radii: [r, r, r, r] }];

test('the WASM core loads synchronously with the module and answers', () => {
    assert.equal(coreVersion(), '0.1.0');
});

test('stroke area: inside, centre and outside of a box stay inside, around and outside its edges', () => {
    const at = align => bounds(strokeArea(rect(100, 100), { weight: 10, align, join: 'miter' }).d);
    assert.deepEqual(at('inside'), { x0: 0, y0: 0, x1: 100, y1: 100 });
    assert.deepEqual(at('center'), { x0: -5, y0: -5, x1: 105, y1: 105 });
    assert.deepEqual(at('outside'), { x0: -10, y0: -10, x1: 110, y1: 110 });
    assert.equal(strokeArea(rect(100, 100), { weight: 10, align: 'inside' }).rule, 'evenodd');
    assert.equal(strokeArea(rect(100, 100), { weight: 10, align: 'center' }).rule, 'nonzero');
});

test('stroke area: an open path is centred whatever its alignment, and a dash array breaks the stroke', () => {
    const line = [{ op: 'M', x: 0, y: 0 }, { op: 'L', x: 100, y: 0 }];
    const solid = strokeArea(line, { weight: 10, align: 'inside', cap: 'butt', closed: false });
    assert.deepEqual(bounds(solid.d), { x0: 0, y0: -5, x1: 100, y1: 5 });
    const dashed = strokeArea(line, { weight: 2, dashes: [10, 10], cap: 'butt', closed: false });
    assert.equal(dashed.d.match(/M/g).length, 5, 'five dashes of ten on a line of a hundred');
});

test('stroke area: a text outline goes in as commands, so inside and outside work on glyphs', () => {
    const glyph = [
        { op: 'M', x: 0, y: 0 }, { op: 'L', x: 100, y: 0 }, { op: 'L', x: 100, y: 100 }, { op: 'L', x: 0, y: 100 }, { op: 'Z' },
        { op: 'M', x: 30, y: 30 }, { op: 'L', x: 30, y: 70 }, { op: 'L', x: 70, y: 70 }, { op: 'L', x: 70, y: 30 }, { op: 'Z' },
    ];
    const inside = strokeArea(glyph, { weight: 4, align: 'inside', join: 'miter' });
    assert.deepEqual(bounds(inside.d), { x0: 0, y0: 0, x1: 100, y1: 100 });
    assert.ok(inside.d.match(/M/g).length >= 2, 'the counter keeps its own contour');
});

test('stroke area: the same outline and stroke give back the same object, and a bad path throws', () => {
    const a = strokeArea(rect(40, 20, 4), { weight: 2, align: 'inside' });
    assert.equal(strokeArea(rect(40, 20, 4), { weight: 2, align: 'inside' }), a);
    assert.throws(() => strokeArea([{ op: 'M', x: NaN, y: 0 }, { op: 'L', x: 1, y: 1 }], { weight: 1 }), /stroke_area/);
    assert.throws(() => strokeArea([{ op: 'X' }], { weight: 1 }), /commands/);
    assert.throws(() => strokeArea(rect(1, 1), { weight: 1, align: 'sideways' }), /props/);
});

test('a layer is read into stroke geometry once: Midas defaults, per-side widths, open paths', () => {
    const n = { type: 'rect', w: 100, h: 60, strokeWidth: 4, stroke: '#000000', strokeAlign: 'outside', strokeSides: 'custom', strokeT: 4, strokeR: 0, strokeB: 4, strokeL: 0, strokeStyle: 'dash', strokeDash: 6, strokeGap: 3 };
    const g = strokeGeometryOf(n);
    assert.deepEqual([g.align, g.join, g.cap, g.sides, g.dashes, g.closed], ['outside', 'round', 'round', [4, 0, 4, 0], [6, 3], true]);
    const open = strokeGeometryOf({ type: 'line', w: 50, h: 0, strokeWidth: 2, strokeAlign: 'inside' });
    assert.deepEqual([open.align, open.closed, open.sides], ['center', false, null]);
    const { d } = strokeAreaOf({ type: 'rect', w: 100, h: 100, strokeWidth: 4, strokeAlign: 'inside', strokeJoin: 'miter', strokeSides: 'top' });
    assert.deepEqual(bounds(d), { x0: 0, y0: 0, x1: 100, y1: 100 });
});

test('paint layers: linear and radial map directly, angular and diamond are never a radial gradient', () => {
    const stops = [{ pos: 0, color: '#ff0000' }, { pos: 1, color: '#0000ff' }];
    assert.match(paintLayer({ type: 'linear', stops }, 'a', 100, 50).defs, /^<linearGradient id="a" gradientUnits="userSpaceOnUse"/);
    assert.match(paintLayer({ type: 'radial', stops }, 'b', 100, 50).defs, /^<radialGradient id="b"/);
    for (const type of ['angular', 'diamond']) {
        const l = paintLayer({ type, stops }, 'c', 100, 50);
        assert.equal(l.defs, '', type);
        assert.equal(l.flat, true, type);
        assert.match(l.content, /fill="#ff0000"/, type);
    }
    assert.equal(paintLayer({ type: 'solid', color: '#000000' }, 'd', 1, 1), null);
    assert.throws(() => paintLayer({ type: 'noise' }, 'e', 1, 1), /paint_layer/);
});

test('picture extent: one placement for every mode, and null until the picture is measured', () => {
    const image = extra => ({ type: 'image', image: 'a', ...extra });
    assert.deepEqual(pictureExtent(image({ mode: 'fill' }), 120, 80, 16, 16), { x: 0, y: -20, w: 120, h: 120, tile: false, rotation: 0 });
    assert.deepEqual(pictureExtent(image({ mode: 'fit' }), 120, 80, 200, 100), { x: 0, y: 10, w: 120, h: 60, tile: false, rotation: 0 });
    assert.deepEqual(pictureExtent(image({ mode: 'tile', scale: 0.5 }), 300, 200, 40, 20), { x: 0, y: 0, w: 20, h: 10, tile: true, rotation: 0 });
    assert.equal(pictureExtent(image({ mode: 'crop', crop: { scale: 2 }, rotation: 90 }), 100, 100, 200, 100).rotation, 90);
    assert.equal(pictureExtent(image({}), 100, 100), null, 'not measured');
    assert.deepEqual(pictureExtent(image({ iw: 10, ih: 10 }), 100, 100), { x: 0, y: 0, w: 100, h: 100, tile: false, rotation: 0 }, 'the paint own recorded size');
});

test('image adjustments reach the SVG as a filter on the picture', () => {
    const s = paintLayer({ type: 'image', image: 'a', iw: 8, ih: 8, adjust: { exposure: 0.5, saturation: -0.5 } }, 'im', 100, 100, 'data:image/png;base64,AAAA');
    assert.match(s.defs, /<filter id="imf"[^>]*><feComponentTransfer>.*<feColorMatrix type="saturate" values="0.5"\/><\/filter>/);
    assert.match(s.content, /<image [^>]*filter="url\(#imf\)"/);
});

const frameOf = extra => ({ id: 'f1', type: 'frame', name: 'F', x: 0, y: 0, w: 200, h: 100, parentId: null, fills: [{ type: 'solid', color: '#ffffff', visible: true }], strokeWidth: 4, stroke: '#000000', ...extra });
const playOf = n => toDomTree({ pages: [{ id: 'p', name: 'P', nodes: [n] }], assets: {}, variables: {} }, n.id).root;

test('Play draws an outside stroke with a gradient through its area path, not a CSS outline', () => {
    const sf = { type: 'linear', color: '#ff0000', color2: '#0000ff', opacity: 1, visible: true };
    const root = playOf(frameOf({ strokeAlign: 'outside', strokeJoin: 'miter', strokeFill: sf }));
    const json = JSON.stringify(root);
    assert.ok(!root.style.outline, 'a CSS outline cannot take a gradient');
    assert.match(json, /<clipPath id=\\"midas-sp-f1k\\"><path data-area d=\\"M-4 -4L204 -4L204 104L-4 104ZM0 0L200 0L200 100L0 100Z\\" clip-rule=\\"evenodd\\"\/><\/clipPath>/);
    assert.match(json, /<linearGradient id=\\"midas-sp-f1\\" gradientUnits=\\"userSpaceOnUse\\"/);
    assert.equal(root.style.overflowClipMargin, '4px', 'the clip leaves room for the outer part');
    // A plain colour stays a CSS outline, which follows the box.
    const plain = playOf(frameOf({ strokeAlign: 'outside' }));
    assert.equal(plain.style.outline, '4px solid #000000');
});

test('Play: an angular stroke paint is a raster image clipped by the stroke area, never a radial gradient', () => {
    const sf = { type: 'angular', color: '#112233', color2: '#ffffff', opacity: 1, visible: true };
    const root = playOf(frameOf({ strokeAlign: 'outside', strokeFill: sf }));
    const json = JSON.stringify(root);
    assert.ok(!json.includes('radialGradient'));
    assert.match(json, /<image data-raster=/);
    const overlay = root.children.find(c => c.attrs?.['data-stroke-paint']);
    assert.deepEqual(JSON.parse(overlay.attrs['data-stroke-paint']).pad, 4);
});
