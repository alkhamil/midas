import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tileGrid } from '../src/engine/atlasPacker.js';

// A tile's entry is its size plus the margin on each side; at the requested resolution it must fit the atlas side (size - 4).
const fits = (t, res, size, pad) => (t.w + 2 * pad) * res <= size - 4 + 1e-9 && (t.h + 2 * pad) * res <= size - 4 + 1e-9;

test('a node that fits the atlas at this resolution is one tile', () => {
    assert.deepEqual(tileGrid(100, 40, 2, 2048, 2), [{ x: 0, y: 0, w: 100, h: 40 }]);
});

test('a node too large for the atlas at this resolution is split into tiles that each fit', () => {
    const tiles = tileGrid(656, 24, 11.313708498984761, 2048, 2);
    assert.ok(tiles.length > 1);
    assert.ok(tiles.every(t => fits(t, 11.313708498984761, 2048, 2)));
});

test('tiles cover the node exactly once, in a grid', () => {
    const W = 3000, H = 2000, res = 6, pad = 3;
    const tiles = tileGrid(W, H, res, 2048, pad);
    assert.ok(tiles.every(t => fits(t, res, 2048, pad)));
    const area = tiles.reduce((s, t) => s + t.w * t.h, 0);
    assert.ok(Math.abs(area - W * H) < 1e-6, `covers ${area} of ${W * H}`);
    for (let i = 0; i < tiles.length; i++)
        for (let j = i + 1; j < tiles.length; j++) {
            const a = tiles[i], b = tiles[j];
            assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, 'tiles overlap');
        }
});

test('a node with no size is one tile even at a huge resolution', () => {
    assert.equal(tileGrid(0, 0, 32, 2048, 2).length, 1);
});
