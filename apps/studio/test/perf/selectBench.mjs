// Selection benchmark on a real document in the Studio (headless Chromium, the editor's own code):
//   - hitTest time per call (the function the canvas calls on every pointer event), p50 / p95 / max
//   - click to selection rendered: pointerdown until the selection is on screen after one frame, p50 / p95 / max
//   - whether a selection changes the document revision (and so re-runs the layout / scene)
// Needs the Studio (npm run dev:studio) and an API that serves the file (the real server, or the stub for local runs).
// Usage (from apps/studio): [PAGE=<pageId>] node test/perf/selectBench.mjs <fileId> [hitSamples=300] [clickSamples=60] [out.json]
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const [, , fileId = 'bench5k', hitSamples = '300', clickSamples = '60', out] = process.argv;
const BASE = process.env.STUDIO_URL || 'http://127.0.0.1:5173';

const browser = await chromium.launch({ headless: true });
try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    // PAGE=<page id> opens that page of the file (Ant Design: page-amq-70mrr is Data Display).
    const q = process.env.PAGE ? `?page=${encodeURIComponent(process.env.PAGE)}` : '';
    await page.goto(`${BASE}/file/${encodeURIComponent(fileId)}${q}`, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.midas?.doc && window.midas.doc.scene().length > 0, null, { timeout: 120000 });
    await page.evaluate(() => {
        window.midas.fit();
        // Captured at pointerdown on the overlay, the same element the canvas listens on.
        document.getElementById('overlay').addEventListener('pointerdown', () => { window.__t0 = performance.now(); }, { capture: true });
    });
    await page.waitForTimeout(300);

    const info = await page.evaluate(() => ({ layers: window.midas.doc.scene().length, revision: window.midas.doc.revision }));

    // Targets: leaves (text, rect, ellipse) that are big enough to click on screen, seeded so every run picks the same ones.
    const targets = await page.evaluate(() => {
        let s = 20260601;
        const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
        const leaves = window.midas.doc.scene().filter(e => ['text', 'rect', 'ellipse'].includes(e.node.type) && !e.node.locked);
        return leaves.map(e => ({ id: e.node.id, x: e.box.x + e.box.w / 2, y: e.box.y + e.box.h / 2 }))
            .map(t => ({ t, k: rnd() })).sort((a, b) => a.k - b.k).map(o => o.t);
    });

    // hitTest, called directly: the cost of one pointer event's pick. Two rounds; the first warms the caches and is not counted.
    await page.evaluate(ts => { window.__targets = ts; }, targets);
    const hitRun = await page.evaluate(n => {
        const pts = window.__targets.slice(0, n);
        const times = [];
        let correct = 0;
        for (let round = 0; round < 2; round++) {
            for (const p of pts) {
                const t0 = performance.now();
                const r = window.midas.hitTest({ x: p.x, y: p.y });
                const dt = performance.now() - t0;
                if (round === 1) { times.push(dt); if (r && (r.node ?? r).id === p.id) correct++; }
            }
        }
        return { times, correct, n: pts.length };
    }, Math.min(+hitSamples, targets.length));

    // Click to selection rendered: a real mouse click on a layer, then the frame after the selection shows it. The camera
    // is fitted to one board at a time, so the layers are big enough to click.
    const revBefore = await page.evaluate(() => window.midas.doc.revision);
    const boards = await page.evaluate(() => window.midas.doc.scene().filter(e => e.node.type === "frame" && !e.node.parentId && window.midas.doc.children(e.node.id).length > 0).map(e => e.node.id));
    const clicks = [];
    let revisionMoves = 0, missed = 0, clicked = 0;
    for (const boardId of boards) {
        if (clicked >= +clickSamples) break;
        await page.evaluate(id => { window.midas.fit([id]); return new Promise(r => setTimeout(r, 250)); }, boardId);
        const leaves = await page.evaluate(id => {
            const z = window.midas.state.camera.zoom;
            const inside = new Set();
            const walk = nid => { for (const c of window.midas.doc.children(nid)) { inside.add(c.id); walk(c.id); } };
            walk(id);
            return window.midas.doc.scene().filter(e => inside.has(e.node.id) && ["text", "rect", "ellipse"].includes(e.node.type) && Math.min(e.box.w, e.box.h) * z >= 8)
                .map(e => ({ id: e.node.id, x: e.box.x + e.box.w / 2, y: e.box.y + e.box.h / 2 }));
        }, boardId);
        for (const t of leaves) {
            if (clicked >= +clickSamples) break;
            clicked++;
            const screen = await page.evaluate(({ x, y }) => {
                const r = document.getElementById("overlay").getBoundingClientRect(), st = window.midas.state.camera;
                return { x: r.left + st.x + x * st.zoom, y: r.top + st.y + y * st.zoom };
            }, t);
            await page.evaluate(() => { window.midas.select([]); });
            const rev0 = await page.evaluate(() => window.midas.doc.revision);
            await page.mouse.click(screen.x, screen.y);
            const ms = await page.evaluate(() => new Promise(resolve => {
                const started = performance.now();
                const check = () => {
                    if (window.midas.state.selection.size > 0) requestAnimationFrame(() => resolve(performance.now() - window.__t0));
                    else if (performance.now() - started > 4000) resolve(null);
                    else requestAnimationFrame(check);
                };
                check();
            }));
            const rev1 = await page.evaluate(() => window.midas.doc.revision);
            if (rev1 !== rev0) revisionMoves++;
            if (ms !== null) clicks.push({ id: t.id, ms }); else missed++;
        }
    }
    // Frame floor: the same timing for a click that changes nothing (empty canvas). Headless frames are ~16 ms; this is the
    // share of the click-to-selection time that no selection work can remove.
    const floor = [];
    const empty = await page.evaluate(() => { const r = document.getElementById('overlay').getBoundingClientRect(); return { x: r.right - 6, y: r.bottom - 6 }; });
    for (let i = 0; i < 20; i++) {
        await page.evaluate(() => window.midas.select([]));
        await page.mouse.click(empty.x, empty.y);
        floor.push(await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - window.__t0))))));
    }
    const revAfter = await page.evaluate(() => window.midas.doc.revision);

    const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
    const stats = a => a.length ? { n: a.length, p50: +pct(a, .5).toFixed(3), p95: +pct(a, .95).toFixed(3), max: +Math.max(...a).toFixed(3), mean: +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(3) } : { n: 0 };
    const result = {
        file: fileId,
        layers: info.layers,
        hitTest: { ...stats(hitRun.times), ms_unit: 'ms', correctPicks: hitRun.correct, of: hitRun.n },
        clickToSelectionRendered: { ...stats(clicks.map(c => c.ms)), ms_unit: 'ms', missed },
        revision: { before: revBefore, after: revAfter, changedDuringClicks: revisionMoves, clicks: clicks.length },
        errors: errors.slice(0, 5),
    };
    result.frameFloor = { ...stats(floor), ms_unit: 'ms', note: 'empty-canvas click: pointerdown to two frames' };
    // Limits: the run fails (exit 1) when a measured number is over its limit. Override with HIT_P95_MS / CLICK_P95_MS.
    // The click limit is on the selection's own cost: p95 click-to-selection minus p95 of the frame floor. The floor is what the
    // browser needs for two frames (about 40 ms in headless); no code can remove it.
    const limits = { hitP95: +(process.env.HIT_P95_MS || 2), clickOverFloorP95: +(process.env.CLICK_OVER_FLOOR_MS || 10) };
    result.limits = limits;
    result.pass = {
        hitTestP95: hitRun.times.length > 0 && result.hitTest.p95 <= limits.hitP95,
        clickOverFloorP95: clicks.length > 0 && result.clickToSelectionRendered.p95 - result.frameFloor.p95 <= limits.clickOverFloorP95,
        noRevisionChange: revisionMoves === 0,
    };
    console.log(JSON.stringify(result, null, 2));
    if (!Object.values(result.pass).every(Boolean)) process.exitCode = 1;
    if (out) writeFileSync(out, JSON.stringify(result, null, 2));
} finally {
    await browser.close();
}
