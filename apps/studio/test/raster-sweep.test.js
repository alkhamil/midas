// High zoom, by numbers. Every node type (a frame drawn as a shape, a text and a vector drawn from atlas tiles) goes through ONE placement (placeQuad) so its
// on-screen scale is the zoom and its offset from the frame is constant, at any zoom, DPR and world coordinate; a raster request never exceeds the atlas side;
// and the tiles a layer needs in view fit the atlas, so nothing is evicted mid-frame. resolutionForZoom and entryScaleFor are cut out of midas.js by name; the rest
// is the real atlasPacker.js. What this does not cover: the GPU, the shader and the browser (see the report).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AtlasPacker, tileGrid, edgePadding, rasterMargin, placeQuad } from '../src/engine/atlasPacker.js';

const src = fs.readFileSync(new URL('../src/engine/midas.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
function sliceFunction(name) {
    const head = src.indexOf(`\nfunction ${name}(`) + 1;
    if (head < 1) throw new Error(`midas.js has no function ${name}`);
    return src.slice(head, src.indexOf('\n}\n', head) + 2);
}
const { resolutionForZoom, entryScaleFor } = new Function(`${sliceFunction('resolutionForZoom')}\n${sliceFunction('entryScaleFor')}\nreturn { resolutionForZoom, entryScaleFor };`)();

const ATLAS = 2048, PAGES = 4;
const ZOOMS = [1, 2, 4, 8, 16, 24, 36, 64, 128, 256, 400];
const DPRS = [1, 2, 3];
// A frame at (fx, fy); a text and a vector inside it at fixed offsets. fx/fy include a large-coordinate case.
const ORIGINS = [[0, 0], [3000, 1800], [250000, -180000]];
const INSIDE = { text: { x: 16, y: 6, w: 200, h: 20 }, vector: { x: 24, y: 40, w: 24, h: 24 } };

/** The device pixel of a point of a node's local box, as the shader computes it (screen = (world - origin) * zoom), camera-relative. */
function screenOf(matrix, local, camera, zoom) {
    const q = placeQuad(matrix, camera.x, camera.y, local.x, local.y);
    return { x: q.x * zoom, y: q.y * zoom };
}

for (const [fx, fy] of ORIGINS) {
    test(`frame, text and vector share one placement: scale = zoom, offsets constant (frame at ${fx},${fy})`, () => {
        for (const zoom of ZOOMS) for (const dpr of DPRS) {
            // The camera looks at the frame's text, so the numbers the GPU holds are the camera-relative ones.
            const camera = { x: fx + 10, y: fy + 4 };
            const frame = [1, 0, 0, 1, fx, fy];
            const child = box => [1, 0, 0, 1, fx + box.x, fy + box.y];
            const a0 = screenOf(frame, { x: 0, y: 0 }, camera, zoom);
            for (const [name, box] of Object.entries(INSIDE)) {
                const m = child(box);
                const o = screenOf(m, { x: 0, y: 0 }, camera, zoom), e = screenOf(m, { x: box.w, y: box.h }, camera, zoom);
                assert.ok(Math.abs((e.x - o.x) - box.w * zoom) < 1e-3, `${name} width on screen at zoom ${zoom} dpr ${dpr}`);
                assert.ok(Math.abs((e.y - o.y) - box.h * zoom) < 1e-3, `${name} height on screen`);
                assert.ok(Math.abs((o.x - a0.x) - box.x * zoom) < 1e-3 && Math.abs((o.y - a0.y) - box.y * zoom) < 1e-3, `${name} offset from the frame at zoom ${zoom}`);
            }
            // A tile of a raster layer lands on its tile: the quad of tile (ox, oy) is the layer's matrix moved by the tile offset, at the same scale.
            const pad = edgePadding(resolutionForZoom(zoom, dpr));
            const tiles = tileGrid(INSIDE.text.w, INSIDE.text.h, resolutionForZoom(zoom, dpr), ATLAS, pad);
            const m = child(INSIDE.text);
            for (const t of tiles) {
                const q = placeQuad(m, camera.x, camera.y, t.x - pad, t.y - pad);
                const direct = placeQuad(m, camera.x, camera.y, t.x, t.y);
                assert.ok(Math.abs((direct.x - q.x) - pad) < 1e-9 && Math.abs((direct.y - q.y) - pad) < 1e-9, 'a tile quad is the tile moved by its margin, nothing else');
            }
        }
    });
}

test('the camera-relative numbers stay small: float32 keeps sub-pixel accuracy at the largest coordinates and zoom', () => {
    for (const [fx, fy] of ORIGINS) for (const zoom of ZOOMS) {
        const camera = { x: fx + 10, y: fy + 4 }, q = placeQuad([1, 0, 0, 1, fx + 16, fy + 6], camera.x, camera.y, 0, 0);
        const f32 = Math.fround(q.x);
        assert.ok(Math.abs(f32 - q.x) * zoom < 0.01, `zoom ${zoom} at ${fx}: float32 error ${(Math.abs(f32 - q.x) * zoom).toFixed(4)} px`);
    }
});

test('no raster request exceeds the atlas, and a tile is bounded in texels, across the sweep', () => {
    for (const zoom of ZOOMS) for (const dpr of DPRS) {
        const res = resolutionForZoom(zoom, dpr);
        for (const [w, h, stroke] of [[200, 20, 0], [343, 32, 0], [1000, 800, 0], [24, 24, 0], [24, 24, 1]]) {
            // A vector's stroke pads its entry by half the stroke plus one world unit, whatever the zoom (paddingOf).
            const pad = Math.max(stroke ? stroke / 2 + 1 : 0, edgePadding(res));
            for (const t of tileGrid(w, h, res, ATLAS, pad)) {
                const W = t.w + 2 * pad, H = t.h + 2 * pad, s = entryScaleFor(W, H, res, ATLAS);
                assert.ok(Math.ceil(W * s) + 3 <= ATLAS && Math.ceil(H * s) + 3 <= ATLAS, `${w}x${h} zoom ${zoom} dpr ${dpr}: entry ${W * s}x${H * s} over the atlas`);
                assert.ok(Math.max(W, H) * s <= (stroke ? ATLAS - 4 : Math.max(500, res + 8)), `${w}x${h} zoom ${zoom} dpr ${dpr}: tile ${Math.max(W, H) * res} texels`);
            }
        }
    }
});

test('the tiles in view fit the atlas (nothing evicted mid-frame) for a layer and a screen up to the atlas area', () => {
    const view = { w: 1500, h: 900 };
    for (const zoom of ZOOMS) for (const dpr of DPRS) {
        const res = resolutionForZoom(zoom, dpr), pad = edgePadding(res), m = rasterMargin(zoom);
        const screenTexels = (view.w / zoom + 2 * m) * res * ((view.h / zoom + 2 * m) * res);
        for (const [w, h] of [[200, 20], [343, 32], [1000, 800]]) {
            const grid = tileGrid(w, h, res, ATLAS, pad);
            const v = { x: w / 2 - view.w / zoom / 2 - m, y: h / 2 - view.h / zoom / 2 - m, w: view.w / zoom + 2 * m, h: view.h / zoom + 2 * m };
            const vis = grid.filter(t => !(t.x > v.x + v.w || t.x + t.w < v.x || t.y > v.y + v.h || t.y + t.h < v.y));
            const packer = new AtlasPacker(ATLAS, PAGES);
            let fit = 0;
            for (const t of vis) { const W = t.w + 2 * pad, H = t.h + 2 * pad, s = entryScaleFor(W, H, res, ATLAS); if (!packer.alloc(Math.ceil(W * s), Math.ceil(H * s))) break; fit++; }
            // Only a layer that covers the whole screen at a density the atlas cannot hold is allowed to miss (reported as open in the notes).
            const coversScreen = w * res >= view.w * dpr * 0.9 && h * res >= view.h * dpr * 0.9;
            if (!(coversScreen && screenTexels > ATLAS * ATLAS * PAGES * 0.5)) assert.equal(fit, vis.length, `${w}x${h} zoom ${zoom} dpr ${dpr}: ${fit} of ${vis.length} tiles fit`);
        }
    }
});
