// Strict parity for generator-built components: a Button and an Input created from the Components panel are measured on the canvas
// and in Play at every Size mode and each key state. Every visible canvas node must be a Play element whose box matches the canvas box
// within 0.5px (relative to the component root), and Play must draw nothing in the component that has no node. The components are
// made on an isolated stage (the testing file's own nodes would show through the crops), with nothing selected or hovered for the
// canvas shots. Writes .artifacts/strict-parity.json and one canvas/Play pair per template, Size and state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { ARTIFACTS, edgeCheck, ensureDevServers, openImportedFile, pixelDiff, shotNode } from './harness.mjs';
import { FIXTURE, PAD, canvasTree, compare, createFromPanel, isolatedStage, playTree, setProp } from './parity-helpers.mjs';

const TOLERANCE_PX = 0.5;
const DIFF_LIMIT = 0.08;
// The root box is the same width in both, to this many CSS pixels (the text widths round differently in layout and on the canvas).
const ROOT_WIDTH_TOLERANCE_PX = 0.1;

/** The states each template is measured in, after its Size modes: the props that state sets. */
const STATES = {
    button: [
        { name: 'rest', props: { loading: false } },
        { name: 'loading', props: { loading: true } },
    ],
    input: [
        { name: 'placeholder', props: { value: '', allowClear: false, showCount: false } },
        { name: 'value', props: { value: 'Hello', allowClear: false, showCount: false } },
        { name: 'allowClear', props: { value: 'Hello', allowClear: true, showCount: false } },
        { name: 'showCount', props: { value: 'Hello', allowClear: false, showCount: true } },
    ],
};

test('a created Button and Input measure the same on the canvas and in Play at every Size and key state, within 0.5px', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await chromium.launch();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage());

    const report = [];
    const failures = [];
    for (const templateId of ['button', 'input']) {
        const id = await createFromPanel(page, templateId);
        const master = await page.evaluate(id => window.midas.doc.get(window.midas.doc.get(id).sourceId), id);
        const sizeColl = master.behavior.variables.size;
        const modes = await page.evaluate(sizeColl => window.midas.doc.data.variables.collections.find(c => c.id === sizeColl).modes, sizeColl);
        for (const mode of modes) {
            // The Size mode is an Appearance mode, on the Design tab.
            await page.locator('[data-inspector-tab="design"]').click();
            await page.selectOption(`select[data-var-mode="${sizeColl}"]`, mode.id);
            await page.waitForTimeout(200);
            for (const state of STATES[templateId]) {
                for (const [name, value] of Object.entries(state.props)) await setProp(page, name, value);
                const label = `${templateId} ${mode.name} ${state.name}`;
                const pair = `pair-${templateId}-${mode.name.toLowerCase()}-${state.name.toLowerCase()}`;
                await page.evaluate(() => window.midas.select([]));
                await page.mouse.move(2, 2);
                await page.waitForTimeout(150);
                await shotNode(page, id, `${pair}-canvas`, PAD, 1);
                const canvas = await canvasTree(page, id);
                const play = await playTree(page, id, pair);
                assert.ok(play, `${label}: Play draws the component`);
                const { rows, unmapped } = compare(canvas, play);
                const diff = await pixelDiff(browser, resolve(ARTIFACTS, `${pair}-canvas.png`), resolve(ARTIFACTS, `${pair}-play.png`), resolve(ARTIFACTS, `${pair}-diff.png`), { inset: PAD * 2, tolerance: 24 });
                const edges = await edgeCheck(browser, resolve(ARTIFACTS, `${pair}-canvas.png`), resolve(ARTIFACTS, `${pair}-play.png`), { inset: PAD * 2 });
                if (!edges.found) failures.push(`${label}: the outline is not found on both shots`);
                else if (edges.delta > TOLERANCE_PX) failures.push(`${label}: the outline differs by ${edges.delta.toFixed(2)} px (width, height or centre)`);
                report.push({ label, rows, unmapped, diff, edges });
                const rootRow = rows[0];
                if (Math.abs(rootRow.canvas.w - rootRow.play.w) > ROOT_WIDTH_TOLERANCE_PX) failures.push(`${label}: root width ${rootRow.canvas.w.toFixed(4)} on the canvas, ${rootRow.play.w.toFixed(4)} in Play`);
                if (diff.sizeA.join() !== diff.sizeB.join()) failures.push(`${label}: canvas and Play crops differ in size`);
                else if (diff.changed / diff.pixels > DIFF_LIMIT) failures.push(`${label}: ${(100 * diff.changed / diff.pixels).toFixed(1)}% of pixels differ`);
                for (const row of rows) {
                    if (row.missing) failures.push(`${label}: ${row.name} is on the canvas but not in Play`);
                    else if (row.delta > TOLERANCE_PX) failures.push(`${label}: ${row.name} differs by ${row.delta}px`);
                }
                for (const u of unmapped) failures.push(`${label}: Play draws ${u} with no node`);
            }
            // Back to the rest state before the next Size mode, so each mode starts from the same props.
            for (const [name, value] of Object.entries(STATES[templateId][0].props)) await setProp(page, name, value);
        }
    }
    writeFileSync(resolve(ARTIFACTS, 'strict-parity.json'), JSON.stringify(report, null, 2));
    assert.deepEqual(errors, [], 'console errors while measuring');
    assert.deepEqual(failures, [], 'canvas and Play differ');
});
