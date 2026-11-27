// Tabs on the canvas and in Play: a created Tabs (two tabs, the first selected) measured at every Size mode, within 0.5px (the same comparison as list-item).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { ARTIFACTS, ensureDevServers, openImportedFile, launchBrowser, settle } from './harness.mjs';
import { createFromPanel, isolatedStage, measurePair } from './parity-helpers.mjs';

// Play clips the bottom of the frame at the tabs, so the frame gets room below it.
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

test('a created Tabs measures the same on the canvas and in Play at every Size, within 0.5px', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage({ name: 'antd-tabs-parity.midas' }));

    const id = await createFromPanel(page, 'antd-tabs');
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
        const label = `antd-tabs ${mode.name}`;
        const pair = `pair-antd-tabs-${mode.name.toLowerCase()}`;
        const m = await measurePair(page, browser, id, label, pair, { outline: false, matchBackdrop: true });
        failures.push(...m.failures);
    }
    assert.deepEqual(errors, [], 'console errors while measuring');
    assert.deepEqual(failures, [], 'canvas and Play differ');
});
