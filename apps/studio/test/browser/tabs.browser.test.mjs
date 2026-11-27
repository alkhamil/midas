// Tabs in the studio: a new Tabs holds two tabs and selects the first; in Play a click on a tab selects it and deselects the other one.
// Read from the document and the Play DOM, with screenshots of the canvas and of Play.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { ARTIFACTS, ensureDevServers, openImportedFile, launchBrowser, settle } from './harness.mjs';
import { createFromPanel, isolatedStage } from './parity-helpers.mjs';

test('a Tabs starts with its first tab selected, and a click in Play selects another tab and deselects the first', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage({ name: 'tabs.midas' }));
    const id = await createFromPanel(page, 'antd-tabs');
    await page.evaluate(id => window.midas.select([id]), id);
    await settle(page, 4);

    // The tabs of the bar, in order, with their active flag from the document.
    const tabs = () => page.evaluate(id => {
        const inst = window.midas.doc.get(id);
        const box = window.midas.doc.descendants(inst.id).find(n => n.propBind?.slot === 'items');
        const tabMaster = window.midas.doc.data.pages.flatMap(p => p.nodes).find(m => m.component && m.behavior?.templateId === 'antd-tab');
        return window.midas.doc.children(box.id).filter(c => c.sourceId === tabMaster.id).map(c => ({ id: c.id, active: c.behavior?.props?.active === true }));
    }, id);
    const before = await tabs();
    assert.deepEqual(before.map(x => x.active), [true, false], 'the first tab is selected, the second is not');
    // Zoom the canvas onto the Tabs, so the screenshot shows the component.
    await page.evaluate(id => window.midas.fit([id]), id);
    await settle(page, 6);
    await page.screenshot({ path: `${ARTIFACTS}/tabs-canvas.png` });

    // Plus adds a tab at the end, as Breadcrumb's does; the selection stays on the first tab.
    await page.locator('#inspector-tab-behavior').click();
    await page.locator('[data-bp-action="slot-add"][data-bp-slot="items"]').click();
    await settle(page, 4);
    assert.deepEqual((await tabs()).map(x => x.active), [true, false, false], 'Plus adds a tab, and the first one stays selected');
    await page.evaluate(id => window.midas.select([id]), id);
    await settle(page, 2);
    // Play starts at the top-level frame that holds the selection, and the Tabs sits deep in the Design System section: give it a frame of its own.
    await page.evaluate(id => window.midas.transaction('Frame the tabs', () => {
        const doc = window.midas.doc;
        const inst = doc.get(id);
        const frame = doc.add({ id: `tabs-frame-${id}`, type: 'frame', name: 'Tabs', parentId: null, x: 0, y: 0, w: 480, h: 160, fills: [], clip: true, component: false });
        inst.parentId = frame.id;
        inst.x = 40; inst.y = 40;
        doc.touch(inst);
        window.midas.select([frame.id]);
    }), id);
    await settle(page, 6);
    await page.evaluate(id => window.midas.select([id]), id);
    // Play: the tabs are role tab elements; a click on the second one selects it and deselects the first.
    await page.evaluate(id => window.midas.select([id]), id);
    await page.locator('#play').click();
    await page.waitForSelector('.play-overlay [role="tablist"]');
    await settle(page, 6);
    const playState = () => page.evaluate(() => [...document.querySelectorAll('.play-overlay [role="tablist"] [role="tab"]')].map(el => ({ selected: el.getAttribute('aria-selected'), active: el.hasAttribute('data-active') })));
    assert.deepEqual(await playState(), [{ selected: 'true', active: true }, { selected: 'false', active: false }, { selected: 'false', active: false }], 'Play starts with the first tab selected');
    await page.locator('.play-overlay [role="tablist"]').first().screenshot({ path: `${ARTIFACTS}/tabs-play-start.png` });
    await page.locator('.play-overlay [role="tablist"] [role="tab"]').nth(1).dispatchEvent('click');
    await settle(page, 4);
    assert.deepEqual(await playState(), [{ selected: 'false', active: false }, { selected: 'true', active: true }, { selected: 'false', active: false }], 'a click selects the second tab and deselects the first');
    await page.locator('.play-overlay [role="tablist"]').first().screenshot({ path: `${ARTIFACTS}/tabs-play.png` });
    assert.deepEqual(errors, [], 'no page errors');
});
