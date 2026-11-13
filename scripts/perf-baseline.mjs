// Performance baseline of the studio in Chrome. Measure only: nothing here changes the product.
//
//   node scripts/perf-baseline.mjs [--mode headless|headed] [--sizes 1000,5000,20000] [--runs 1] [--out docs/perf-baseline.md] [--no-profile]
//
// --mode headless (default) is Chromium headless as the browser tests run it (software rendering, the canvas falls back to Canvas 2D); --mode headed is the installed
// Chrome with a window and the real GPU (WebGPU when the machine gives the page an adapter). Each mode's results are kept in .artifacts/perf-<mode>.json and the
// document is written from every mode that has been run, each in its own section.
//
// For each size it generates a document (mixed frames, text, rectangles, ellipses, strokes with gradient paints, one large screen), imports it as
// the seed admin (the dev servers are started when they are down, as the browser tests do) and measures, in one page:
//   load            import started -> the document is open and the first frames are painted
//   pan             frame interval while real wheel events pan the canvas
//   zoom            frame interval while the camera zooms (the camera is set and the canvas invalidated, as a wheel notch does)
//   drag            frame interval while a 20-layer selection is dragged with the mouse
//   fillPicker      click on the Fill row -> the picker is open and painted
//   enterPlay       Play button -> the frame is mounted and painted
//   hover / press   input event -> the next painted frame, in Play, on a Button instance (a template with hover and pressed states)
// and profiles the run with the Chrome CPU profiler. Frame interval = time between animation frames while the scenario runs (16.7 ms is 60 fps; a
// frame that costs more stretches it). Everything is reported as p50 / p95 over the samples of the scenario. Headless Chrome, device scale 1.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { ARTIFACTS, ROOT, ensureDevServers, openImportedFile, screenRect } from '../apps/studio/test/browser/harness.mjs';
import { createFromPanel } from '../apps/studio/test/browser/parity-helpers.mjs';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? fallback : process.argv[i + 1]; };
const SIZES = arg('sizes', '1000,5000,20000').split(',').map(Number);
const RUNS = Number(arg('runs', 1));
const OUT = resolve(ROOT, arg('out', 'docs/perf-baseline.md'));
const PROFILE = !process.argv.includes('--no-profile');
const MODE = arg('mode', 'headless') === 'headed' ? 'headed' : 'headless';

// ---------- the generated document ----------

/** Deterministic pseudo-random numbers (a fixed seed: every run measures the same document). */
function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

const base = { rotation: 0, opacity: 1, visible: true, locked: false, version: 0 };
const solid = color => ({ type: 'solid', color, opacity: 1, visible: true });
const STROKE_PAINTS = [
    { type: 'linear', color: '#ff5a5f', color2: '#3b82f6', opacity: 1, visible: true },
    { type: 'radial', color: '#facc15', color2: '#7c3aed', opacity: 1, visible: true },
    { type: 'angular', color: '#22c55e', color2: '#0ea5e9', opacity: 1, visible: true },
    { type: 'diamond', color: '#f97316', color2: '#111827', opacity: 1, visible: true },
];

/**
 * A document of about `count` layers: a large screen of count/5 layers (up to 2000) for the canvas and Play to chew on, then screens of 100 layers in a grid.
 * Layers are frames (some with a gradient stroke, outside or inside), rectangles with strokes, ellipses and text.
 */
export function generate(count) {
    const rand = rng(count), nodes = [];
    let n = 0;
    const id = () => `g${++n}`;
    const screen = (name, x, y, w, h, children) => {
        const sid = id();
        nodes.push({ ...base, id: sid, name, type: 'frame', parentId: null, x, y, w, h, fills: [solid('#ffffff')], stroke: '#000000', strokeWidth: 0, radius: 0, clip: true });
        for (let i = 0; i < children; i++) {
            const kind = rand(), cx = Math.floor(rand() * (w - 140)), cy = Math.floor(rand() * (h - 90)), cw = 40 + Math.floor(rand() * 100), ch = 24 + Math.floor(rand() * 60);
            const paint = STROKE_PAINTS[Math.floor(rand() * STROKE_PAINTS.length)];
            const align = ['inside', 'center', 'outside'][Math.floor(rand() * 3)];
            const color = `#${Math.floor(rand() * 0xffffff).toString(16).padStart(6, '0')}`;
            if (kind < 0.35) nodes.push({ ...base, id: id(), name: `Rect ${i}`, type: 'rect', parentId: sid, x: cx, y: cy, w: cw, h: ch, radius: Math.floor(rand() * 12), fills: [solid(color)], stroke: paint.color, strokeFill: paint, strokeWidth: 1 + Math.floor(rand() * 4), strokeAlign: align });
            else if (kind < 0.55) nodes.push({ ...base, id: id(), name: `Ellipse ${i}`, type: 'ellipse', parentId: sid, x: cx, y: cy, w: cw, h: ch, fills: [solid(color)], stroke: '#18181b', strokeWidth: 1 + Math.floor(rand() * 3), strokeAlign: align });
            else if (kind < 0.8) nodes.push({ ...base, id: id(), name: `Text ${i}`, type: 'text', parentId: sid, x: cx, y: cy, w: 120, h: 20, text: `Layer ${n}`, fontFamily: 'Inter', fontSize: 12 + Math.floor(rand() * 8), fontWeight: 400, fontStyle: 'normal', lineHeight: 1.4, letterSpacing: 0, textAlign: 'left', textDecoration: 'none', textCase: 'none', direction: 'auto', autoW: false, fills: [solid('#18181b')], stroke: '#000000', strokeWidth: 0, radius: 0, clip: false });
            else nodes.push({ ...base, id: id(), name: `Card ${i}`, type: 'frame', parentId: sid, x: cx, y: cy, w: cw + 40, h: ch + 30, radius: 8, clip: false, fills: [solid('#f4f4f5')], stroke: paint.color, strokeFill: paint, strokeWidth: 2, strokeAlign: align });
        }
        return sid;
    };
    const large = Math.min(2000, Math.floor(count / 5));
    screen('Large', 0, 0, 3000, 2000, large);
    let placed = large + 1, i = 0;
    while (placed < count) {
        const per = Math.min(100, count - placed);
        screen(`Screen ${i + 1}`, 3200 + (i % 20) * 520, Math.floor(i / 20) * 520, 480, 480, per);
        placed += per + 1;
        i++;
    }
    return nodes;
}

/** The testing file with the generated layers on its Testing page (its stage kept, moved out of the way). */
function documentFile(count) {
    const data = JSON.parse(readFileSync(resolve(ROOT, 'testing.midas'), 'utf8'));
    const page = data.pages.find(p => p.name === 'Testing');
    page.nodes = generate(count);
    data.pageId = page.id;
    data.name = `perf-${count}.midas`;
    mkdirSync(ARTIFACTS, { recursive: true });
    const file = resolve(ARTIFACTS, `perf-${count}.midas`);
    writeFileSync(file, JSON.stringify(data));
    return { file, nodes: page.nodes };
}

// ---------- measuring ----------

const quantile = (list, q) => {
    if (!list.length) return NaN;
    const s = [...list].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
const stat = list => ({ n: list.length, p50: quantile(list, 0.5), p95: quantile(list, 0.95), max: Math.max(...list) });

/** Starts recording the intervals between animation frames in the page; the returned function stops it and gives the intervals (ms). */
async function recordFrames(page) {
    await page.evaluate(() => {
        const rec = { intervals: [], last: performance.now(), on: true };
        window.__frames = rec;
        const tick = now => { if (!rec.on) return; rec.intervals.push(now - rec.last); rec.last = now; requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
    });
    return () => page.evaluate(() => { window.__frames.on = false; return window.__frames.intervals.slice(1); });
}

/** Runs `body` while recording frame intervals; returns the stat of the intervals. */
async function framed(page, body) {
    const stop = await recordFrames(page);
    await body();
    return stat(await stop());
}

/** Times `action` in the page (ms until the next two painted frames after `ready` holds), `times` times. */
async function inPage(page, fn, times, arg) {
    const out = [];
    for (let i = 0; i < times; i++) out.push(await page.evaluate(fn, { ...arg, i }));
    return stat(out);
}

const paintedAfter = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

async function measure(browser, count) {
    const { file, nodes } = documentFile(count);
    const out = { count, layers: nodes.length };
    const page0 = await browser.newPage();
    await page0.close();
    // load: from the import to the first painted frames
    const t0 = Date.now();
    const { page, errors } = await openImportedFile(browser, file, { dpr: 1 });
    await page.evaluate(paintedAfter);
    out.load = { ms: Date.now() - t0 };
    out.renderer = await page.evaluate(async () => {
        let adapter = null;
        try { const a = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' }); adapter = a ? { fallback: a.isFallbackAdapter, vendor: a.info?.vendor, architecture: a.info?.architecture, description: a.info?.description } : null; } catch { adapter = null; }
        const gl = (() => { try { const c = document.createElement('canvas').getContext('webgl2'); const x = c?.getExtension('WEBGL_debug_renderer_info'); return x ? c.getParameter(x.UNMASKED_RENDERER_WEBGL) : null; } catch { return null; } })();
        return { webgpu: !!navigator.gpu, adapter, gl, backend: window.midas.renderer?.backend ?? 'unknown', layers: window.midas.doc.nodes.length };
    });
    const cdp = PROFILE ? await page.context().newCDPSession(page) : null;
    if (cdp) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }

    // the camera over the large screen
    const area = await page.evaluate(() => { const r = document.querySelector('#canvas-area, #area, canvas')?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : { x: 300, y: 60, w: 800, h: 700 }; });
    const cx = area.x + area.w / 2, cy = area.y + area.h / 2;
    await page.evaluate(() => { window.midas.state.camera.zoom = 0.5; window.midas.state.camera.x = 40; window.midas.state.camera.y = 40; window.midas.render(); });
    await page.evaluate(paintedAfter);

    await page.mouse.move(cx, cy);
    out.pan = await framed(page, async () => { for (let i = 0; i < 60; i++) { await page.mouse.wheel(0, i < 30 ? 40 : -40); await page.waitForTimeout(8); } });
    out.zoom = await framed(page, async () => {
        for (let i = 0; i < 60; i++) {
            await page.evaluate(k => { const c = window.midas.state.camera; c.zoom = Math.min(4, Math.max(0.1, c.zoom * k)); window.midas.render(); }, i < 30 ? 1.05 : 1 / 1.05);
            await page.waitForTimeout(8);
        }
    });
    await page.evaluate(() => { window.midas.state.camera.zoom = 0.5; window.midas.state.camera.x = 40; window.midas.state.camera.y = 40; window.midas.render(); });

    // drag a 20-layer selection (children of the large screen that are on screen)
    const ids = await page.evaluate(() => {
        const big = window.midas.doc.nodes.find(n => n.name === 'Large');
        const kids = window.midas.doc.children(big.id).filter(n => n.type === 'rect').slice(0, 20).map(n => n.id);
        window.midas.select(kids);
        return kids;
    });
    const r = await screenRect(page, ids[0]);
    await page.mouse.move(r.x + r.w / 2, r.y + r.h / 2);
    out.drag = await framed(page, async () => {
        await page.mouse.down();
        for (let i = 1; i <= 60; i++) { await page.mouse.move(r.x + r.w / 2 + i * 4, r.y + r.h / 2 + i * 2); await page.waitForTimeout(8); }
        await page.mouse.up();
    });
    await page.evaluate(() => window.midas.history.undo?.());

    // the Fill picker
    await page.evaluate(() => { const big = window.midas.doc.nodes.find(n => n.name === 'Large'); window.midas.select([window.midas.doc.children(big.id).find(n => n.type === 'ellipse').id]); });
    await page.waitForSelector('[data-fill-open="0"]');
    out.fillPicker = await inPage(page, async () => {
        const raf2 = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const row = document.querySelector('[data-fill-open="0"]');
        const t0 = performance.now();
        row.click();
        while (!document.querySelector('#fill-picker')) await new Promise(r => setTimeout(r, 0));
        await raf2();
        const ms = performance.now() - t0;
        row.click();
        await raf2();
        return ms;
    }, 15, {});

    // Play of the large screen
    out.enterPlay = await inPage(page, async () => {
        const raf2 = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const t0 = performance.now();
        document.querySelector('#play').click();
        while (!document.querySelector('.play-frame')) await new Promise(r => setTimeout(r, 0));
        await raf2();
        const ms = performance.now() - t0;
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        while (document.querySelector('.play-overlay')) await new Promise(r => setTimeout(r, 0));
        return ms;
    }, 8, {});

    // hover and press on a Button instance, in Play (the template's hover and pressed states)
    await createFromPanel(page, 'button');
    const button = await page.evaluate(() => { const b = window.midas.doc.nodes.find(n => n.isInstance && n.behavior?.templateId === 'button') ?? window.midas.doc.nodes.find(n => n.name === 'Button' && n.isInstance); return b?.id ?? null; });
    if (button) {
        await page.evaluate(id => { window.midas.select([id]); document.querySelector('#play').click(); }, button);
        await page.waitForSelector('.play-frame');
        await page.waitForTimeout(500);
        const el = await page.locator(`.play-frame [data-node-id="${button}"]`).first().boundingBox();
        const latency = async type => {
            const samples = [];
            for (let i = 0; i < 25; i++) {
                await page.evaluate(([type]) => {
                    window.__lat = new Promise(resolve => document.addEventListener(type, e => { const t0 = e.timeStamp; requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - t0))); }, { once: true, capture: true }));
                }, [type]);
                if (type === 'pointermove') { await page.mouse.move(2, 2); await page.mouse.move(el.x + el.width / 2 + (i % 2), el.y + el.height / 2); }
                else if (type === 'pointerdown') { await page.mouse.move(el.x + el.width / 2, el.y + el.height / 2); await page.mouse.down(); }
                samples.push(await page.evaluate(() => window.__lat));
                if (type === 'pointerdown') await page.mouse.up();
            }
            return stat(samples);
        };
        out.hover = await latency('pointermove');
        out.press = await latency('pointerdown');
    }

    if (cdp) out.profile = (await cdp.send('Profiler.stop')).profile;
    out.errors = errors.slice(0, 5);
    await page.close();
    return out;
}

/** Self time per function from a CPU profile: [{ ms, name, url, line }] sorted, the idle and the program excluded. */
function hotspots(profile) {
    const byId = new Map(profile.nodes.map(n => [n.id, n]));
    const self = new Map();
    for (let i = 0; i < profile.samples.length; i++) self.set(profile.samples[i], (self.get(profile.samples[i]) ?? 0) + (profile.timeDeltas[i] ?? 0));
    const agg = new Map();
    for (const [id, us] of self) {
        const n = byId.get(id), f = n.callFrame;
        if (['(idle)', '(program)', '(root)'].includes(f.functionName)) continue;
        const key = `${f.functionName || '(anonymous)'}|${f.url}|${f.lineNumber + 1}`;
        agg.set(key, (agg.get(key) ?? 0) + us / 1000);
    }
    return [...agg].map(([key, ms]) => { const [name, url, line] = key.split('|'); return { ms, name, url: url.replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, ''), line }; }).sort((a, b) => b.ms - a.ms);
}

const f1 = v => (Number.isFinite(v) ? v.toFixed(1) : 'n/a');
const cell = s => (s ? `${f1(s.p50)} / ${f1(s.p95)}` : 'n/a');

// ---------- run and report ----------

const stop = await ensureDevServers();
const browser = await chromium.launch(MODE === 'headed' ? { channel: 'chrome', headless: false } : {});
// A large document takes longer than a test's 30 s to open: every context waits up to five minutes.
const newContext = browser.newContext.bind(browser);
browser.newContext = async options => { const context = await newContext(options); context.setDefaultTimeout(300_000); return context; };
const results = [];
let version = '';
try {
    for (const count of SIZES) {
        for (let r = 0; r < RUNS; r++) {
            console.log(`measuring ${count} layers (run ${r + 1}/${RUNS})`);
            results.push(await measure(browser, count));
        }
    }
}
finally {
    version = browser.version();
    await browser.close();
    await stop();
}

const NOTES = "## Reading the results\n\n- **Frame interval** is capped by the display refresh: 16.7 ms is 60 Hz, so a p50 of 16.7 means the frame fit its budget and a p95 of 33 or more is a dropped frame. Pan, zoom and drag saturate at the cap at these sizes; the p95 is where cost shows.\n- **Headless** uses the Canvas 2D fallback on software rendering (WebGPU is exposed but returns no adapter). **Headed** is Chrome with a window: WebGPU on the machine's integrated Intel Iris Xe (not a discrete GPU), so the numbers say what a laptop with an integrated GPU does.\n- **Enter Play** is the large screen (up to 2000 layers) mounted as DOM plus `toDomTree` over the whole document, so it grows with both. **Hover and press** are on a Button on its own frame: about two frames of input latency, independent of the document size here.\n- **Hotspots** are self time over the whole measured session (every scenario, plus the Generate Design System that makes the Button), so `tokens.js` dominates at 1k and `toDataURL` at 5k and 20k. `toDataURL` is canvas read-back; the likely source in Play is the raster of each angular or diamond stroke (the generated document has many, each at its own size), which the Rust-core stroke work added. It was not isolated by a profile without them.\n- One run per size, no repeat: treat differences under about 10% as noise.";

const rows = [
    ['Initial load (ms, one run)', r => `${r.load.ms}`],
    ['Pan: frame interval (ms)', r => cell(r.pan)],
    ['Zoom: frame interval (ms)', r => cell(r.zoom)],
    ['Drag of 20 layers: frame interval (ms)', r => cell(r.drag)],
    ['Open the Fill picker (ms)', r => cell(r.fillPicker)],
    ['Enter Play, large screen (ms)', r => cell(r.enterPlay)],
    ['Play hover on a Button: input to paint (ms)', r => cell(r.hover)],
    ['Play press on a Button: input to paint (ms)', r => cell(r.press)],
];
mkdirSync(ARTIFACTS, { recursive: true });
writeFileSync(resolve(ARTIFACTS, `perf-${MODE}.json`), JSON.stringify({ mode: MODE, date: new Date().toISOString().slice(0, 10), runs: RUNS, browser: version, results: results.map(({ profile, ...r }) => ({ ...r, hotspots: profile ? hotspots(profile).slice(0, 15) : [] })) }, null, 1));

const md = ['# Performance baseline', '', 'Measure only: nothing was optimised. Generated by `node scripts/perf-baseline.mjs --mode headless|headed`, from seeded documents of mixed frames, text, rectangles, ellipses and strokes with gradient paints (one large screen, the rest 100-layer screens). Cells are **p50 / p95**. A frame interval is the time between animation frames while the scenario runs: 16.7 ms is 60 fps, a frame that costs more stretches it. Input latencies run from the input event to the second painted frame after it. The studio is the Vite dev server (unminified, so the hotspot names are the source functions).', ''];
for (const mode of ['headless', 'headed']) {
    const path = resolve(ARTIFACTS, `perf-${mode}.json`);
    if (!existsSync(path)) continue;
    const run = JSON.parse(readFileSync(path, 'utf8')), rs = run.results, r0 = rs[0]?.renderer;
    md.push(`## ${mode === 'headless' ? '1. Headless (as in CI)' : '2. Headed Chrome, real GPU'}`, '');
    md.push(`Measured ${run.date}, ${run.runs} run(s) per size, ${run.browser}, device scale 1. Canvas backend: **${r0?.backend}**. WebGPU: ${r0?.webgpu ? (r0.adapter ? `adapter ${[r0.adapter.vendor, r0.adapter.architecture, r0.adapter.description].filter(Boolean).join(' / ') || 'unnamed'}${r0.adapter.fallback ? ' (a fallback, software, adapter)' : ''}` : 'exposed, but no adapter') : 'not exposed'}. WebGL: ${r0?.gl ?? 'none'}.`, '');
    md.push(`| Scenario | ${rs.map(r => `${r.layers} layers`).join(' | ')} |`, `|---|${rs.map(() => '---|').join('')}`);
    for (const [label, f] of rows) md.push(`| ${label} | ${rs.map(f).join(' | ')} |`);
    md.push('');
    for (const r of rs.filter(r => r.hotspots?.length)) {
        md.push(`### Top hotspots, ${r.layers} layers (${mode})`, '', 'Self time over the whole measured session (CPU profile, 0.5 ms sampling), idle excluded.', '', '| # | Self ms | Function | File:line |', '|---|---|---|---|');
        r.hotspots.slice(0, 5).forEach((h, k) => md.push(`| ${k + 1} | ${h.ms.toFixed(0)} | \`${h.name}\` | \`${h.url}:${h.line}\` |`));
        md.push('');
    }
}
md.push(NOTES);
writeFileSync(OUT, md.join('\n'));
console.log(md.join('\n'));
