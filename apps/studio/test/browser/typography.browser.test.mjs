// Typography parity: the Button and Input text at the five Size modes is the same on the canvas and in Play. Family, size, weight
// and line height match; a Button label's glyph advance and its centre line match within 1px; an Input's box matches within 1px.
// Then a Size mode change on an instance re-measures its canvas text. Writes .artifacts/typography-matrix.json and screenshots of
// the Matrix frame on the canvas and in Play.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { ARTIFACTS, ROOT, ensureDevServers, openImportedFile, shotNode } from './harness.mjs';
import { fontFamilyCss } from '../../../../packages/builder-core/src/behavior-engine/typography.js';

const FIXTURE = resolve(ROOT, 'scripts/fixtures/typography-matrix.midas');
const TOLERANCE_PX = 1;
const SIZES = ['xs', 'sm', 'md', 'lg', 'xl'];
const TARGETS = [...SIZES.map(s => ({ kind: 'Button', id: `b-${s}-label` })), ...SIZES.map(s => ({ kind: 'Input', id: `i-${s}-label` }))];

/** The canvas text of a node: its family, size, numeric weight, line height in px, its world box, and its glyph advance. */
const canvasText = (page, id, stack) => page.evaluate(([id, stack]) => {
    const n = window.midas.doc.get(id);
    const w = window.midas.doc.world(id);
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = `${n.fontStyle || 'normal'} ${n.fontWeight} ${n.fontSize}px ${stack}`;
    ctx.letterSpacing = `${n.letterSpacing || 0}px`;
    return {
        family: n.fontFamily, size: n.fontSize, weight: n.fontWeight, lineHeight: +(n.lineHeight * n.fontSize).toFixed(2),
        box: { x: w.box.x, y: w.box.y, w: w.box.w, h: w.box.h }, advance: ctx.measureText(n.text).width,
    };
}, [id, stack]);

/** The Play element of a node: its computed text style, its box in the frame's units, and its glyph advance when it is a span. */
const playText = (page, id) => page.evaluate(id => {
    const frame = document.querySelector('.play-overlay [data-node-id="m-frame"]').getBoundingClientRect();
    const scale = frame.width / 640;
    const el = document.querySelector(`.play-overlay [data-node-id="${id}"]`);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    let advance = null;
    if (el.tagName === 'SPAN') {
        const range = document.createRange();
        range.selectNodeContents(el);
        advance = range.getBoundingClientRect().width / scale;
    }
    return {
        family: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(), size: parseFloat(cs.fontSize), weight: +cs.fontWeight,
        lineHeight: parseFloat(cs.lineHeight), box: { x: (r.x - frame.x) / scale, y: (r.y - frame.y) / scale, w: r.width / scale, h: r.height / scale },
        advance,
    };
}, id);

test('the Button and Input text at each Size mode is the same on the canvas and in Play, within 1px', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await chromium.launch();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, FIXTURE);

    const stack = fontFamilyCss('Inter');
    const canvas = {};
    for (const target of TARGETS) canvas[target.id] = await canvasText(page, target.id, stack);
    await shotNode(page, 'm-frame', 'matrix-canvas');

    // Play starts at the top-level frame that holds the selection, so the matrix frame is selected first.
    await page.evaluate(() => window.midas.select(['m-frame']));
    await page.locator('#play').click();
    await page.waitForSelector('.play-overlay');
    await page.waitForTimeout(800);
    const report = [];
    for (const target of TARGETS) {
        const play = await playText(page, target.id);
        const c = canvas[target.id];
        const centre = play && { dy: Math.abs(play.box.y + play.box.h / 2 - (c.box.y + c.box.h / 2)), dx: Math.abs(play.box.x - c.box.x) };
        const boxDelta = play ? Math.max(...['x', 'y', 'w', 'h'].map(k => Math.abs(play.box[k] - c.box[k]))) : null;
        report.push({
            id: target.id, kind: target.kind, canvas: c, play,
            advanceDeltaPx: play && play.advance !== null ? +Math.abs(play.advance - c.advance).toFixed(2) : null,
            centreDeltaPx: centre ? +Math.max(centre.dx, centre.dy).toFixed(2) : null,
            boxDeltaPx: boxDelta === null ? null : +boxDelta.toFixed(2),
        });
    }
    await page.locator('.play-overlay [data-node-id="m-frame"]').screenshot({ path: resolve(ARTIFACTS, 'matrix-play.png') });
    writeFileSync(resolve(ARTIFACTS, 'typography-matrix.json'), JSON.stringify(report, null, 2));

    assert.deepEqual(errors, [], 'console errors while comparing');
    for (const row of report) {
        assert.ok(row.play, `${row.id} is drawn in Play`);
        assert.equal(row.play.family, row.canvas.family, `${row.id} family`);
        assert.equal(row.play.size, row.canvas.size, `${row.id} font size`);
        assert.equal(row.play.weight, row.canvas.weight, `${row.id} weight`);
        assert.ok(Math.abs(row.play.lineHeight - row.canvas.lineHeight) <= 0.5, `${row.id} line height ${row.play.lineHeight} vs ${row.canvas.lineHeight}`);
        if (row.kind === 'Button') {
            assert.ok(row.advanceDeltaPx <= TOLERANCE_PX, `${row.id} glyph advance differs by ${row.advanceDeltaPx}px`);
            assert.ok(row.centreDeltaPx <= TOLERANCE_PX, `${row.id} centre line differs by ${row.centreDeltaPx}px`);
        } else {
            assert.ok(row.boxDeltaPx <= TOLERANCE_PX, `${row.id} box differs by ${row.boxDeltaPx}px`);
        }
    }
});

test('switching an instance\'s Size mode re-measures its canvas text', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    const browser = await chromium.launch();
    t.after(() => browser.close());
    const { page } = await openImportedFile(browser, FIXTURE);
    const stack = fontFamilyCss('Inter');
    const before = await canvasText(page, 'b-xs-label', stack);
    await page.evaluate(() => window.midas.select(['b-xs']));
    await page.waitForSelector('select[data-var-mode="c-size"]');
    await page.locator('select[data-var-mode="c-size"]').selectOption('xl');
    await page.waitForTimeout(300);
    const after = await canvasText(page, 'b-xs-label', stack);
    const mode = await page.evaluate(() => window.midas.doc.get('b-xs').varModes);
    assert.equal(before.size, 10, 'xs is 10px');
    assert.equal(after.size, 20, `xl is 20px after the switch (instance modes ${JSON.stringify(mode)})`);
    assert.ok(after.box.h > before.box.h || after.box.w !== before.box.w, 'the text box re-measured');
    await shotNode(page, 'b-xs', 'matrix-mode-switch');
});
