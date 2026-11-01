// Canvas is the reference: every canvas part of the testing file is found in Play with its box within 1px of the canvas (Play
// relative to the frame it sits in), and every visible element Play draws in that frame maps to a node. Writes
// .artifacts/parity.json and one screenshot per part and side.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { ARTIFACTS, ROOT, ensureDevServers, openImportedFile, shotNode } from './harness.mjs';

const FIXTURE = resolve(ROOT, 'testing.midas');
const TOLERANCE_PX = 1;
// The parts and instances the parity run compares: Input states (placeholder, clear, count, error) and Button loading.
const PARTS = ['i-filled', 'i-filled-value', 'i-filled-clear', 'i-filled-count', 'i-state-error', 'i-state-error-placeholder', 't-loading', 't-loading-spinner'];
// Play draws the value's input over the text layer it covers: while the value is empty and a placeholder shows, that is the placeholder.
const PLAY_ELEMENT = { 'i-state-error-placeholder': 'i-state-error-value' };

const frameRect = page => page.evaluate(() => {
    const r = document.querySelector('.play-overlay [data-node-id="t-frame"]').getBoundingClientRect();
    return { x: r.x, y: r.y, scale: r.width / 1000 };
});

/** The box of a Play element, in the frame's own units (the document's units), from its node id. */
const playBox = (page, id, frame) => page.evaluate(([id, frame]) => {
    const el = document.querySelector(`.play-overlay [data-node-id="${id}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: (r.x - frame.x) / frame.scale, y: (r.y - frame.y) / frame.scale, w: r.width / frame.scale, h: r.height / frame.scale };
}, [id, frame]);

/**
 * Visible elements inside the Play frame that carry no node id, and no ancestor of theirs does: the DOM the contract must not have.
 */
const unmappedInFrame = page => page.evaluate(() => {
    const frame = document.querySelector('.play-overlay [data-node-id="t-frame"]');
    const out = [];
    for (const el of frame.querySelectorAll('*')) {
        if (el.closest('[data-node-id]') !== el && el.closest('[data-node-id]')) continue;
        if (el.hasAttribute('data-node-id') || el.hasAttribute('data-part')) continue;
        const hasText = [...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim() !== '');
        const visible = el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
        if ((hasText || el.tagName === 'INPUT') && visible) out.push(`${el.tagName.toLowerCase()}.${el.className}`);
    }
    return out;
});

test('canvas parts are in Play within 1px, and Play draws nothing without a node', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await chromium.launch();
    t.after(() => browser.close());

    const { page, errors } = await openImportedFile(browser, FIXTURE);
    const canvas = {};
    for (const id of PARTS) {
        canvas[id] = await page.evaluate(id => {
            const n = window.midas.doc.get(id);
            const w = window.midas.doc.world(id);
            return { visible: n?.visible !== false && !w.hidden, box: { x: w.box.x, y: w.box.y, w: w.box.w, h: w.box.h } };
        }, id);
        await shotNode(page, id, `canvas-${id}`);
    }

    await page.locator('#play').click();
    await page.waitForSelector('.play-overlay');
    await page.waitForTimeout(800);
    // Measure layout boxes: a spinning part is read at rest, not at the angle of the moment.
    await page.evaluate(() => document.getAnimations().forEach(anim => anim.cancel()));
    const frame = await frameRect(page);
    const report = { tolerancePx: TOLERANCE_PX, parts: {}, unmapped: await unmappedInFrame(page) };
    for (const id of PARTS) {
        const playId = PLAY_ELEMENT[id] ?? id;
        const play = await playBox(page, playId, frame);
        const el = page.locator(`.play-overlay [data-node-id="${playId}"]`);
        if (play) await el.screenshot({ path: resolve(ARTIFACTS, `play-${id}.png`) }).catch(() => {});
        const delta = play && canvas[id].visible
            ? Math.max(...['x', 'y', 'w', 'h'].map(k => Math.abs(play[k] - canvas[id].box[k])))
            : null;
        report.parts[id] = { canvasVisible: canvas[id].visible, canvas: canvas[id].box, play, deltaPx: delta === null ? null : +delta.toFixed(2) };
    }
    writeFileSync(resolve(ARTIFACTS, 'parity.json'), JSON.stringify(report, null, 2));

    assert.deepEqual(errors, [], 'console errors while comparing');
    assert.deepEqual(report.unmapped, [], 'visible Play elements with no node id');
    for (const id of PARTS) {
        if (!canvas[id].visible) continue;
        assert.ok(report.parts[id].play, `${id} is on the canvas but Play draws no element for it`);
    }
    const drift = Object.entries(report.parts).filter(([, p]) => p.deltaPx !== null && p.deltaPx > TOLERANCE_PX);
    assert.deepEqual(drift.map(([id, p]) => `${id} ${p.deltaPx}px`), [], 'Play boxes differ from the canvas by more than 1px');
});
