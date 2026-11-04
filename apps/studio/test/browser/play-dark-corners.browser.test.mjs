// Play on its default dark background: no pixel just outside a rounded outline is brighter than both the background and the stroke, at
// the four corners. A light ring there reads as a second border. Button Small and Large, Input Middle, created and sized through the
// UI, at device scale 2 in actual size. Writes .artifacts/play-dark-corners-<name>.png. The check does not detect the Input halo
// (Input Middle passes on the pre-fix code): its light stroke hides the ring from a brightness test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ARTIFACTS, ensureDevServers, openImportedFile } from './harness.mjs';
import { createFromPanel, isolatedStage } from './parity-helpers.mjs';

const PLAY_BACKGROUND = [30, 30, 32]; // #1e1e20, the Play default
const DSF = 2;
const MARGIN = 0; // device px beyond the outline's edge that still counts as outline
const TOLERANCE = 8; // levels a pixel outside the outline may be brighter than both the background and the stroke before it is a light ring

/** Opens Play on the component at actual size, on its default background. */
async function openPlay(page, id) {
    await page.evaluate(id => window.midas.select([id]), id);
    await page.locator('#play').click();
    await page.waitForSelector('.play-overlay');
    await page.locator('.play-overlay [aria-label="View options"]').click();
    await page.locator('.play-overlay [data-mode="actual-size"]').click();
    await page.waitForTimeout(400);
    await page.evaluate(() => document.getAnimations().forEach(anim => anim.cancel()));
}

/**
 * Counts the pixels outside each rounded corner of the box that are not the background. `box` is the root's rectangle in device
 * pixels of the shot, `radius` its corner radius in device pixels. Decodes the PNG in a browser page.
 */
async function offPixels(browser, file, box, radius, stroke) {
    const page = await browser.newPage();
    await page.setContent('<canvas id=c></canvas>');
    const b64 = readFileSync(file).toString('base64');
    const out = await page.evaluate(async ({ b64, box, radius, bg, stroke, margin, tol }) => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + b64;
        await img.decode();
        const c = document.getElementById('c');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        const px = g.getImageData(0, 0, c.width, c.height).data;
        const at = (x, y) => { const i = (y * c.width + x) * 4; return [px[i], px[i + 1], px[i + 2]]; };
        const corners = [
            { x: box.x, y: box.y, sx: 1, sy: 1 },
            { x: box.x + box.w, y: box.y, sx: -1, sy: 1 },
            { x: box.x, y: box.y + box.h, sx: 1, sy: -1 },
            { x: box.x + box.w, y: box.y + box.h, sx: -1, sy: -1 },
        ];
        const counts = [];
        for (const k of corners) {
            // The arc's centre lies `radius` inside the corner; pixels in the corner square beyond the arc (plus the margin) are outside.
            const cx = k.x + k.sx * radius, cy = k.y + k.sy * radius;
            let bad = 0;
            for (let y = Math.min(k.y, cy) - 2; y <= Math.max(k.y, cy) + 2; y++) {
                for (let x = Math.min(k.x, cx) - 2; x <= Math.max(k.x, cx) + 2; x++) {
                    const inSquare = (k.sx > 0 ? x <= cx : x >= cx) && (k.sy > 0 ? y <= cy : y >= cy);
                    if (!inSquare) continue;
                    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
                    if (d <= radius + margin) continue;
                    const p = at(x, y);
                    const lum = (p[0] + p[1] + p[2]) / 3;
                    const top = Math.max((bg[0] + bg[1] + bg[2]) / 3, (stroke[0] + stroke[1] + stroke[2]) / 3);
                    if (lum - top > tol) bad++;
                }
            }
            counts.push(bad);
        }
        return counts;
    }, { b64, box, radius, bg: PLAY_BACKGROUND, stroke, margin: MARGIN, tol: TOLERANCE });
    await page.close();
    return out;
}

for (const [templateId, sizeName] of [['button', 'sm'], ['button', 'lg'], ['input', 'md']]) {
    test(`Play on the dark background: the outside of a ${templateId} ${sizeName} corner is the background`, async t => {
        const stop = await ensureDevServers();
        t.after(stop);
        mkdirSync(ARTIFACTS, { recursive: true });
        const browser = await chromium.launch();
        t.after(() => browser.close());
        const { page, errors } = await openImportedFile(browser, isolatedStage(), DSF);
        const id = await createFromPanel(page, templateId);
        const master = await page.evaluate(id => window.midas.doc.get(window.midas.doc.get(id).sourceId), id);
        const sizeColl = master.behavior.variables.size;
        const mode = await page.evaluate(([sizeColl, name]) => window.midas.doc.data.variables.collections.find(c => c.id === sizeColl).modes.find(m => m.name === name), [sizeColl, sizeName]);
        await page.evaluate(id => window.midas.select([id]), id);
        await page.locator('[data-inspector-tab="design"]').click();
        await page.selectOption(`select[data-var-mode="${sizeColl}"]`, mode.id);
        await page.waitForTimeout(200);
        await openPlay(page, id);
        const r = await page.evaluate(id => {
            const el = document.querySelector(`.play-overlay [data-node-id="${id}"]`);
            const b = el.getBoundingClientRect();
            // One element draws the border: the stroke colour and the radius are read from the host itself.
            const cs = getComputedStyle(el);
            const rgb = cs.borderTopColor.match(/\d+/g).slice(0, 3).map(Number);
            return { x: b.x, y: b.y, w: b.width, h: b.height, radius: parseFloat(cs.borderTopLeftRadius), stroke: rgb };
        }, id);
        const clip = { x: r.x - 12, y: r.y - 12, width: r.w + 24, height: r.h + 24 };
        const file = resolve(ARTIFACTS, `play-dark-corners-${templateId}-${sizeName.toLowerCase()}.png`);
        writeFileSync(file, await page.screenshot({ clip }));
        const box = { x: 12 * DSF, y: 12 * DSF, w: Math.round(r.w * DSF), h: Math.round(r.h * DSF) };
        const counts = await offPixels(browser, file, box, Math.round(r.radius * DSF), r.stroke);
        assert.deepEqual(counts, [0, 0, 0, 0], `light pixels outside the outline (brighter than the background and the stroke), per corner (TL, TR, BL, BR): ${counts}`);
        assert.deepEqual(errors, [], 'console errors');
    });
}
