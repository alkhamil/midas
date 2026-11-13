// Card on the canvas and in Play: a created Card measured at all five Size modes and each layer state (the header alone, a cover above the header, an extra
// link in the header, actions, and no header), the same comparison as strict-parity: every visible canvas node is a Play
// element whose box matches within 0.5px, and Play draws nothing the canvas does not. Writes .artifacts/card-parity.json and one canvas/Play pair per Size and state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ARTIFACTS, ensureDevServers, openImportedFile, launchBrowser } from './harness.mjs';
import { createFromPanel, isolatedStage, measurePair, setProp } from './parity-helpers.mjs';

/** Every state sets all of its props, so the order of the states does not matter. */
const STATES = [
    { name: 'header', props: { header: true, title: 'Card title', extra: false, cover: false, actions: false, hoverable: false } },
    { name: 'cover', props: { header: true, title: 'Card title', extra: false, cover: true, actions: false, hoverable: false } },
    { name: 'extra', props: { header: true, title: 'Card title', extra: true, cover: false, actions: false, hoverable: false } },
    { name: 'actions', props: { header: true, title: 'Card title', extra: false, cover: false, actions: true, hoverable: false } },
    { name: 'headless', props: { extra: false, header: false, cover: true, actions: true, hoverable: true } },
];

test('a created Card measures the same on the canvas and in Play at every Size and state, within 0.5px', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage({ name: 'card.midas' }));

    const report = [];
    const failures = [];
    const id = await createFromPanel(page, 'antd-card');
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
            const label = `antd-card ${mode.name} ${state.name}`;
            const pair = `pair-antd-card-${mode.name.toLowerCase()}-${state.name}`;
            const m = await measurePair(page, browser, id, label, pair, { outline: true });
            failures.push(...m.failures);
            if (m.rows) report.push({ label, rows: m.rows, unmapped: m.unmapped, diff: m.diff, edges: m.edges });
        }
    }
    writeFileSync(resolve(ARTIFACTS, 'card-parity.json'), JSON.stringify(report, null, 2));
    assert.deepEqual(errors, [], 'console errors while measuring');
    assert.deepEqual(failures, [], 'canvas and Play differ');
});
