// The stroke area (crates/midas-core `stroke_area`) drawn on the canvas and in Play: every alignment on a box, a rounded box, an ellipse and an open
// path, every paint kind on a stroke, a dashed outside stroke and per-side strokes on a rounded box. Each case is one top-level frame; the canvas
// and Play are shot at 1:1 and compared (the shots and the diffs are in .artifacts/stroke-area-*.png, and stroke-area-sheet.png lays them side by
// side). A second test resizes a frame in Play and checks the area path follows the laid-out size, not the design size.
import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ARTIFACTS, ensureDevServers, openImportedFile, pixelDiff, shotNode, launchBrowser } from './harness.mjs';
import { FIXTURE, PAD, playTree } from './parity-helpers.mjs';

/** A 16 x 16 two-colour checker as a PNG data URL (no dependency: the chunks are written by hand). */
function checkerPng() {
    const crc = buf => { let c, crcv = 0xffffffff; for (const b of buf) { c = (crcv ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcv = (crcv >>> 8) ^ c; } return (crcv ^ 0xffffffff) >>> 0; };
    const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body)); return Buffer.concat([len, body, sum]); };
    const size = 16, raw = Buffer.alloc((size * 3 + 1) * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const o = y * (size * 3 + 1) + 1 + x * 3, on = (x >> 2) + (y >> 2) & 1; raw[o] = on ? 0xef : 0x1d; raw[o + 1] = on ? 0x44 : 0x4e; raw[o + 2] = on ? 0x44 : 0xd8; }
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
    const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
    return `data:image/png;base64,${png.toString('base64')}`;
}

const base = { rotation: 0, opacity: 1, visible: true, locked: false, version: 0 };
const solid = color => ({ type: 'solid', color, opacity: 1, visible: true });
const stops = (a, b) => ({ color: a, color2: b, opacity: 1, visible: true });
const W = 200, H = 140;

/** The cases: [name, shape fields, stroke fields]. The shape sits at 40, 30 in a 200 x 140 white frame. */
const BOX = { type: 'rect', w: 120, h: 80, radius: 0 };
const ROUND = { type: 'rect', w: 120, h: 80, radius: 20 };
const ELLIPSE = { type: 'ellipse', w: 120, h: 80 };
const OPEN = { type: 'path', w: 120, h: 80, pathW: 120, pathH: 80, closed: false, points: [{ x: 0, y: 80 }, { x: 40, y: 0 }, { x: 80, y: 80 }, { x: 120, y: 0 }] };
const INK = { stroke: '#1d4ed8', strokeWidth: 8, strokeJoin: 'miter' };
const CASES = [];
for (const [shapeName, shape] of [['box', BOX], ['rounded', ROUND], ['ellipse', ELLIPSE]])
    for (const align of ['inside', 'center', 'outside']) CASES.push([`${shapeName}-${align}`, shape, { ...INK, strokeAlign: align }]);
CASES.push(['open-path', OPEN, { ...INK, strokeAlign: 'center', strokeCap: 'butt' }]);
CASES.push(['open-path-round', OPEN, { ...INK, strokeAlign: 'inside', strokeJoin: 'round', strokeCap: 'round' }]);
for (const [name, fill] of [
    ['linear', { type: 'linear', ...stops('#ef4444', '#1d4ed8') }],
    ['radial', { type: 'radial', ...stops('#facc15', '#7c3aed') }],
    ['angular', { type: 'angular', ...stops('#22c55e', '#0ea5e9') }],
    ['diamond', { type: 'diamond', ...stops('#f97316', '#111827') }],
    ['pattern', { type: 'pattern', image: 'checker', tileType: 'RECTANGULAR', scale: 1, spacingX: 0, spacingY: 0, iw: 16, ih: 16, align: 'top-left', opacity: 1, visible: true }],
    ['image', { type: 'image', image: 'checker', mode: 'fill', iw: 16, ih: 16, opacity: 1, visible: true }],
    ['video', { type: 'video', video: 'missing-video', poster: 'checker', mode: 'fill', iw: 16, ih: 16, opacity: 1, visible: true }],
    ['image-fit', { type: 'image', image: 'checker', mode: 'fit', iw: 16, ih: 16, opacity: 1, visible: true }],
    ['image-crop', { type: 'image', image: 'checker', mode: 'crop', iw: 16, ih: 16, crop: { x: 0.25, y: 0.75, scale: 1.5 }, opacity: 1, visible: true }],
    ['image-tile', { type: 'image', image: 'checker', mode: 'tile', scale: 1.5, iw: 16, ih: 16, opacity: 1, visible: true }],
]) CASES.push([`paint-${name}`, ROUND, { ...INK, strokeAlign: 'outside', strokeFill: { opacity: 1, visible: true, ...fill } }]);
CASES.push(['dashed-outside', ROUND, { ...INK, strokeAlign: 'outside', strokeStyle: 'dash', strokeDash: 12, strokeGap: 6, strokeCap: 'butt' }]);
for (const align of ['inside', 'center', 'outside']) CASES.push([`sides-${align}`, ROUND, { ...INK, strokeAlign: align, strokeSides: 'custom', strokeT: 12, strokeR: 4, strokeB: 8, strokeL: 0 }]);

/** The testing file with one top-level frame per case on its Testing page, and the checker as the asset the paints read. */
function casesFile() {
    const data = JSON.parse(readFileSync(FIXTURE, 'utf8'));
    const page = data.pages.find(p => p.name === 'Testing');
    const nodes = [];
    CASES.forEach(([name, shape, stroke], i) => {
        const frame = `case-${name}`;
        nodes.push({ ...base, id: frame, name, type: 'frame', parentId: null, x: -5000 + (i % 6) * 260, y: -5000 + Math.floor(i / 6) * 200, w: W, h: H, fills: [solid('#ffffff')], stroke: '#000000', strokeWidth: 0, radius: 0, clip: false, component: false });
        nodes.push({ ...base, id: `${frame}-shape`, name: 'shape', parentId: frame, x: 40, y: 30, fills: [solid('#fde68a')], ...shape, ...stroke, ...(stroke.strokeFill ? { stroke: stroke.strokeFill.color ?? stroke.stroke } : {}) });
    });
    page.nodes = nodes;
    data.pageId = page.id;
    data.assets = { ...data.assets, checker: checkerPng() };
    data.name = 'stroke-area.midas';
    mkdirSync(ARTIFACTS, { recursive: true });
    const file = resolve(ARTIFACTS, 'stroke-area.midas');
    writeFileSync(file, JSON.stringify(data));
    return file;
}

test('the stroke area: canvas and Play, every alignment, paint kind, dash and per-side case', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, casesFile());
    const report = {};
    for (const [name] of CASES) {
        const id = `case-${name}`;
        const canvas = await shotNode(page, id, `stroke-area-${name}-canvas`, PAD, 1);
        await playTree(page, id, `stroke-area-${name}`);
        const out = resolve(ARTIFACTS, `stroke-area-${name}-diff.png`);
        const diff = await pixelDiff(browser, canvas.file, resolve(ARTIFACTS, `stroke-area-${name}-play.png`), out, { tolerance: 40 });
        report[name] = { share: +(diff.changed / diff.pixels).toFixed(4), max: diff.maxChannel ?? diff.max };
    }
    writeFileSync(resolve(ARTIFACTS, 'stroke-area-report.json'), JSON.stringify(report, null, 1));
    // One sheet with every case: canvas, Play, diff.
    const sheet = await browser.newPage({ viewport: { width: 1200, height: 400 }, deviceScaleFactor: 1 });
    const img = (n, kind) => `data:image/png;base64,${readFileSync(resolve(ARTIFACTS, `stroke-area-${n}-${kind}.png`)).toString('base64')}`;
    await sheet.setContent(`<body style="margin:8px;font:11px sans-serif;background:#fff"><div style="display:grid;grid-template-columns:repeat(3,auto);gap:4px 12px;justify-content:start">${CASES.map(([n]) => `<div><b>${n}</b> ${(report[n].share * 100).toFixed(1)}%<br><img src="${img(n, 'canvas')}" width="216"><img src="${img(n, 'play')}" width="216"><img src="${img(n, 'diff')}" width="216"></div>`).join('')}</div></body>`);
    await sheet.screenshot({ path: resolve(ARTIFACTS, 'stroke-area-sheet.png'), fullPage: true });
    // The canvas and Play draw every stroke from the same area, and a paint from the same gradient raster or picture extent: they agree within the parity tolerance.
    for (const [name, r] of Object.entries(report)) {
        assert.ok(r.share < 0.04, `${name}: ${(r.share * 100).toFixed(2)}% of the pixels differ`);
    }
    assert.deepEqual(errors, [], 'console errors');
});

test('Play: an outside stroke with a paint follows the laid-out size of a resized frame, not the design size', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const data = JSON.parse(readFileSync(FIXTURE, 'utf8'));
    const page0 = data.pages.find(p => p.name === 'Testing');
    page0.nodes = [{ ...base, id: 'resize-frame', name: 'Resize', type: 'frame', parentId: null, x: -5000, y: -5000, w: 300, h: 180, fills: [solid('#ffffff')], radius: 24, clip: false, component: false, stroke: '#2563eb', strokeWidth: 10, strokeAlign: 'outside', strokeJoin: 'miter', strokeFill: { type: 'linear', color: '#ef4444', color2: '#1d4ed8', opacity: 1, visible: true } }];
    data.pageId = page0.id;
    data.name = 'stroke-resize.midas';
    const file = resolve(ARTIFACTS, 'stroke-resize.midas');
    writeFileSync(file, JSON.stringify(data));
    const { page, errors } = await openImportedFile(browser, file);
    await page.evaluate(() => window.midas.select(['resize-frame']));
    await page.locator('#play').click();
    await page.waitForSelector('.play-frame');
    const areaBox = () => page.evaluate(() => {
        const frame = document.querySelector('.play-frame');
        const path = frame.querySelector('path[data-area]');
        const b = path.getBBox(), fr = frame.getBoundingClientRect(), scale = fr.width / frame.offsetWidth;
        return { frameW: frame.offsetWidth, frameH: frame.offsetHeight, x: b.x, y: b.y, w: b.width, h: b.height, scale };
    });
    // At the design size: the area spans the frame grown by the stroke width on each side.
    await page.locator('.play-overlay [aria-label="View options"]').click();
    await page.locator('.play-overlay [data-mode="actual-size"]').click();
    await page.waitForTimeout(300);
    let a = await areaBox();
    assert.deepEqual([a.frameW, a.frameH], [300, 180]);
    assert.deepEqual([a.x, a.y, a.w, a.h].map(Math.round), [-10, -10, 320, 200], 'the design-size area');
    // Responsive: the frame takes the window, and the stroke area takes the frame.
    await page.locator('.play-overlay [data-mode="responsive"]').click();
    await page.waitForFunction(() => document.querySelector('.play-frame').offsetWidth !== 300);
    await page.waitForTimeout(300);
    a = await areaBox();
    assert.ok(a.frameW > 600, `the frame was resized (${a.frameW})`);
    assert.deepEqual([a.x, a.y].map(Math.round), [-10, -10]);
    assert.ok(Math.abs(a.w - (a.frameW + 20)) < 1 && Math.abs(a.h - (a.frameH + 20)) < 1, `the area is ${a.w} x ${a.h} for a frame of ${a.frameW} x ${a.frameH}`);
    await page.screenshot({ path: resolve(ARTIFACTS, 'stroke-area-resize-play.png') });
    assert.deepEqual(errors, [], 'console errors');
});
