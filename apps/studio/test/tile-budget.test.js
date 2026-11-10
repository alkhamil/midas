// A raster layer never asks for more tiles than a fixed budget: when the requested resolution would need more, its resolution is lowered
// to fit (tiles are never shrunk below a useful size), and the margin a stroke asks for is capped in texels so it cannot eat the tile.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_LAYER_TILES, MAX_MARGIN_TEXELS, MAX_TILE_TEXELS, marginFor, planLayer, tileGrid } from '../src/engine/atlasPacker.js';

const ATLAS = 2048;
const resFor = (zoom, dpr) => 2 ** (Math.ceil(Math.log2(zoom * dpr) * 4) / 4);
// The view a canvas of css size cw x ch shows at `zoom`, centred on the layer, plus the raster-ahead margin (100 / zoom units).
const viewOf = (layer, zoom, cw = 836, ch = 848) => { const w = cw / zoom + 200 / zoom, h = ch / zoom + 200 / zoom; return { x: layer.w / 2 - w / 2, y: layer.h / 2 - h / 2, w, h }; };
const LAYERS = [
    { name: 'button frame 56x24 (inside stroke 1)', w: 56.41, h: 24, basePad: 2 },
    { name: 'label 42x16', w: 42.41, h: 16, basePad: 0 },
];

test('zoom 46.69 at DPR 1, 2 and 3: tiles in view stay within the budget, each tile entry fits, and the margin is capped', () => {
    for (const dpr of [1, 2, 3]) for (const layer of LAYERS) {
        const zoom = 46.69, need = zoom * dpr;
        const plan = planLayer(layer.w, layer.h, resFor(zoom, dpr), ATLAS, layer.basePad, viewOf(layer, zoom));
        assert.ok(plan.tiles.length <= MAX_LAYER_TILES, `${layer.name} dpr ${dpr}: ${plan.tiles.length} tiles in view`);
        assert.ok(plan.padding * plan.res <= MAX_MARGIN_TEXELS + 1e-6, `${layer.name} dpr ${dpr}: margin ${plan.padding * plan.res} texels`);
        for (const t of plan.tiles) assert.ok((t.w + 2 * plan.padding) * plan.res <= MAX_TILE_TEXELS + 1e-6, `${layer.name} dpr ${dpr}: entry ${(t.w + 2 * plan.padding) * plan.res} texels`);
        // Lowered only as far as the budget needs: the label keeps at least half the screen's density; a layer with a stroke margin keeps tiles of a useful size.
        if (layer.basePad === 0) assert.ok(plan.res >= need / 2, `${layer.name} dpr ${dpr}: scale ${plan.res} for need ${need}`);
        for (const t of plan.tiles.filter(t => t.w < layer.w)) assert.ok(t.w * plan.res >= 100, `${layer.name} dpr ${dpr}: a tile of ${t.w * plan.res} texels`);
    }
});

test('the old tiny-tile grid (a stroke margin of 2 units at 107 texels/unit) is what the cap prevents', () => {
    const old = tileGrid(56.41, 24, 107.6, ATLAS, 2 + 0);
    assert.ok(old.length > 1000, `the uncapped grid has ${old.length} tiles`);
    assert.ok(marginFor(2, 107.6) * 107.6 <= MAX_MARGIN_TEXELS + 1e-6);
});

test('below the budget the plan is the requested resolution and the same tiles as before', () => {
    for (const zoom of [0.05, 0.25, 1, 2, 4, 8]) for (const dpr of [1, 2, 3]) for (const layer of LAYERS) {
        const res = resFor(zoom, dpr), view = viewOf(layer, zoom);
        const plan = planLayer(layer.w, layer.h, res, ATLAS, layer.basePad, view);
        if (tileGrid(layer.w, layer.h, res, ATLAS, marginFor(layer.basePad, res)).length > MAX_LAYER_TILES) continue;
        assert.equal(plan.res, res, `${layer.name} zoom ${zoom} dpr ${dpr}`);
        assert.equal(plan.total, tileGrid(layer.w, layer.h, res, ATLAS, plan.padding).length);
    }
});

test('a sweep: the tiles in view never exceed the budget, for any zoom, DPR and layer size', () => {
    for (const zoom of [0.02, 0.1, 0.5, 1, 4, 16, 46.69, 100, 256]) for (const dpr of [1, 2, 3]) for (const layer of [...LAYERS, { name: 'wide text 1200x20', w: 1200, h: 20, basePad: 0 }, { name: 'big frame 4000x3000', w: 4000, h: 3000, basePad: 3 }]) {
        const plan = planLayer(layer.w, layer.h, resFor(zoom, dpr), ATLAS, layer.basePad, viewOf(layer, zoom));
        assert.ok(plan.tiles.length <= MAX_LAYER_TILES, `${layer.name} zoom ${zoom} dpr ${dpr}: ${plan.tiles.length}`);
    }
});
