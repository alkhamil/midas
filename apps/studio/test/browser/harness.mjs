// Browser harness for the studio: starts the dev servers when they are down, signs in as the local seed admin, imports a .midas
// file and reads the canvas. Screenshots go to .artifacts/ at the repo root. Used by the *.browser.test.mjs files.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after } from 'node:test';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(here, '../../../..');
export const ARTIFACTS = resolve(ROOT, '.artifacts');
// The studio's port: MIDAS_STUDIO_PORT moves it (a preview of the production build can run beside a dev server on 5174).
const STUDIO_PORT = process.env.MIDAS_STUDIO_PORT || '5174';
export const STUDIO_URL = `http://localhost:${STUDIO_PORT}`;
export const API_URL = 'http://localhost:4000';


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

/**
 * How the studio is served: `preview` (the production build, `vite preview`, the default of the suite) or `dev` (the Vite dev server, the fallback). The suite
 * runner sets MIDAS_STUDIO; a file run on its own without it uses the dev server, as before.
 */
export const STUDIO_MODE = process.env.MIDAS_STUDIO === 'preview' ? 'preview' : 'dev';

/** The servers this process started. They run until `stopServers` (the suite's global teardown) or until the process exits. */
const started = [];
let exitHook = false;

/** Stops what this process started and waits until each port is closed (the next start checks the ports at once). */
export async function stopServers() {
    const list = started.splice(0);
    for (const p of list) await new Promise(done => spawn('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore' }).on('exit', done));
    for (const url of [API_URL + '/api/auth/me', STUDIO_URL]) {
        if (!list.length) break;
        const end = Date.now() + 15_000;
        while (Date.now() < end && (await isUp(url))) await new Promise(r => setTimeout(r, 300));
    }
}

/** Builds the production studio (what `vite preview` serves). */
export function buildStudio() {
    const r = spawnSync('npm', ['run', 'build', '--workspace', '@midas/studio'], { cwd: ROOT, shell: true, stdio: 'ignore' });
    if (r.status !== 0) throw new Error('the studio build failed (npm run build --workspace @midas/studio)');
}

/**
 * Starts the API and the studio unless they already run, once: a second call (the next test of the file) finds them up and starts nothing. The servers are
 * not stopped between tests: the returned function does nothing, and what this process started is killed when it exits (the suite's global setup
 * starts them first and stops them at the end, so the files find them up).
 */
export async function ensureDevServers() {
    const spawnServer = args => { const p = spawn('npm', args, { cwd: ROOT, shell: true, stdio: 'ignore' }); p.unref(); started.push(p); };
    if (!(await isUp(API_URL + '/api/auth/me'))) {
        spawnServer(['run', 'dev', '--workspace', '@midas/server']);
        await waitUp(API_URL + '/api/auth/me');
    }
    if (!(await isUp(STUDIO_URL))) {
        if (STUDIO_MODE === 'preview') {
            if (!existsSync(resolve(ROOT, 'apps/studio/dist/index.html'))) buildStudio();
            spawnServer(['run', 'preview', '--workspace', '@midas/studio', '--', '--port', STUDIO_PORT, '--strictPort']);
        }
        else spawnServer(['run', 'dev', '--workspace', '@midas/studio', '--', '--port', STUDIO_PORT, '--strictPort']);
        await waitUp(STUDIO_URL);
    }
    if (started.length && !exitHook) {
        exitHook = true;
        process.on('exit', () => { for (const p of started) spawnSync('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore' }); });
    }
    return async () => {};
}

/** Waits `frames` animation frames: what a fixed pause was waiting for, a canvas frame that has run, without a clock. */
export function settle(page, frames = 2) {
    return page.evaluate(n => new Promise(resolve => { let left = n; const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick)); requestAnimationFrame(tick); }), frames);
}

/**
 * One Chromium per test file: the first call launches it, the next ones share it. What a test opens through it (contexts and pages) is closed by the
 * `browser.close()` the test already calls in its cleanup, and the browser itself ends with the process, so each test still starts from a fresh page.
 */
let shared = null;
const opened = new Set();
// The shared browser ends with its test file: a running Chromium keeps the process alive. (Only under `node --test`: other scripts that import the harness close what they launch.)
if (process.env.NODE_TEST_CONTEXT) after(async () => { await shared?.close(); shared = null; });
export async function launchBrowser() {
    shared ??= await chromium.launch();
    const track = async make => { const c = await make(); opened.add(c.context ? c.context() : c); return c; };
    return new Proxy(shared, {
        get(target, key) {
            if (key === 'close') return async () => { for (const c of [...opened]) await c.close().catch(() => {}); opened.clear(); };
            if (key === 'newPage') return options => track(() => target.newPage(options));
            if (key === 'newContext') return options => track(() => target.newContext(options));
            const value = target[key];
            return typeof value === 'function' ? value.bind(target) : value;
        },
    });
}

/**
 * The signed-in session, made once and kept in .artifacts/session.json: a context starts from it, so a test does not sign in again. The saved state is the
 * cookies and storage right after the sign-in (before any document is open); a state the server no longer accepts is replaced by a fresh sign-in.
 */
const SESSION_FILE = resolve(ARTIFACTS, 'session.json');
const SEED_ADMIN_LOGIN = { email: 'admin@midas.local', password: 'admin12345' };
async function signedInPage(browser, { dpr, viewport }) {
    const readState = () => (existsSync(SESSION_FILE) ? JSON.parse(readFileSync(SESSION_FILE, 'utf8')) : undefined);
    for (const state of [readState(), undefined]) {
        const context = await browser.newContext({ viewport, deviceScaleFactor: dpr, storageState: state });
        const page = await context.newPage();
        await page.goto(STUDIO_URL + '/');
        await page.waitForFunction(() => document.querySelector('#home-import') || document.querySelector('input[type="password"]'));
        if (await page.locator('#home-import').count()) return page;
        await page.getByLabel('Email').fill(SEED_ADMIN_LOGIN.email);
        await page.getByLabel('Password').fill(SEED_ADMIN_LOGIN.password);
        await page.getByRole('button', { name: 'Sign in' }).click();
        await page.locator('#home-import').waitFor({ state: 'attached' });
        mkdirSync(ARTIFACTS, { recursive: true });
        writeFileSync(SESSION_FILE, JSON.stringify(await context.storageState()));
        return page;
    }
}

/**
 * Opens the studio signed in as the seed admin and imports the .midas file at `filePath`. Returns the page and the console errors
 * collected since the import. Errors from unauthenticated requests before sign-in are not collected.
 */
export async function openImportedFile(browser, filePath, { dpr = 2 } = {}) {
    const page = await signedInPage(browser, { dpr, viewport: { width: 1400, height: 900 } });
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    await page.locator('#home-import').setInputFiles(filePath);
    // The file's own first top-level frame of its active page: a document already open would otherwise satisfy the wait.
    const data = JSON.parse(readFileSync(filePath, 'utf8'));
    const probeId = data.pages.find(p => p.id === data.pageId).nodes.find(n => n.parentId == null).id;
    // The import replaces the document asynchronously: wait until it has landed (the busy overlay is gone and the file's name is open),
    // so a click or a selection made next is not wiped by the load.
    await page.waitForFunction(([id, name]) => window.midas?.ready && !!window.midas.doc.get(id) && window.midas.doc.data.name === name && !document.getElementById('busy-overlay'), [probeId, data.name]);
    await documentQuiet(page);
    await settleFonts(page);
    return { page, errors };
}

/** Waits until the open document stops changing (its revision holds for ten frames): the import's own follow-up work has run, so the next click is not wiped by it. */
function documentQuiet(page) {
    return page.waitForFunction(() => {
        const w = window, rev = w.midas.doc.revision, s = (w.__quiet ??= { rev, frames: 0 });
        if (s.rev !== rev) { s.rev = rev; s.frames = 0; } else s.frames++;
        return s.frames >= 10;
    }, null, { polling: 'raf', timeout: 180_000 });
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
/**
 * The screenshot clip of a node's box with a pad, on whole pixels: the origin is floored (the pad covers the fraction) and the size is the box's size
 * plus both pads, rounded, the same rule for the canvas and for Play. A fractional origin on one side would otherwise cost a pixel there.
 */
export function integerClip(r, pad) {
    return { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: Math.round(r.w + pad * 2), height: Math.round(r.h + pad * 2) };
}
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
    await settle(page, 3);
    // A hug text re-measures after a selection change: the shot waits until the root's width holds still, so it is the settled box.
    let last = null;
    for (let i = 0; i < 20; i++) {
        const w = await page.evaluate(id => window.midas.doc.world(id).box.w, id);
        if (w === last) break;
        last = w;
        await settle(page, 4);
    }
    const r = await screenRect(page, id);
    // The size is rounded to whole pixels the way Play's shot is (parity-helpers.mjs): a root 0.01px off an integer must not crop a pixel apart.
    const clip = integerClip(r, pad);
    const file = resolve(ARTIFACTS, `${name}.png`);
    await page.screenshot({ path: file, clip });
    return { file, rect: r, clip };
}

/**
 * Selects a node the way a user does: the pointer moves over the layer, then presses. Returns the selection afterwards. The
 * pointer hovers first so the canvas has the pointer position before the press (a press with no hover is lost).
 */
export async function selectByClick(page, id) {
    const r = await screenRect(page, id);
    await page.mouse.move(r.x + r.w / 2, r.y + r.h / 2);
    await settle(page, 2);
    await page.mouse.click(r.x + r.w / 2, r.y + r.h / 2);
    await settle(page, 3);
    return page.evaluate(() => [...window.midas.state.selection]);
}

/**
 * Compares two PNG screenshots pixel by pixel in the browser. Returns the size, how many pixels differ by more than `tolerance` in any
 * channel, the largest channel difference, and writes a diff image (differing pixels red over the canvas image, the rest faded).
 */
const dataUrlOf = file => 'data:image/png;base64,' + readFileSync(file).toString('base64');

export async function pixelDiff(browser, fileA, fileB, fileOut, { tolerance = 16, inset = 0, ignore = [] } = {}) {
    const page = await browser.newPage();
    try {
        const result = await page.evaluate(async ([a, b, tol, inset, ignore]) => {
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
                const inside = x >= inset && y >= inset && x < w - inset && y < h - inset && !ignore.some(r => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h);
                if (!inside) { out.data.set([da.data[i], da.data[i + 1], da.data[i + 2], 80], i); continue; }
                pixels++;
                const d = Math.abs(la[p] - lb[p]);
                max = Math.max(max, d);
                if (d > tol) { changed++; out.data.set([255, 0, 0, 255], i); }
                else { out.data.set([da.data[i], da.data[i + 1], da.data[i + 2], 80], i); }
            }
            const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(out, 0, 0);
            return { w, h, sizeA: [ia.width, ia.height], sizeB: [ib.width, ib.height], changed, max, pixels, png: c.toDataURL('image/png') };
        }, [dataUrlOf(fileA), dataUrlOf(fileB), tolerance, inset, ignore]);
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
