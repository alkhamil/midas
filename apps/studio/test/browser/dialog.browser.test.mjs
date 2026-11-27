// Dialog on the canvas and in Play: a created Dialog measured at every Size mode and each prop state, within 0.5px (the same comparison as list-item).
// Dialog has no interaction state, so the states are its props: title, close, description and footer on and off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { ARTIFACTS, ensureDevServers, openImportedFile, launchBrowser, settle } from './harness.mjs';
import { createFromPanel, isolatedStage, measurePair, setProp } from './parity-helpers.mjs';

// Play clips the bottom of the frame at the dialog, so the frame gets room below it.
async function frameWithRoom(page, id, room) {
    const frameId = await page.evaluate(id => {
        let n = window.midas.doc.get(id);
        while (n.parentId) n = window.midas.doc.get(n.parentId);
        return n.id;
    }, id);
    await page.evaluate(fid => window.midas.select([fid]), frameId);
    const h = await page.evaluate(fid => window.midas.doc.get(fid).h, frameId);
    await page.evaluate(v => window.midas.setProperty('h', v), h + room);
    await page.locator('[data-inspector-tab="prototype"]').click();
    await page.selectOption('[data-pt-overflow]', 'vertical');
    await settle(page, 4);
    await page.evaluate(id => window.midas.select([id]), id);
}

// Every state names all of its props: a value set in one state stays for the next.
const STATES = [
    { name: 'full', props: { title: 'Dialog title', closable: true, description: true, footer: true } },
    { name: 'no-close', props: { title: 'Dialog title', closable: false, description: true, footer: true } },
    { name: 'no-footer', props: { title: 'Dialog title', closable: true, description: true, footer: false } },
    { name: 'no-description', props: { title: 'Dialog title', closable: true, description: false, footer: true } },
    { name: 'no-title', props: { title: '', closable: true, description: true, footer: true } },
];

test('a created Dialog measures the same on the canvas and in Play at every Size and state, within 0.5px', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage({ name: 'antd-dialog.midas' }));

    const id = await createFromPanel(page, 'antd-dialog');
    await frameWithRoom(page, id, 200);
    const master = await page.evaluate(id => window.midas.doc.get(window.midas.doc.get(id).sourceId), id);
    const sizeColl = master.behavior.variables.size;
    const modes = await page.evaluate(sizeColl => window.midas.doc.data.variables.collections.find(x => x.id === sizeColl).modes, sizeColl);

    const failures = [];
    for (const mode of modes) {
        await page.locator('[data-inspector-tab="design"]').click();
        await page.selectOption(`select[data-var-mode="${sizeColl}"]`, mode.id);
        await page.evaluate(() => document.fonts.ready);
        await settle(page, 6);
        for (const state of STATES) {
            for (const [name, value] of Object.entries(state.props)) await setProp(page, name, value);
            const label = `antd-dialog ${mode.name} ${state.name}`;
            const pair = `pair-antd-dialog-${mode.name.toLowerCase()}-${state.name}`;
            const m = await measurePair(page, browser, id, label, pair, { outline: false, matchBackdrop: true });
            failures.push(...m.failures);
        }
    }
    assert.deepEqual(errors, [], 'console errors while measuring');
    assert.deepEqual(failures, [], 'canvas and Play differ');
});
