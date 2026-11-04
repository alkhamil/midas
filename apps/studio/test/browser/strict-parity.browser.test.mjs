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
import { FIXTURE, PAD, createFromPanel, isolatedStage, measurePair, setProp } from './parity-helpers.mjs';


/** The states each template is measured in, after its Size modes: the props that state sets. */
const STATES = {
    button: [
        { name: 'rest', props: { loading: false } },
        { name: 'loading', props: { loading: true } },
    ],
    // The affix switches come before their texts: a text row is shown only while its switch is on.
    input: [
        { name: 'placeholder', props: { minLength: null, maxLength: null, hasPrefix: false, hasSuffix: false, value: '', allowClear: false, showCount: false } },
        { name: 'value', props: { hasPrefix: false, hasSuffix: false, value: 'Hello', allowClear: false, showCount: false } },
        { name: 'allowClear', props: { hasPrefix: false, hasSuffix: false, value: 'Hello', allowClear: true, showCount: false } },
        { name: 'showCount', props: { hasPrefix: false, hasSuffix: false, value: 'Hello', allowClear: false, showCount: true } },
        { name: 'prefix', props: { hasPrefix: true, prefixText: 'Rp', hasSuffix: false, value: 'Hello', allowClear: false, showCount: false } },
        { name: 'suffix', props: { hasPrefix: false, hasSuffix: true, suffixText: '.com', value: 'Hello', allowClear: false, showCount: false } },
        { name: 'both', props: { hasPrefix: true, prefixText: 'Rp', hasSuffix: true, suffixText: '.com', value: 'Hello', allowClear: true, showCount: true } },
        // The limits come last: the rest state resets them for the next Size. Min 3 and Max 5 with five characters: "5 / 5".
        { name: 'limits', props: { minLength: 3, maxLength: 5, hasPrefix: false, hasSuffix: false, value: 'Hello', allowClear: false, showCount: true } },
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
                const m = await measurePair(page, browser, id, label, pair);
                failures.push(...m.failures);
            if (state.name === 'placeholder' && m.rows.length !== 1) failures.push(`${label}: the empty input draws ${m.rows.length} parts, not the root alone`);
                if (m.rows) report.push({ label, rows: m.rows, unmapped: m.unmapped, diff: m.diff, edges: m.edges });
            }
            // Back to the rest state before the next Size mode, so each mode starts from the same props.
            for (const [name, value] of Object.entries(STATES[templateId][0].props)) await setProp(page, name, value);
        }
    }
    writeFileSync(resolve(ARTIFACTS, 'strict-parity.json'), JSON.stringify(report, null, 2));
    assert.deepEqual(errors, [], 'console errors while measuring');
    assert.deepEqual(failures, [], 'canvas and Play differ');
});
