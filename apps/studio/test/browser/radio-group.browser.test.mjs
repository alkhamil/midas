// Radio Group in the studio: two Radios in its options; picking one on the canvas or in Play clears the other (a single value for the group).
// Read from the document and the Play DOM, with screenshots of the canvas and of Play.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { ARTIFACTS, ensureDevServers, openImportedFile, launchBrowser, settle } from './harness.mjs';
import { createFromPanel, isolatedStage, setProp } from './parity-helpers.mjs';

test('Radio Group: picking one Radio clears the other on the canvas and in Play', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage({ name: 'radio-group.midas' }));
    const groupId = await createFromPanel(page, 'antd-radio-group');
    await page.evaluate(id => window.midas.select([id]), groupId);
    await settle(page, 4);

    // Two Radios into the options frame, from the Radio master of the Design System page.
    const [first, second] = await page.evaluate(groupId => {
        const doc = window.midas.doc;
        const master = doc.data.pages.flatMap(p => p.nodes).find(n => n.component && n.behavior?.templateId === 'radio');
        const box = doc.descendants(groupId).find(n => n.propBind?.slot === 'items');
        [0, 1].forEach(() => window.midas.instantiate(master.id, null, box));
        return doc.children(box.id).filter(c => c.sourceId === master.id).map(c => c.id);
    }, groupId);
    await settle(page, 6);

    // The checked flag of each Radio in the options frame, in order.
    const checked = () => page.evaluate(groupId => {
        const doc = window.midas.doc;
        const box = doc.descendants(groupId).find(n => n.propBind?.slot === 'items');
        const radioMaster = doc.data.pages.flatMap(p => p.nodes).find(n => n.component && n.behavior?.templateId === 'radio');
        return doc.children(box.id).filter(c => c.sourceId === radioMaster.id).map(c => c.behavior?.props?.checked === true);
    }, groupId);

    // On the canvas: checking the second Radio unchecks the first.
    await page.evaluate(id => window.midas.select([id]), first);
    await page.locator('#inspector-tab-behavior').click();
    await setProp(page, 'checked', true);
    await settle(page, 4);
    assert.deepEqual(await checked(), [true, false], 'the first Radio is checked');
    await page.evaluate(id => window.midas.select([id]), second);
    await setProp(page, 'checked', true);
    await settle(page, 4);
    assert.deepEqual(await checked(), [false, true], 'checking the second Radio clears the first');
    await page.evaluate(groupId => window.midas.fit([groupId]), groupId);
    await settle(page, 6);
    await page.screenshot({ path: `${ARTIFACTS}/radio-group-canvas.png` });

    // Play starts at the top-level frame that holds the selection: give the group a frame of its own, as the Tabs test does.
    await page.evaluate(id => window.midas.transaction('Frame the radio group', () => {
        const doc = window.midas.doc;
        const inst = doc.get(id);
        const frame = doc.add({ id: `radio-frame-${id}`, type: 'frame', name: 'Radio Group', parentId: null, x: 0, y: 0, w: 480, h: 200, fills: [], clip: true, component: false });
        inst.parentId = frame.id;
        inst.x = 40; inst.y = 40;
        doc.touch(inst);
    }), groupId);
    await settle(page, 6);
    // In Play: the group's options are radio roles; a click on the first one checks it and clears the second.
    await page.evaluate(id => window.midas.select([id]), groupId);
    await page.locator('#play').click();
    await page.waitForSelector('.play-overlay [role="radiogroup"]');
    await settle(page, 6);
    const playState = () => page.evaluate(() => [...document.querySelectorAll('.play-overlay [role="radiogroup"] [role="radio"]')].map(el => el.getAttribute('aria-checked')));
    assert.deepEqual(await playState(), ['false', 'true'], 'Play starts with the canvas value');
    await page.locator('.play-overlay [role="radiogroup"] [role="radio"]').first().dispatchEvent('click');
    await settle(page, 4);
    assert.deepEqual(await playState(), ['true', 'false'], 'a click checks the first Radio and clears the second');
    await page.locator('.play-overlay [role="radiogroup"]').first().screenshot({ path: `${ARTIFACTS}/radio-group-play.png` });
    assert.deepEqual(errors, [], 'no page errors');
});
