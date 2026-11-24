// Breadcrumb in the studio: a new one holds two Link items and the separator between them; Plus adds one item and one separator; Truncated keeps
// the first and last item on the canvas and makes an ellipsis in place of the hidden ones. Read from the document, with a screenshot of the canvas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { ARTIFACTS, ensureDevServers, openImportedFile, launchBrowser, settle } from './harness.mjs';
import { createFromPanel, isolatedStage, setProp } from './parity-helpers.mjs';

test('a Breadcrumb starts with two links and a separator, Plus adds one of each, and Truncated hides the middle behind an ellipsis', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage({ name: 'breadcrumb.midas' }));
    const id = await createFromPanel(page, 'antd-breadcrumb');
    await page.evaluate(id => window.midas.select([id]), id);
    // The row's children, as { kind, visible } in order: links are instances of the Link master, the rest is the separator and the ellipsis.
    const row = () => page.evaluate(id => {
        const inst = window.midas.doc.get(id);
        const box = window.midas.doc.descendants(inst.id).find(n => n.propBind?.slot === 'items');
        const linkMaster = window.midas.doc.data.pages.flatMap(p => p.nodes).find(m => m.component && m.behavior?.templateId === 'antd-breadcrumb-item');
        return window.midas.doc.children(box.id).map(c => ({ link: c.sourceId === linkMaster.id, visible: c.visible !== false, text: c.text ?? null, slot: c.behavior?.slot ?? null }));
    }, id);
    const shape = r => r.map(x => (x.link ? (x.visible ? 'link' : 'hidden-link') : `${x.slot}:${x.text}`));
    // The current flag of each link, in order: only the last one is active.
    const actives = () => page.evaluate(id => {
        const inst = window.midas.doc.get(id);
        const box = window.midas.doc.descendants(inst.id).find(n => n.propBind?.slot === 'items');
        const linkMaster = window.midas.doc.data.pages.flatMap(p => p.nodes).find(m => m.component && m.behavior?.templateId === 'antd-breadcrumb-item');
        return window.midas.doc.children(box.id).filter(c => c.sourceId === linkMaster.id).map(c => c.behavior?.props?.active === true);
    }, id);

    assert.deepEqual(shape(await row()), ['link', 'separator:/', 'link'], 'two links and the separator between them');
    assert.deepEqual(await actives(), [false, true], 'the last link is the active one');

    await page.locator('#inspector-tab-behavior').click();
    await page.locator('[data-bp-action="slot-add"][data-bp-slot="items"]').click();
    await settle(page, 4);
    assert.deepEqual(shape(await row()), ['link', 'separator:/', 'link', 'separator:/', 'link'], 'Plus adds one item and one separator');
    assert.deepEqual(await actives(), [false, false, true], 'the active one moves to the new last link');

    await setProp(page, 'truncated', true);
    await settle(page, 4);
    const truncated = shape(await row());
    assert.deepEqual(truncated, ['link', 'separator:/', 'ellipsis:…', 'hidden-link', 'separator:/', 'link'], 'the ellipsis takes the place of the hidden link, and the last separator stays');
    assert.equal(truncated.filter(x => x === 'link').length, 2, 'the first and last links show');
    assert.ok(truncated.includes('ellipsis:…'), 'an ellipsis stands in place of the hidden links');
    assert.ok(truncated.includes('hidden-link'), 'the hidden link is kept in the document');

    // Play draws the truncated row: no "Cannot draw this frame" badge, the ellipsis, and the separators that stand before it and before the last link.
    await page.evaluate(id => window.midas.select([id]), id);
    await page.locator('#play').click();
    await page.waitForSelector('.play-overlay .antd-breadcrumb-ellipsis');
    const badge = await page.evaluate(() => { const b = document.querySelector('.play-overlay .play-badge'); return { hidden: b.hidden, text: b.textContent }; });
    assert.equal(badge.hidden, true, `Play draws the frame (${badge.text})`);
    assert.equal(await page.locator('.play-overlay .antd-breadcrumb-ellipsis').count(), 1, 'Play shows the ellipsis');
    assert.equal(await page.locator('.play-overlay .antd-breadcrumb-separator').count(), 2, 'Play shows the separators');
    // The row is a list: an ol whose li are the links, the separators and the ellipsis (five in this state), and each link is an anchor.
    assert.equal(await page.locator('.play-overlay ol > li').count(), 5, 'Play draws the row as a list');
    assert.deepEqual(await page.locator('.play-overlay .antd-breadcrumb-item').evaluateAll(els => els.map(el => el.tagName)), ['A', 'A', 'A'], 'each link is an anchor, the hidden one too');
    // Only the inactive link takes the pointer on hover; the active one (the last) keeps the arrow.
    await page.locator('.play-overlay .antd-breadcrumb-item').first().hover();
    assert.equal(await page.locator('.play-overlay .antd-breadcrumb-item').first().evaluate(el => getComputedStyle(el).cursor), 'pointer', 'an inactive link takes the pointer on hover');
    await page.locator('.play-overlay .antd-breadcrumb-item').last().hover();
    assert.notEqual(await page.locator('.play-overlay .antd-breadcrumb-item').last().evaluate(el => getComputedStyle(el).cursor), 'pointer', 'the active link keeps the arrow');
    await page.locator(`.play-overlay [data-node-id="${id}"]`).screenshot({ path: `${ARTIFACTS}/breadcrumb-truncated-play.png` });
    await page.locator('[aria-label="Close (Esc)"]').click();
    await page.waitForSelector('.play-overlay', { state: 'detached' });

    await page.evaluate(id => window.midas.select([id]), id);
    await settle(page, 4);
    const shot = `${ARTIFACTS}/breadcrumb-truncated.png`;
    await page.screenshot({ path: shot });
    assert.deepEqual(errors, [], 'console errors');
});
