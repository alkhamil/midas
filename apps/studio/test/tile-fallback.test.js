// A tiled layer whose tiles in view are not all ready keeps the last complete raster on screen (as a single-tile layer does) and only falls
// back to the coarse stand-in (4 texels per unit) when no sharper entry can cover the view.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTileSet } from '../src/engine/atlasPacker.js';

const tile = (x, y, w = 8, h = 8) => ({ entry: { id: `${x},${y}` }, ox: x, oy: y, rect: { x, y, w, h } });
const rect = (x, y, w = 8, h = 8) => ({ x, y, w, h });
const sharp = [tile(0, 0), tile(8, 0), tile(0, 8), tile(8, 8)];
const coarse = () => { throw new Error('the coarse stand-in must not be made while a sharper entry covers the view'); };

test('all tiles ready: the fresh tiles are drawn', () => {
    const fresh = [tile(0, 0)];
    assert.equal(resolveTileSet({ fresh, complete: true, previous: null, needed: [rect(0, 0)], coarse }), fresh);
});

test('tiles missing and the last complete set covers the view: it stays on screen, the coarse stand-in is never made', () => {
    const out = resolveTileSet({ fresh: [tile(0, 0)], complete: false, previous: { tiles: sharp, alive: true }, needed: [rect(0, 0), rect(8, 8)], coarse });
    assert.equal(out, sharp);
});

test('tiles missing and the last set does not cover the view (the view moved): the coarse stand-in covers it', () => {
    const stand = tile(0, 0, 16, 16);
    const out = resolveTileSet({ fresh: [], complete: false, previous: { tiles: sharp, alive: true }, needed: [rect(16, 0)], coarse: () => stand });
    assert.deepEqual(out, [stand]);
});

test('a last set whose entries were evicted is not drawn (it would show another entry\'s texels)', () => {
    const stand = tile(0, 0, 16, 16);
    const out = resolveTileSet({ fresh: [], complete: false, previous: { tiles: sharp, alive: false }, needed: [rect(0, 0)], coarse: () => stand });
    assert.deepEqual(out, [stand]);
});

test('nothing sharper and no stand-in: nothing is drawn rather than a partial band', () => {
    assert.deepEqual(resolveTileSet({ fresh: [tile(0, 0)], complete: false, previous: null, needed: [rect(0, 0), rect(8, 0)], coarse: () => null }), []);
});
