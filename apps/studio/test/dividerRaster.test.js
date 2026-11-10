// A Divider is drawn by vector line nodes, and a line is a raster layer (midas.js: `raster` is true for text, path, line and image). This holds it to the raster
// budget at the deepest zoom: every rule and its text stays within the tiles-in-view budget and the margin cap, and the whole divider fits the atlas, placed once
// and kept, with no page evicted and no reset of the atlas, at DPR 1, 2 and 3.
import test from 'node:test';
import assert from 'node:assert/strict';
import { AtlasPacker, MAX_LAYER_TILES, MAX_MARGIN_TEXELS, MAX_TILE_TEXELS, placeInAtlas, planLayer } from '../src/engine/atlasPacker.js';

const ATLAS = 2048;
const resFor = (zoom, dpr) => 2 ** (Math.ceil(Math.log2(zoom * dpr) * 4) / 4);
const viewOf = (layer, zoom, cw = 836, ch = 848) => { const w = cw / zoom + 200 / zoom, h = ch / zoom + 200 / zoom; return { x: layer.w / 2 - w / 2, y: layer.h / 2 - h / 2, w, h }; };
/** The margin a line layer asks for: half its stroke and one unit (the Atlas's rule for a path or a line). */
const linePad = strokeWidth => strokeWidth / 2 + 1;
/** The layers of a Divider: its lines (a line is w x 0 along x, 0 x h along y) and its text. */
const DIVIDER = [
    { name: 'line, 343 wide (no text)', w: 343, h: 0, basePad: linePad(1) },
    { name: 'line beside the text, 125.5 wide (centre)', w: 125.5, h: 0, basePad: linePad(1) },
    { name: 'short line, 24 wide', w: 24, h: 0, basePad: linePad(1) },
    { name: 'long side of a start divider, 227 wide', w: 227, h: 0, basePad: linePad(1) },
    { name: 'vertical line, 12 tall', w: 0, h: 12, basePad: linePad(1) },
    { name: 'text, 40 x 24', w: 40, h: 24, basePad: 0 },
];
const WIDE = [{ name: 'line across a 1200 frame', w: 1200, h: 0, basePad: linePad(1) }, { name: 'line across a 4000 frame', w: 4000, h: 0, basePad: linePad(1) }];

test('zoom 46.69 at DPR 1, 2 and 3: each rule and the text stay within the tiles-in-view budget, the margin cap and the entry size', () => {
    for (const dpr of [1, 2, 3]) for (const layer of [...DIVIDER, ...WIDE]) {
        const zoom = 46.69;
        const plan = planLayer(layer.w, layer.h, resFor(zoom, dpr), ATLAS, layer.basePad, viewOf(layer, zoom));
        assert.ok(plan.tiles.length <= MAX_LAYER_TILES, `${layer.name} dpr ${dpr}: ${plan.tiles.length} tiles in view`);
        assert.ok(plan.padding * plan.res <= MAX_MARGIN_TEXELS + 1e-6, `${layer.name} dpr ${dpr}: margin ${plan.padding * plan.res} texels`);
        for (const t of plan.tiles) assert.ok((t.w + 2 * plan.padding) * plan.res <= MAX_TILE_TEXELS + 1e-6, `${layer.name} dpr ${dpr}: entry ${(t.w + 2 * plan.padding) * plan.res} texels`);
    }
});

function fakeAtlas() {
    const a = { packer: new AtlasPacker(ATLAS, 4), entries: new Map(), frame: 0, inFlight: 0, full: false, deferred: false, resets: 0, evicted: [] };
    a.clearAll = () => { a.entries.clear(); a.packer.reset(); a.resets++; };
    a.onEvict = page => a.evicted.push(page);
    a.beginFrame = () => { a.frame++; if (a.full) { a.full = false; a.clearAll(); } a.inFlight = 0; };
    /** One frame: every needed entry is looked up or placed; returns how many could not be placed. */
    a.draw = entries => {
        a.beginFrame();
        let missing = 0;
        for (const { key, w, h } of entries) {
            const hit = a.entries.get(key);
            if (hit) { hit.used = a.frame; a.inFlight++; continue; }
            const slot = placeInAtlas(a, w, h);
            if (!slot) { missing++; continue; }
            a.entries.set(key, { key, page: slot.page, used: a.frame });
            a.inFlight++;
        }
        return missing;
    };
    return a;
}
/** The atlas entries a divider's layers need at one zoom and DPR: one per tile in view, sized in texels as the Atlas sizes them. */
function entriesFor(layers, zoom, dpr) {
    return layers.flatMap((layer, li) => {
        const plan = planLayer(layer.w, layer.h, resFor(zoom, dpr), ATLAS, layer.basePad, viewOf(layer, zoom));
        return plan.tiles.map((t, ti) => ({ key: `${li}:${ti}:${plan.res}`, w: Math.ceil((t.w + 2 * plan.padding) * plan.res), h: Math.ceil((t.h + 2 * plan.padding) * plan.res) }));
    });
}

test('zoom 46.69 at DPR 1, 2 and 3: a whole divider (every rule, the text) is placed in the atlas once, kept, and never evicts a page or resets the atlas', () => {
    for (const dpr of [1, 2, 3]) {
        const a = fakeAtlas();
        const entries = entriesFor(DIVIDER, 46.69, dpr);
        let missing = a.draw(entries);
        assert.equal(missing, 0, `dpr ${dpr}: every entry found a slot`);
        const placed = a.entries.size;
        for (let f = 0; f < 30; f++) missing += a.draw(entries);
        assert.equal(missing, 0);
        assert.equal(a.entries.size, placed, `dpr ${dpr}: nothing is rastered again after the first frame`);
        assert.equal(a.resets, 0, `dpr ${dpr}: the atlas was never emptied`);
        assert.equal(a.evicted.length, 0, `dpr ${dpr}: no page was freed`);
        assert.equal(a.full, false, `dpr ${dpr}: the atlas never reported full`);
    }
});

test('a sweep: any zoom and DPR keeps a divider within the tile budget and in the atlas without a reset', () => {
    for (const zoom of [0.02, 0.1, 0.5, 1, 4, 16, 46.69, 100, 256]) for (const dpr of [1, 2, 3]) {
        for (const layer of [...DIVIDER, ...WIDE]) {
            const plan = planLayer(layer.w, layer.h, resFor(zoom, dpr), ATLAS, layer.basePad, viewOf(layer, zoom));
            assert.ok(plan.tiles.length <= MAX_LAYER_TILES, `${layer.name} zoom ${zoom} dpr ${dpr}: ${plan.tiles.length}`);
        }
        const a = fakeAtlas();
        const entries = entriesFor(DIVIDER, zoom, dpr);
        let missing = a.draw(entries);
        for (let f = 0; f < 5; f++) missing += a.draw(entries);
        assert.equal(missing, 0, `zoom ${zoom} dpr ${dpr}: every entry is placed`);
        assert.equal(a.resets, 0, `zoom ${zoom} dpr ${dpr}: no reset`);
    }
});
