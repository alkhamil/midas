// Raster scale follows the screen: a raster entry must hold at least one texel per device pixel,
// or text and vector edges upscale into stair-steps. The scale is zoom x devicePixelRatio (re-rastered
// on zoom end through the settle frame, cached by version otherwise); an entry too large for the atlas
// side is rastered down to fit instead of overflowing it. resolutionForZoom and entryScaleFor are cut out
// of midas.js by name (as studioReplay.js does): a missing helper fails here, so the test can never
// pass over a re-implementation. tileGrid and the atlas side are the real ones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tileGrid } from '../src/engine/atlasPacker.js';

const src = fs.readFileSync(new URL('../src/engine/midas.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

function sliceFunction(name) {
    const head = src.indexOf(`\nfunction ${name}(`) >= 0 ? src.indexOf(`\nfunction ${name}(`) + 1 : src.indexOf(`function ${name}(`);
    if (head < 0) throw new Error(`midas.js has no function ${name}`);
    const lineEnd = src.indexOf('\n', head);
    const firstLine = src.slice(head, lineEnd);
    if (/\}\s*$/.test(firstLine) && (firstLine.match(/\{/g) || []).length === (firstLine.match(/\}/g) || []).length) return firstLine;
    return src.slice(head, src.indexOf('\n}\n', head) + 2);
}

const fns = ['resolutionForZoom', 'entryScaleFor'];
const body = `${fns.map(sliceFunction).join('\n')}\nreturn { ${fns.join(', ')} };`;
const { resolutionForZoom, entryScaleFor } = new Function(body)();

const ATLAS = 2048;
// The entry margin of paddingOf for a plain layer (a path carries its half stroke plus one).
const padFor = (kind, res) => Math.max(kind === 'path' ? 1 : 0, Math.ceil(2 / Math.max(0.05, Math.min(res, 1))));

// Ordinary layers: a line of text, a 24px vector, an input box. No effects, no giant spans.
const LAYERS = [
    { name: 'text 200x20', kind: 'text', w: 200, h: 20 },
    { name: 'vector 24x24', kind: 'path', w: 24, h: 24 },
    { name: 'input 343x32', kind: 'frame', w: 343, h: 32 },
];
const ZOOMS = [0.02, 0.1, 0.5, 1, 2, 4, 8, 16, 32, 64, 128, 256];
const DPRS = [1, 2, 3];

test('the raster scale tracks the screen across the whole zoom range, never below device pixels', () => {
    for (const zoom of ZOOMS) for (const dpr of DPRS) {
        const need = zoom * dpr;
        if (need > 1024) continue;
        const res = resolutionForZoom(zoom, dpr);
        assert.ok(res >= need, `zoom ${zoom} dpr ${dpr}: scale ${res} below screen ${need} (stair-steps)`);
    }
});

test('tiles cover the layer exactly once, with no overlap, at every swept scale', () => {
    for (const zoom of ZOOMS) for (const dpr of DPRS) {
        const res = resolutionForZoom(zoom, dpr);
        for (const layer of LAYERS) {
            const tiles = tileGrid(layer.w, layer.h, res, ATLAS, padFor(layer.kind, res));
            const area = tiles.reduce((s, t) => s + t.w * t.h, 0);
            assert.ok(Math.abs(area - layer.w * layer.h) < 1e-6, `${layer.name} zoom ${zoom}: covers ${area} of ${layer.w * layer.h}`);
            for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) {
                const a = tiles[i], b = tiles[j];
                assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${layer.name} zoom ${zoom}: tiles overlap`);
            }
        }
    }
});

test('entries are rastered at screen scale or above through the provable-sharp range, and past the old ceiling beyond it', () => {
    for (const zoom of ZOOMS) for (const dpr of DPRS) {
        const need = zoom * dpr;
        if (need > 768) continue;
        const res = resolutionForZoom(zoom, dpr);
        for (const layer of LAYERS) {
            const pad = padFor(layer.kind, res);
            const scales = tileGrid(layer.w, layer.h, res, ATLAS, pad).map(t => entryScaleFor(t.w + 2 * pad, t.h + 2 * pad, res, ATLAS));
            const worst = Math.min(...scales);
            if (need <= 400) assert.ok(worst >= need, `${layer.name} zoom ${zoom} dpr ${dpr}: entry ${worst} below screen ${need}`);
            else assert.ok(worst > 32, `${layer.name} zoom ${zoom} dpr ${dpr}: entry ${worst} no better than the old ceiling`);
        }
    }
});

test('pressure retries halve the scale instead of going coarse silently', () => {
    assert.equal(resolutionForZoom(4, 2, 0.5), resolutionForZoom(4, 2, 1) / 2);
});
