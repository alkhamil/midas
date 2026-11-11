// Alert on the canvas and in Play: a created Alert measured at every Size mode and each layer state (the message alone, a description, a close, a banner,
// no type icon), the same comparison as strict-parity: every visible canvas node is a Play element whose box matches within 0.5px, and Play draws nothing
// the canvas does not. Writes .artifacts/alert-parity.json and one canvas/Play pair per Size and state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { ARTIFACTS, ensureDevServers, openImportedFile } from './harness.mjs';
import { createFromPanel, isolatedStage, measurePair, setProp } from './parity-helpers.mjs';

/** Every state sets all of its props, so the order of the states does not matter. */
const STATES = [
    { name: 'message', props: { showIcon: true, description: false, closable: false, banner: false, action: false } },
    { name: 'description', props: { showIcon: true, description: true, closable: false, banner: false, action: false } },
    { name: 'closable', props: { showIcon: true, description: false, closable: true, banner: false } },
    { name: 'banner', props: { showIcon: true, description: false, closable: false, banner: true } },
    { name: 'no-icon', props: { showIcon: false, description: false, closable: false, banner: false, action: false } },
    { name: 'action', props: { showIcon: true, description: false, closable: false, banner: false, action: true } },
];

test('a created Alert measures the same on the canvas and in Play at every Size and state, within 0.5px', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await chromium.launch();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage({ name: 'alert.midas' }));

    const report = [];
    const failures = [];
    const id = await createFromPanel(page, 'antd-alert');
    const master = await page.evaluate(id => window.midas.doc.get(window.midas.doc.get(id).sourceId), id);
    const sizeColl = master.behavior.variables.size;
    const modes = await page.evaluate(sizeColl => window.midas.doc.data.variables.collections.find(c => c.id === sizeColl).modes, sizeColl);
    for (const mode of modes) {
        // The Size mode is an Appearance mode, on the Design tab.
        await page.locator('[data-inspector-tab="design"]').click();
        await page.selectOption(`select[data-var-mode="${sizeColl}"]`, mode.id);
        await page.waitForTimeout(200);
        for (const state of STATES) {
            for (const [name, value] of Object.entries(state.props)) await setProp(page, name, value);
            const label = `antd-alert ${mode.name} ${state.name}`;
            const pair = `pair-antd-alert-${mode.name.toLowerCase()}-${state.name}`;
            // A banner has no border, so there is no outline to measure.
            const m = await measurePair(page, browser, id, label, pair, { outline: state.name !== 'banner' });
            failures.push(...m.failures);
            if (m.rows) report.push({ label, rows: m.rows, unmapped: m.unmapped, diff: m.diff, edges: m.edges });
        }
    }
    writeFileSync(resolve(ARTIFACTS, 'alert-parity.json'), JSON.stringify(report, null, 2));
    assert.deepEqual(errors, [], 'console errors while measuring');
    assert.deepEqual(failures, [], 'canvas and Play differ');
});

test('a Type change in the Design panel swaps the type icon to the glyph of the new type, and the Play icon follows', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    const browser = await chromium.launch();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage({ name: 'alert-type.midas' }));
    const id = await createFromPanel(page, 'antd-alert');
    const { typeColl, errorId, errorGlyph } = await page.evaluate(id => {
        const master = window.midas.doc.get(window.midas.doc.get(id).sourceId);
        const coll = window.midas.doc.data.variables.collections.find(c => c.id === master.behavior.variables.type);
        return { typeColl: coll.id, errorId: coll.modes.find(m => m.name === 'error').id, errorGlyph: window.midas.doc.nodes.find(n => n.component === true && n.name === 'Icon/alert-error')?.id ?? null };
    }, id);
    assert.ok(errorGlyph, 'the Design System has the error glyph');
    await page.locator('[data-inspector-tab="design"]').click();
    await page.selectOption(`select[data-var-mode="${typeColl}"]`, errorId);
    await page.waitForTimeout(300);
    const icon = await page.evaluate(id => window.midas.doc.get(id).behavior.props.icon, id);
    assert.equal(icon, errorGlyph, 'the type icon takes the error glyph');
    assert.deepEqual(errors, [], 'no console errors');
});
