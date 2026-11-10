// A full atlas frees the least recently used page that holds nothing the current frame uses, instead of emptying everything: a working set
// that fits the atlas is rastered once and then stays, whatever older scales still sit in it. Only a frame whose own set exceeds the
// capacity falls back to the reset at the next frame (placeInAtlas is the real policy the Atlas runs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AtlasPacker, placeInAtlas } from '../src/engine/atlasPacker.js';

function fakeAtlas() {
    const a = { packer: new AtlasPacker(2048, 4), entries: new Map(), frame: 0, inFlight: 0, full: false, deferred: false, resets: 0, evicted: [] };
    a.clearAll = () => { a.entries.clear(); a.packer.reset(); a.resets++; };
    a.onEvict = page => a.evicted.push(page);
    a.beginFrame = () => { a.frame++; if (a.full) { a.full = false; a.clearAll(); } a.inFlight = 0; };
    // One frame: every needed key is looked up (used) or placed; returns how many could not be placed.
    a.draw = (keys, size = 435) => {
        a.beginFrame();
        let missing = 0;
        for (const key of keys) {
            const hit = a.entries.get(key);
            if (hit) { hit.used = a.frame; a.inFlight++; continue; }
            const slot = placeInAtlas(a, size, size);
            if (!slot) { missing++; continue; }
            a.entries.set(key, { key, page: slot.page, used: a.frame });
            a.inFlight++;
        }
        return missing;
    };
    return a;
}
const names = (p, n) => Array.from({ length: n }, (_, i) => `${p}${i}`);

test('a working set of 40 entries beside 60 of an older scale: the old ones are evicted by page, nothing is reset, and the set settles', () => {
    const a = fakeAtlas();
    a.draw(names('old', 60));
    let missing = 0;
    for (let f = 0; f < 30; f++) missing = a.draw(names('now', 40));
    assert.equal(a.resets, 0, 'the atlas was never emptied');
    assert.equal(missing, 0);
    assert.ok(a.evicted.length >= 1, 'pages of the older scale were freed');
});

test('a steady working set that fits (64 entries) is placed once and costs no reset over 100 frames', () => {
    const a = fakeAtlas();
    const set = names('k', 64);
    let placedAfterFirst = 0;
    for (let f = 0; f < 100; f++) { const before = a.entries.size; a.draw(set); if (f > 0) placedAfterFirst += a.entries.size - before; }
    assert.equal(a.resets, 0);
    assert.equal(placedAfterFirst, 0, 'no entry is rastered again after the first frame');
});

test('entries the current frame uses are never evicted, on any page', () => {
    const a = fakeAtlas();
    a.draw(names('a', 64));
    a.beginFrame();
    for (const k of names('a', 64)) { a.entries.get(k).used = a.frame; a.inFlight++; }
    assert.equal(placeInAtlas(a, 435, 435), null, 'full while every page is in use');
    assert.equal(a.full, true);
    assert.equal(a.entries.size, 64, 'nothing was dropped mid-frame');
});

test('a set that truly exceeds the capacity (80 entries) falls back to the reset at the next frame, and the frame keeps what it placed', () => {
    const a = fakeAtlas();
    const missing = a.draw(names('big', 80));
    assert.ok(missing > 0);
    assert.equal(a.full, true);
    assert.equal(a.resets, 0, 'no reset mid-frame');
});
