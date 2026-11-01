// The Button's icon and loading states, canvas against Play, at every Size mode: no icon, a start icon, an end icon, loading, and a
// start icon with loading (the spinner takes the start icon's place). Each pair passes the same gate as the strict test: every layer's
// box within 0.5px, the outline on each side within 0.5px, the root width within 0.1px. Writes .artifacts/icon-states.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { ARTIFACTS, ensureDevServers, openImportedFile } from './harness.mjs';
import { createFromPanel, isolatedStage, measurePair, setProp } from './parity-helpers.mjs';

const STATES = [
    { name: 'plain', props: { hasIcon: false, iconPlacement: 'start', loading: false } },
    { name: 'loading', props: { hasIcon: false, iconPlacement: 'start', loading: true } },
    { name: 'icon-start', props: { hasIcon: true, iconPlacement: 'start', loading: false } },
    { name: 'icon-start-loading', props: { hasIcon: true, iconPlacement: 'start', loading: true } },
    { name: 'icon-end', props: { hasIcon: true, iconPlacement: 'end', loading: false } },
];

test('a Button with and without an icon, and loading, measures the same on the canvas and in Play at every Size', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await chromium.launch();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage());
    const id = await createFromPanel(page, 'button');
    const master = await page.evaluate(id => window.midas.doc.get(window.midas.doc.get(id).sourceId), id);
    const sizeColl = master.behavior.variables.size;
    const modes = await page.evaluate(sizeColl => window.midas.doc.data.variables.collections.find(c => c.id === sizeColl).modes, sizeColl);
    const report = [];
    const failures = [];
    for (const mode of modes) {
        await page.locator('[data-inspector-tab="design"]').click();
        await page.selectOption(`select[data-var-mode="${sizeColl}"]`, mode.id);
        await page.waitForTimeout(200);
        for (const state of STATES) {
            await page.locator('#inspector-tab-behavior').click();
            for (const [name, value] of Object.entries(state.props)) {
                if (name === 'iconPlacement') continue;
                await setProp(page, name, value);
            }
            await page.locator('[data-bp-prop="iconPlacement"]').first().selectOption(state.props.iconPlacement).catch(() => {});
            const label = `button ${mode.name} ${state.name}`;
            const pair = `pair-icon-${mode.name.toLowerCase()}-${state.name}`;
            const m = await measurePair(page, browser, id, label, pair);
            failures.push(...m.failures);
            if (m.rows) report.push({ label, rows: m.rows, unmapped: m.unmapped, diff: m.diff, edges: m.edges });
        }
        // Back to the plain state before the next Size, so each Size starts alike.
        await page.locator('#inspector-tab-behavior').click();
        await setProp(page, 'hasIcon', false);
        await setProp(page, 'loading', false);
    }
    writeFileSync(resolve(ARTIFACTS, 'icon-states.json'), JSON.stringify(report, null, 2));
    assert.deepEqual(errors, [], 'console errors');
    assert.deepEqual(failures, [], 'canvas and Play differ');
});
