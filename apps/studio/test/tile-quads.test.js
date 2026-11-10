// A tile's quad covers its own tile only (plus the margin on the sides that are the layer's edge, where a stroke may paint), so neighbouring
// quads meet exactly: they used to overlap by two margins and draw the neighbour's content twice (a 1px line along every tile row at high zoom).
// The UVs map the quad into its entry's rect, the margin giving the sampler its neighbours.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planLayer, tileQuad } from '../src/engine/atlasPacker.js';

const entryFor = (t, padding, res) => ({ u: .25, v: .5, du: Math.ceil((t.w + 2 * padding) * res) / 2048, dv: Math.ceil((t.h + 2 * padding) * res) / 2048, w: t.w + 2 * padding, h: t.h + 2 * padding });
const plan = () => planLayer(42.4, 16, 76.1, 2048, 0, { x: -5, y: -5, w: 60, h: 30 });

test('the quads of a layer\'s tiles meet exactly: no overlap, no gap, and together they cover the layer plus its edge margin', () => {
    const { tiles, padding, res } = plan();
    assert.ok(tiles.length > 1);
    const quads = tiles.map(t => tileQuad(t, padding, 42.4, 16, entryFor(t, padding, res)));
    let area = 0;
    for (const q of quads) area += q.w * q.h;
    assert.ok(Math.abs(area - (42.4 + 2 * padding) * (16 + 2 * padding)) < 1e-6, `covers ${area}`);
    for (let i = 0; i < quads.length; i++) for (let j = i + 1; j < quads.length; j++) {
        const a = quads[i], b = quads[j];
        assert.ok(a.ox + a.w <= b.ox + 1e-9 || b.ox + b.w <= a.ox + 1e-9 || a.oy + a.h <= b.oy + 1e-9 || b.oy + b.h <= a.oy + 1e-9, 'quads overlap');
    }
});

test('the UVs stay inside the entry, and an interior side sits inside the margin (the sampler\'s neighbours are in the entry)', () => {
    const { tiles, padding, res } = plan();
    for (const t of tiles) {
        const e = entryFor(t, padding, res), q = tileQuad(t, padding, 42.4, 16, e);
        const [u, v, du, dv] = q.uv;
        assert.ok(u >= e.u - 1e-12 && v >= e.v - 1e-12 && u + du <= e.u + e.du + 1e-12 && v + dv <= e.v + e.dv + 1e-12, 'uv leaves the entry');
        const interiorLeft = t.x > 0, interiorTop = t.y > 0;
        if (interiorLeft) assert.ok(u - e.u >= padding / e.w * e.du - 1e-12, 'left uv inside the margin');
        if (interiorTop) assert.ok(v - e.v >= padding / e.h * e.dv - 1e-12, 'top uv inside the margin');
    }
});

test('a single tile is its whole entry, margin included', () => {
    const { tiles, padding, res } = planLayer(42.4, 16, 4, 2048, 0, { x: -5, y: -5, w: 60, h: 30 });
    assert.equal(tiles.length, 1);
    const e = entryFor(tiles[0], padding, res), q = tileQuad(tiles[0], padding, 42.4, 16, e);
    assert.deepEqual([q.ox, q.oy, q.w, q.h], [-padding, -padding, e.w, e.h]);
    assert.deepEqual(q.uv, [e.u, e.v, e.du, e.dv]);
});
