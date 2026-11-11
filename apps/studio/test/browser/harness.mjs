// Browser harness for the studio: starts the dev servers when they are down, signs in as the local seed admin, imports a .midas
// file and reads the canvas. Screenshots go to .artifacts/ at the repo root. Used by the *.browser.test.mjs files.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(here, '../../../..');
export const ARTIFACTS = resolve(ROOT, '.artifacts');
export const STUDIO_URL = 'http://localhost:5174';
export const API_URL = 'http://localhost:4000';

const SEED_ADMIN = { email: 'admin@midas.local', password: 'admin12345' };

async function isUp(url) {
    try { await fetch(url); return true; } catch { return false; }
}

async function waitUp(url, ms = 90_000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
        if (await isUp(url)) return;
        await new Promise(r => setTimeout(r, 500));
    }
    throw new Error(`${url} did not start within ${ms} ms`);
}

/** Starts the API and the studio dev servers unless they already run. Returns a function that stops what it started. */
export async function ensureDevServers() {
    const started = [];
    if (!(await isUp(API_URL + '/api/auth/me'))) {
        started.push(spawn('npm', ['run', 'dev', '--workspace', '@midas/server'], { cwd: ROOT, shell: true, stdio: 'ignore' }));
        await waitUp(API_URL + '/api/auth/me');
    }
    if (!(await isUp(STUDIO_URL))) {
        started.push(spawn('npm', ['run', 'dev', '--workspace', '@midas/studio', '--', '--port', '5174', '--strictPort'], { cwd: ROOT, shell: true, stdio: 'ignore' }));
        await waitUp(STUDIO_URL);
    }
    // The stop waits until each process has exited and its port is closed: the next test checks the ports at once, and a server
    // still listening then would be taken for a live one and left to die under the test.
    return async () => {
        for (const p of started) {
            await new Promise(done => spawn('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore' }).on('exit', done));
        }
        for (const url of [API_URL + '/api/auth/me', STUDIO_URL]) {
            if (!started.length) break;
            const end = Date.now() + 15_000;
            while (Date.now() < end && (await isUp(url))) await new Promise(r => setTimeout(r, 300));
        }
    };
}

/**
 * Opens the studio signed in as the seed admin and imports the .midas file at `filePath`. Returns the page and the console errors
 * collected since the import. Errors from unauthenticated requests before sign-in are not collected.
 */
export async function openImportedFile(browser, filePath, { dpr = 2 } = {}) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: dpr });
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    await page.goto(STUDIO_URL + '/');
    await page.getByLabel('Email').fill(SEED_ADMIN.email);
    await page.getByLabel('Password').fill(SEED_ADMIN.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.locator('#home-import').waitFor({ state: 'attached' });
    errors.length = 0;
    await page.locator('#home-import').setInputFiles(filePath);
    // The file's own first top-level frame of its active page: a document already open would otherwise satisfy the wait.
    const data = JSON.parse(readFileSync(filePath, 'utf8'));
    const probeId = data.pages.find(p => p.id === data.pageId).nodes.find(n => n.parentId == null).id;
    // The import replaces the document asynchronously: wait until it has landed (the busy overlay is gone and the file's name is open),
    // so a click or a selection made next is not wiped by the load.
    await page.waitForFunction(([id, name]) => window.midas?.ready && !!window.midas.doc.get(id) && window.midas.doc.data.name === name && !document.getElementById('busy-overlay'), [probeId, data.name]);
    await page.waitForTimeout(400);
    await settleFonts(page);
    return { page, errors };
}

/**
 * Waits until the page's webfonts are loaded: a glyph measured before its face arrives differs by a couple of pixels, so every
 * measurement waits for the faces the templates use (Inter at the weights the Sizes and states set).
 */
export function settleFonts(page) {
    return page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([400, 500, 600, 700].map(w => document.fonts.load(`${w} 14px Inter`, 'Aa')));
        await document.fonts.ready;
    });
}

/** Every node of the open document, depth first, as { id, name, parentId, type }. */
export function listNodes(page) {
    return page.evaluate(() => {
        const out = [];
        const walk = parentId => {
            for (const n of window.midas.doc.children(parentId)) {
                out.push({ id: n.id, name: n.name, parentId: n.parentId ?? null, type: n.type, sourceId: n.sourceId ?? null, visible: n.visible !== false });
                walk(n.id);
            }
        };
        walk(null);
        return out;
    });
}

/** The first node with this name on the page named `pageName` (the open page when omitted). */
export async function nodeIdNamed(page, name, parentName) {
    const nodes = await listNodes(page);
    const parent = parentName ? nodes.find(n => n.name === parentName) : null;
    const hit = nodes.find(n => n.name === name && (!parentName || n.parentId === parent?.id));
    if (!hit) throw new Error(`no node named "${name}"${parentName ? ` under "${parentName}"` : ''}`);
    return hit.id;
}

/** A node's rectangle on the page in CSS pixels, from the document's world box and the camera. */
export function screenRect(page, id) {
    return page.evaluate(id => {
        const canvas = document.getElementById('scene').getBoundingClientRect();
        const { camera } = window.midas.state;
        const { box } = window.midas.doc.world(id);
        return {
            x: canvas.x + box.x * camera.zoom + camera.x,
            y: canvas.y + box.y * camera.zoom + camera.y,
            w: box.w * camera.zoom,
            h: box.h * camera.zoom,
        };
    }, id);
}

/** Centres the node on the canvas at a fixed zoom, so every screenshot has the same scale. */
const SHOT_ZOOM = 4;
export function frameNode(page, id, zoom = SHOT_ZOOM) {
    return page.evaluate(([id, zoom]) => {
        const { camera } = window.midas.state;
        const canvas = document.getElementById('scene').getBoundingClientRect();
        const { box } = window.midas.doc.world(id);
        camera.zoom = zoom;
        camera.x = canvas.width / 2 - (box.x + box.w / 2) * zoom;
        camera.y = canvas.height / 2 - (box.y + box.h / 2) * zoom;
        window.midas.render();
    }, [id, zoom]);
}

/** Frames the node on the canvas and saves a screenshot of its area to .artifacts/<name>.png. Returns the file path and the rect. */
export async function shotNode(page, id, name, pad = 16, zoom = SHOT_ZOOM) {
    mkdirSync(ARTIFACTS, { recursive: true });
    await frameNode(page, id, zoom);
    await page.waitForTimeout(250);
    const r = await screenRect(page, id);
    // The size is rounded to whole pixels the way Play's shot is (parity-helpers.mjs): a root 0.01px off an integer must not crop a pixel apart.
    const clip = { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: Math.round(r.w + pad * 2), height: Math.round(r.h + pad * 2) };
    const file = resolve(ARTIFACTS, `${name}.png`);
    await page.screenshot({ path: file, clip });
    return { file, rect: r };
}

/**
 * Selects a node the way a user does: the pointer moves over the layer, then presses. Returns the selection afterwards. The
 * pointer hovers first so the canvas has the pointer position before the press (a press with no hover is lost).
 */
export async function selectByClick(page, id) {
    const r = await screenRect(page, id);
    await page.mouse.move(r.x + r.w / 2, r.y + r.h / 2);
    await page.waitForTimeout(100);
    await page.mouse.click(r.x + r.w / 2, r.y + r.h / 2);
    await page.waitForTimeout(150);
    return page.evaluate(() => [...window.midas.state.selection]);
}

/**
 * Compares two PNG screenshots pixel by pixel in the browser. Returns the size, how many pixels differ by more than `tolerance` in any
 * channel, the largest channel difference, and writes a diff image (differing pixels red over the canvas image, the rest faded).
 */
const dataUrlOf = file => 'data:image/png;base64,' + readFileSync(file).toString('base64');

export async function pixelDiff(browser, fileA, fileB, fileOut, { tolerance = 16, inset = 0 } = {}) {
    const page = await browser.newPage();
    try {
        const result = await page.evaluate(async ([a, b, tol, inset]) => {
            const load = src => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src; });
            const [ia, ib] = await Promise.all([load(a), load(b)]);
            const w = Math.max(ia.width, ib.width), h = Math.max(ia.height, ib.height);
            const draw = img => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h); };
            const da = draw(ia), db = draw(ib);
            const out = new ImageData(w, h);
            let changed = 0, max = 0;
            // Glyph edges are rasterised differently by the canvas and by the DOM, so each side is compared after a 5x5 mean of its
            // luminance: a shifted or misplaced edge still differs, anti-aliasing noise does not.
            const luma = (d, j) => 0.299 * d.data[j] + 0.587 * d.data[j + 1] + 0.114 * d.data[j + 2];
            const blurred = d => {
                const out = new Float32Array(w * h);
                for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
                    let sum = 0, n = 0;
                    for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) {
                        const xx = x + ox, yy = y + oy;
                        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
                        sum += luma(d, (yy * w + xx) * 4); n++;
                    }
                    out[y * w + x] = sum / n;
                }
                return out;
            };
            const la = blurred(da), lb = blurred(db);
            let pixels = 0;
            for (let p = 0; p < w * h; p++) {
                const x = p % w, y = Math.floor(p / w);
                const i = p * 4;
                const inside = x >= inset && y >= inset && x < w - inset && y < h - inset;
                if (!inside) { out.data.set([da.data[i], da.data[i + 1], da.data[i + 2], 80], i); continue; }
                pixels++;
                const d = Math.abs(la[p] - lb[p]);
                max = Math.max(max, d);
                if (d > tol) { changed++; out.data.set([255, 0, 0, 255], i); }
                else { out.data.set([da.data[i], da.data[i + 1], da.data[i + 2], 80], i); }
            }
            const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(out, 0, 0);
            return { w, h, sizeA: [ia.width, ia.height], sizeB: [ib.width, ib.height], changed, max, pixels, png: c.toDataURL('image/png') };
        }, [dataUrlOf(fileA), dataUrlOf(fileB), tolerance, inset]);
        writeFileSync(fileOut, Buffer.from(result.png.split(',')[1], 'base64'));
        const { png, ...rest } = result;
        return rest;
    }
    finally {
        await page.close();
    }
}

/**
 * The number of ink pixels (luminance under 200) in a rectangle of a screenshot, in device pixels: a glyph or a drawn icon has ink, an
 * empty box has none. With `faint`, ink is any pixel that differs from the rectangle's own top-left pixel by a few levels (a light rule on a light background).
 */
export async function inkIn(browser, file, rect, { faint = false } = {}) {
    const page = await browser.newPage();
    try {
        return await page.evaluate(async ([src, r, faint]) => {
            const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
            const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
            const g = c.getContext('2d'); g.drawImage(img, 0, 0);
            const d = g.getImageData(r.x, r.y, r.w, r.h).data;
            const lum = i => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            const ref = lum(0);
            let ink = 0;
            for (let i = 0; i < d.length; i += 4) if (faint ? Math.abs(lum(i) - ref) > 6 : lum(i) < 200) ink++;
            return ink;
        }, [dataUrlOf(file), rect, faint]);
    }
    finally {
        await page.close();
    }
}

/**
 * The outline's position in both images. Each side's inner edge is found from the interior fill: scanning from the white inside of the
 * box outwards through a short window around the nominal edge, the first pixel that is darker than halfway to the stroke's darkest
 * pixel is the inner edge of the stroke (interpolated to a fraction of a pixel). The windows sit at the edges, where the text is not, so
 * the glyphs do not count. Compared are the box's width and height from the inner edges, and the centre of the box in each image.
 * Returns { width, height, centreX, centreY } per image, each with the difference and the tolerance-free values in device pixels.
 */
export async function edgeCheck(browser, fileA, fileB, { inset, dsf = 2 }) {
    const page = await browser.newPage();
    try {
        const result = await page.evaluate(async ([a, b, inset]) => {
            const load = src => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src; });
            const data = async src => {
                const img = await load(src);
                const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
                const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0);
                return { w: img.width, h: img.height, d: x.getImageData(0, 0, img.width, img.height).data };
            };
            const lum = (im, x, y) => { const i = (y * im.w + x) * 4; return 0.299 * im.d[i] + 0.587 * im.d[i + 1] + 0.114 * im.d[i + 2]; };
            // The inner edge along a window: pixel(t) for t = 0 (inside, the fill) upwards; coord gives the axis value of a pixel.
            const innerEdge = (im, pixel, n, coord) => {
                const samples = Array.from({ length: n }, (_, t) => { const [x, y] = pixel(t); return { c: coord(x, y), l: lum(im, x, y) }; });
                const base = samples[0].l;
                const darkest = Math.min(...samples.map(s => s.l));
                const threshold = (base + darkest) / 2;
                for (let t = 1; t < n; t++) {
                    const prev = samples[t - 1], cur = samples[t];
                    if (cur.l < threshold) return prev.c + (cur.c - prev.c) * ((prev.l - threshold) / (prev.l - cur.l));
                }
                return null;
            };
            const measure = im => {
                const midX = Math.floor(im.w / 2), midY = Math.floor(im.h / 2);
                const W = im.w, H = im.h;
                // Windows start in the interior (t = 0 is 8 pixels inside the nominal edge) and run 6 pixels past it.
                const left = innerEdge(im, t => [inset + 8 - t, midY], 14, x => x);
                const right = innerEdge(im, t => [W - inset - 8 + t, midY], 20, x => x);
                const top = innerEdge(im, t => [midX, inset + 8 - t], 14, (_, y) => y);
                const bottom = innerEdge(im, t => [midX, H - inset - 8 + t], 20, (_, y) => y);
                if ([left, right, top, bottom].includes(null)) return null;
                return { width: right - left, height: bottom - top, centreX: (left + right) / 2 - W / 2, centreY: (top + bottom) / 2 - H / 2 };
            };
            const [ia, ib] = await Promise.all([data(a), data(b)]);
            return { a: measure(ia), b: measure(ib) };
        }, [dataUrlOf(fileA), dataUrlOf(fileB), inset]);
        if (!result.a || !result.b) return { found: false, a: result.a, b: result.b };
        const out = { found: true, a: {}, b: {} };
        for (const k of ['width', 'height', 'centreX', 'centreY']) {
            out.a[k] = result.a[k] / dsf;
            out.b[k] = result.b[k] / dsf;
        }
        out.delta = Math.max(...['width', 'height', 'centreX', 'centreY'].map(k => Math.abs(out.a[k] - out.b[k])));
        return out;
    }
    finally {
        await page.close();
    }
}
