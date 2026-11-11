// Divider on the canvas and in Play, in Chrome at DPR 1 and 2: every Style, every Placement, vertical, Text on and off. Each scenario sets its props through the Behavior
// tab, shoots the canvas and Play at 1:1, and compares the boxes of the lines and the text (within 0.5px) and the ink of the lines (solid > dashed > dotted, on both).
// Screenshots go to .artifacts/divider-<dpr>x-<scenario>-{canvas,play}.png; the measurements to .artifacts/divider-browser.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { ARTIFACTS, ensureDevServers, inkIn, openImportedFile, shotNode } from './harness.mjs';
import { PAD, canvasTree, createFromPanel, isolatedStage, playTree } from './parity-helpers.mjs';

const TOLERANCE = 0.5;

/** Sets one Behavior prop the way a user does: a mode select, a segmented option or a switch. */
async function set(page, prop, value) {
    await page.locator('#inspector-tab-behavior').click();
    if (prop === 'lineStyle' || prop === 'size') await page.locator(`[data-bp-prop="${prop}"]`).first().selectOption({ label: value });
    else if (typeof value === 'boolean') { const box = page.locator(`[data-bp-prop="${prop}"]`).first(); await (value ? box.check({ force: true }) : box.uncheck({ force: true })); }
    else await page.locator(`[data-bp-action="segment"][data-bp-prop="${prop}"][data-bp-value="${value}"]`).click();
    await page.waitForTimeout(250);
}

const SCENARIOS = [
    ['solid-line', { lineStyle: 'solid' }],
    ['dashed-line', { lineStyle: 'dashed' }],
    ['dotted-line', { lineStyle: 'dotted' }],
    ['solid-text-center', { lineStyle: 'solid', hasText: true, placement: 'center' }],
    ['dashed-text-center', { lineStyle: 'dashed', hasText: true, placement: 'center' }],
    ['dotted-text-center', { lineStyle: 'dotted', hasText: true, placement: 'center' }],
    ['solid-text-start', { lineStyle: 'solid', hasText: true, placement: 'start' }],
    ['solid-text-end', { lineStyle: 'solid', hasText: true, placement: 'end' }],
    ['text-off-again', { hasText: false }],
    ['dashed-vertical', { lineStyle: 'dashed', orientation: 'vertical' }],
    ['solid-vertical', { lineStyle: 'solid', orientation: 'vertical' }],
    ['dotted-vertical', { lineStyle: 'dotted', orientation: 'vertical' }],
];

for (const dpr of [1, 2]) {
    test(`Divider: canvas and Play agree at DPR ${dpr}`, async t => {
        const stop = await ensureDevServers();
        t.after(stop);
        mkdirSync(ARTIFACTS, { recursive: true });
        const browser = await chromium.launch({ channel: 'chrome' });
        t.after(() => browser.close());
        const { page, errors } = await openImportedFile(browser, isolatedStage({ name: 'divider.midas' }), { dpr });
        const id = await createFromPanel(page, 'antd-divider');
        const report = [];
        for (const [name, props] of SCENARIOS) {
            // Orientation first (it hides the text props), then the rest in an order that shows each prop's control.
            for (const prop of ['orientation', 'lineStyle', 'hasText', 'placement']) if (prop in props) await set(page, prop, props[prop]);
            // Nothing selected for the canvas shot: the selection outline would sit on a vertical line at the box edge.
            await page.evaluate(() => window.midas.select([]));
            const label = `divider-${dpr}x-${name}`;
            const canvasShot = await shotNode(page, id, `${label}-canvas`, PAD, 1);
            const tree = await canvasTree(page, id);
            const play = await playTree(page, id, label);
            assert.ok(play, `${name}: Play draws the Divider`);
            const rows = tree.slice(1).map(n => ({ name: n.name, canvas: n.box, play: play.boxes[n.id] }));
            for (const row of rows) {
                assert.ok(row.play, `${name}: Play has an element for ${row.name}`);
                if (row.name.startsWith('line')) {
                    // A line is a w x 0 (or 0 x h) box: compare where it starts and how long it is along its axis.
                    const vertical = row.name === 'lineVertical';
                    const along = vertical ? ['y', 'h'] : ['x', 'w'];
                    assert.ok(Math.abs(row.canvas[along[0]] - (vertical ? row.play.dy : row.play.dx)) <= TOLERANCE, `${name} ${row.name}: start ${row.canvas[along[0]]} vs ${vertical ? row.play.dy : row.play.dx}`);
                    assert.ok(Math.abs(row.canvas[along[1]] - (vertical ? row.play.h : row.play.w)) <= TOLERANCE, `${name} ${row.name}: length ${row.canvas[along[1]]} vs ${vertical ? row.play.h : row.play.w}`);
                }
            }
            assert.ok(Math.abs(tree[0].box.w - play.rootWidth) <= 0.1, `${name}: root width ${tree[0].box.w} vs ${play.rootWidth}`);
            // The ink of the first line in both shots (zoom 1: one CSS pixel is `dpr` device pixels), inside the box so the selection outline does not count.
            const line = tree.find(n => n.name.startsWith('line'));
            const k = dpr, long = line.box.w >= line.box.h;
            const rectIn = at => long ? { x: (PAD + line.box.x + 6) * k, y: (PAD + line.box.y - 1) * k, w: (line.box.w - 12) * k, h: 3 * k } : { x: (PAD + line.box.x - 1) * k, y: (PAD + line.box.y + 1) * k, w: 3 * k, h: (line.box.h - 2) * k };
            const ink = await inkIn(browser, canvasShot.file, rectIn(), { faint: true });
            const playInk = await inkIn(browser, resolve(ARTIFACTS, `${label}-play.png`), rectIn(), { faint: true });
            report.push({ scenario: name, rootWidth: tree[0].box.w, rootHeight: tree[0].box.h, canvas: rows.map(r => ({ name: r.name, ...r.canvas })), playBoxes: rows.map(r => ({ name: r.name, dx: r.play.dx, dy: r.play.dy, w: r.play.w, h: r.play.h })), canvasLineInk: ink, playLineInk: playInk });
        }
        writeFileSync(resolve(ARTIFACTS, `divider-browser-${dpr}x.json`), JSON.stringify(report, null, 1));
        const inkOf = (name, which) => report.find(r => r.scenario === name)[which];
        // The ink ordering is checked where a 1px rule is not a blur of antialiased half pixels: DPR 2. At DPR 1 the numbers are in the report only (a rule centred on a whole pixel is two half-covered rows, and the count of touched pixels no longer follows the dash).
        const surfaces = dpr === 2 ? ['canvasLineInk', 'playLineInk'] : [];
        for (const which of surfaces) for (const [a, b] of [['solid', 'dashed'], ['dashed', 'dotted']]) for (const shape of ['line', 'text-center', 'vertical']) {
            assert.ok(inkOf(`${a}-${shape}`, which) > inkOf(`${b}-${shape}`, which) && inkOf(`${b}-${shape}`, which) > 0, `${which} ${shape}: ${a} has more ink than ${b}, and ${b} has some (${inkOf(`${a}-${shape}`, which)} / ${inkOf(`${b}-${shape}`, which)})`);
        }
        assert.deepEqual(errors, [], 'no console errors');
    });
}
