// Browser harness for the studio: starts the dev servers when they are down, signs in as the local seed admin, imports a .midas
// file and reads the canvas. Screenshots go to .artifacts/ at the repo root. Used by the *.browser.test.mjs files.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
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
    return () => started.forEach(p => spawn('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore' }));
}

/**
 * Opens the studio signed in as the seed admin and imports the .midas file at `filePath`. Returns the page and the console errors
 * collected since the import. Errors from unauthenticated requests before sign-in are not collected.
 */
export async function openImportedFile(browser, filePath) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
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
    await page.waitForFunction(() => window.midas?.ready && window.midas.doc.children(null).length > 0);
    await page.waitForTimeout(400);
    return { page, errors };
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
export function frameNode(page, id) {
    return page.evaluate(([id, zoom]) => {
        const { camera } = window.midas.state;
        const canvas = document.getElementById('scene').getBoundingClientRect();
        const { box } = window.midas.doc.world(id);
        camera.zoom = zoom;
        camera.x = canvas.width / 2 - (box.x + box.w / 2) * zoom;
        camera.y = canvas.height / 2 - (box.y + box.h / 2) * zoom;
        window.midas.render();
    }, [id, SHOT_ZOOM]);
}

/** Frames the node on the canvas and saves a screenshot of its area to .artifacts/<name>.png. Returns the file path and the rect. */
export async function shotNode(page, id, name, pad = 16) {
    mkdirSync(ARTIFACTS, { recursive: true });
    await frameNode(page, id);
    await page.waitForTimeout(250);
    const r = await screenRect(page, id);
    const clip = { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: r.w + pad * 2, height: r.h + pad * 2 };
    const file = resolve(ARTIFACTS, `${name}.png`);
    await page.screenshot({ path: file, clip });
    return { file, rect: r };
}
