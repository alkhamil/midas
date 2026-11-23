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

    assert.deepEqual(shape(await row()), ['link', 'separator:/', 'link'], 'two links and the separator between them');

    await page.locator('#inspector-tab-behavior').click();
    await page.locator('[data-bp-action="slot-add"][data-bp-slot="items"]').click();
    await settle(page, 4);
    assert.deepEqual(shape(await row()), ['link', 'separator:/', 'link', 'separator:/', 'link'], 'Plus adds one item and one separator');

    await setProp(page, 'truncated', true);
    await settle(page, 4);
    const truncated = shape(await row());
    assert.deepEqual(truncated, ['link', 'separator:/', 'ellipsis:…', 'hidden-link', 'separator:/', 'link'], 'the ellipsis takes the place of the hidden link, and the last separator stays');
    assert.equal(truncated.filter(x => x === 'link').length, 2, 'the first and last links show');
    assert.ok(truncated.includes('ellipsis:…'), 'an ellipsis stands in place of the hidden links');
    assert.ok(truncated.includes('hidden-link'), 'the hidden link is kept in the document');

    await page.evaluate(id => window.midas.select([id]), id);
    await settle(page, 4);
    const shot = `${ARTIFACTS}/breadcrumb-truncated.png`;
    await page.screenshot({ path: shot });
    assert.deepEqual(errors, [], 'console errors');
});
