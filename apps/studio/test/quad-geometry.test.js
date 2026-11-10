// A node with no area and no stroke emits no quad (a zero-height frame was drawn as a half-alpha line as wide as the frame), and a raster
// quad's edges land on device pixels, so a texel row is not smeared over two pixel rows. Both are pure (atlasPacker.js); midas.js calls them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hasDrawableArea, snapQuad } from '../src/engine/atlasPacker.js';

test('a node draws only if it has area or a stroke', () => {
    assert.equal(hasDrawableArea(200, 0, 0), false);
    assert.equal(hasDrawableArea(0, 60, 0), false);
    assert.equal(hasDrawableArea(24, 0, 0), false);
    assert.equal(hasDrawableArea(0, 0, 0), false);
    assert.equal(hasDrawableArea(200, 0, 2), true, 'a stroked line is a line');
    assert.equal(hasDrawableArea(56, 24, 0), true);
});

test('the renderer asks before it writes a quad', () => {
    const src = fs.readFileSync(new URL('../src/engine/midas.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const push = src.indexOf('const push = (s, n, clipId, shadow = null, tile = null) => {');
    assert.ok(push > 0);
    assert.match(src.slice(push, push + 400), /hasDrawableArea\(n\.w, n\.h, this\.paintOf\(n\)\.strokeW\)/);
    assert.match(src, /snapQuad\(/);
});

test('snapped edges land on device pixels across zooms, DPRs and fractional offsets', () => {
    for (const zoom of [0.02, 0.1, 0.25, 0.4, 0.6, 1, 1.75, 4, 16, 46.69, 256]) for (const dpr of [1, 2, 3]) for (const off of [0, .13, .5, .87, 12.345, -7.77]) {
        const k = zoom * dpr, m = [1, 0, 0, 1, 0, 0];
        const q = snapQuad(off + 3.3, off + 1.1, 40.7, 16.2, m, zoom, dpr);
        if (!q) { assert.ok(16.2 * k < 2, `zoom ${zoom} dpr ${dpr}: only a quad under two device pixels may stay unsnapped`); continue; }
        for (const edge of [q.x, q.y, q.x + q.w, q.y + q.h]) assert.ok(Math.abs(edge * k - Math.round(edge * k)) < 1e-6, `zoom ${zoom} dpr ${dpr} off ${off}: edge ${edge * k}`);
        assert.ok(Math.abs(q.x - (off + 3.3)) <= .5 / k + 1e-9 && Math.abs(q.x + q.w - (off + 3.3 + 40.7)) <= .5 / k + 1e-9, 'moves by at most half a device pixel');
    }
});

test('two neighbouring quads that share an edge still share it after snapping (no seam, no overlap)', () => {
    for (const zoom of [0.25, 0.4, 0.6, 1.75, 46.69]) for (const dpr of [1, 2]) {
        const m = [1, 0, 0, 1, 0, 0], a = snapQuad(10.3, 5.7, 6.05, 6.05, m, zoom, dpr), b = snapQuad(10.3 + 6.05, 5.7, 6.05, 6.05, m, zoom, dpr);
        assert.ok(Math.abs(a.x + a.w - b.x) < 1e-9, `zoom ${zoom} dpr ${dpr}: ${a.x + a.w} vs ${b.x}`);
    }
});

test('a scaled quad keeps its edges on device pixels; a rotated or flipped quad is left alone', () => {
    const q = snapQuad(1.37, 2.91, 10, 5, [2, 0, 0, 2, 0, 0], 1.75, 2);
    for (const edge of [q.x, q.y, q.x + 2 * q.w, q.y + 2 * q.h]) assert.ok(Math.abs(edge * 3.5 - Math.round(edge * 3.5)) < 1e-6);
    assert.equal(snapQuad(1, 1, 10, 5, [0.7, 0.7, -0.7, 0.7, 0, 0], 1, 1), null);
    assert.equal(snapQuad(1, 1, 10, 5, [-1, 0, 0, 1, 0, 0], 1, 1), null);
});
