// The Typography templates draw text and nothing else that is a raster layer beyond the text itself (and, for Paragraph, the copy icon: a vector glyph like any icon slot).
// This holds each layer to the raster budget at the deepest zoom: every text layer stays within the tiles-in-view budget, the margin cap and the entry size, and the
// whole template fits the atlas, placed once and kept, with no page evicted and no reset, at DPR 1, 2 and 3. Text and the code/mark boxes are one text layer each:
// code and mark style the root frame (a frame is not a raster layer), so they add none.
import test from 'node:test';
import assert from 'node:assert/strict';
import { AtlasPacker, MAX_LAYER_TILES, MAX_MARGIN_TEXELS, MAX_TILE_TEXELS, placeInAtlas, planLayer } from '../src/engine/atlasPacker.js';

const ATLAS = 2048;
const resFor = (zoom, dpr) => 2 ** (Math.ceil(Math.log2(zoom * dpr) * 4) / 4);
const viewOf = (layer, zoom, cw = 836, ch = 848) => { const w = cw / zoom + 200 / zoom, h = ch / zoom + 200 / zoom; return { x: layer.w / 2 - w / 2, y: layer.h / 2 - h / 2, w, h }; };
/** The text layers of the Text template, at its five sizes and with strong (the label is the only raster layer; the root frame is not one). */
const TEXT = [
    { name: 'Text xs label, 40 x 12', w: 40, h: 12, basePad: 0 },
    { name: 'Text md label, 56 x 20', w: 56, h: 20, basePad: 0 },
    { name: 'Text xl label strong, 120 x 28', w: 120, h: 28, basePad: 0 },
    { name: 'Text label across a 343 frame', w: 343, h: 20, basePad: 0 },
];
/** The Title's label at its five levels (heading styles 40 to 24px; the element is not a layer). */
const TITLE = [
    { name: 'Title h1 label, 160 x 48', w: 160, h: 48, basePad: 0 },
    { name: 'Title h3 label, 120 x 36', w: 120, h: 36, basePad: 0 },
    { name: 'Title h5 label across a 343 frame', w: 343, h: 28, basePad: 0 },
];
/** The Paragraph: its wrapped label (a text layer, 343 wide, up to five rows), the expand text, and the copy icon (a 16 x 16 vector, the only vector layer). */
const PARAGRAPH = [
    { name: 'Paragraph label, 343 x 40', w: 343, h: 40, basePad: 0 },
    { name: 'Paragraph label expanded, 343 x 100', w: 343, h: 100, basePad: 0 },
    { name: 'expand text, 48 x 20', w: 48, h: 20, basePad: 0 },
    { name: 'copy icon, 16 x 16 path', w: 16, h: 16, basePad: 1 },
];
/** The Link's label: one text layer like Text's (the anchor is the root frame, not a layer). */
const LINK = [
    { name: 'Link md label, 32 x 20', w: 32, h: 20, basePad: 0 },
    { name: 'Link xl label strong, 80 x 28', w: 80, h: 28, basePad: 0 },
];
/** Each template is one set: its layers share the atlas (two templates are never on screen at the deepest zoom together). */
const SETS = { Text: TEXT, Title: TITLE, Paragraph: PARAGRAPH, Link: LINK };
const LAYERS = [...TEXT, ...TITLE, ...PARAGRAPH, ...LINK];
const WIDE = [{ name: 'text across a 1200 frame', w: 1200, h: 24, basePad: 0 }, { name: 'text across a 4000 frame', w: 4000, h: 24, basePad: 0 }];

test('zoom 46.69 at DPR 1, 2 and 3: each text layer stays within the tiles-in-view budget, the margin cap and the entry size', () => {
    for (const dpr of [1, 2, 3]) for (const layer of [...LAYERS, ...WIDE]) {
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
/** The atlas entries a template's layers need at one zoom and DPR: one per tile in view, sized in texels as the Atlas sizes them. */
function entriesFor(layers, zoom, dpr) {
    return layers.flatMap((layer, li) => {
        const plan = planLayer(layer.w, layer.h, resFor(zoom, dpr), ATLAS, layer.basePad, viewOf(layer, zoom));
        return plan.tiles.map((t, ti) => ({ key: `${li}:${ti}:${plan.res}`, w: Math.ceil((t.w + 2 * plan.padding) * plan.res), h: Math.ceil((t.h + 2 * plan.padding) * plan.res) }));
    });
}

test('zoom 46.69 at DPR 1, 2 and 3: the layers of the template are placed in the atlas once, kept, and never evict a page or reset the atlas', () => {
    for (const [set, layers] of Object.entries(SETS)) for (const dpr of [1, 2, 3]) {
        const a = fakeAtlas();
        const entries = entriesFor(layers, 46.69, dpr);
        let missing = a.draw(entries);
        assert.equal(missing, 0, `${set} dpr ${dpr}: every entry found a slot`);
        const placed = a.entries.size;
        for (let f = 0; f < 30; f++) missing += a.draw(entries);
        assert.equal(missing, 0);
        assert.equal(a.entries.size, placed, `dpr ${dpr}: nothing is rastered again after the first frame`);
        assert.equal(a.resets, 0, `dpr ${dpr}: the atlas was never emptied`);
        assert.equal(a.evicted.length, 0, `dpr ${dpr}: no page was freed`);
        assert.equal(a.full, false, `dpr ${dpr}: the atlas never reported full`);
    }
});

test('a sweep: any zoom and DPR keeps the layers within the tile budget and in the atlas without a reset', () => {
    for (const zoom of [0.02, 0.1, 0.5, 1, 4, 16, 46.69, 100, 256]) for (const dpr of [1, 2, 3]) {
        for (const layer of [...LAYERS, ...WIDE]) {
            const plan = planLayer(layer.w, layer.h, resFor(zoom, dpr), ATLAS, layer.basePad, viewOf(layer, zoom));
            assert.ok(plan.tiles.length <= MAX_LAYER_TILES, `${layer.name} zoom ${zoom} dpr ${dpr}: ${plan.tiles.length}`);
        }
        for (const [set, layers] of Object.entries(SETS)) {
            const a = fakeAtlas();
            const entries = entriesFor(layers, zoom, dpr);
            let missing = a.draw(entries);
            for (let f = 0; f < 5; f++) missing += a.draw(entries);
            assert.equal(missing, 0, `${set} zoom ${zoom} dpr ${dpr}: every entry is placed`);
            assert.equal(a.resets, 0, `${set} zoom ${zoom} dpr ${dpr}: no reset`);
        }
    }
});
