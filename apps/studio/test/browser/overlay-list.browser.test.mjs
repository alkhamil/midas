// An interaction with two actions, made in the Prototype panel as a designer does it: Add interaction, Add action, then the first action is Back
// and the second is Open overlay. The panel shows one block per action in order, and Play runs both: the Back does nothing on the first frame,
// and the overlay still opens.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ARTIFACTS, ensureDevServers, openImportedFile, launchBrowser, settle } from './harness.mjs';
import { isolatedStage } from './parity-helpers.mjs';

async function buildScene(page) {
    return page.evaluate(() => {
        const doc = window.midas.doc;
        const base = window.midas.createAtCenter('frame', { name: 'Base', x: 0, y: 0, w: 480, h: 360 });
        const card = window.midas.createAtCenter('frame', { name: 'Menu', w: 200, h: 120 });
        const rect = window.midas.createAtCenter('rect', { name: 'Button', w: 160, h: 48 });
        const button = structuredClone(doc.get(rect.id));
        Object.assign(button, { id: 'two-actions-button', name: 'Button', parentId: base.id, x: 40, y: 40 });
        doc.add(button);
        doc.touch(button);
        const paint = (node, color) => { const fills = structuredClone(node.fills); fills[0].color = color; return fills; };
        doc.get(base.id).fills = paint(doc.get(base.id), '#eef1f5');
        doc.touch(doc.get(base.id));
        doc.get(card.id).fills = paint(doc.get(rect.id), '#ffffff');
        doc.touch(doc.get(card.id));
        window.midas.select([button.id]);
        return { base: base.id, card: card.id, button: button.id };
    });
}

test('an interaction with two actions: the panel shows both in order, and Play runs both', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage({ name: 'overlay-list.midas' }));
    const ids = await buildScene(page);

    await page.locator('[data-inspector-tab="prototype"]').click();
    await page.locator('[data-pt-add]').click();
    await settle(page, 4);
    await page.locator('[data-pt="action"]').first().selectOption('back');
    await page.locator('button[data-pt-op="action-append"]').first().click();
    await settle(page, 4);
    assert.equal(await page.locator('[data-pt-action-row]').count(), 2, 'two action blocks, one per action');
    await page.locator('[data-pt-action-row="1"] select[data-pt="action"]').selectOption('open-overlay');
    await page.locator('[data-pt-action-row="1"] select[data-pt="destination"]').selectOption(ids.card);
    await settle(page, 4);

    await page.locator('#play').click();
    await page.waitForSelector('.play-overlay');
    await page.locator('.play-overlay [aria-label="View options"]').click();
    await page.locator('.play-overlay [data-mode="actual-size"]').click();
    await settle(page, 6);
    await page.locator(`.play-overlay [data-node-id="${ids.button}"]`).click();
    await settle(page, 6);
    assert.equal(await page.locator('.play-overlay-frame').count(), 1, 'the second action opens the overlay');
    await page.locator('.play-overlay .play-stage').screenshot({ path: resolve(ARTIFACTS, 'overlay-list-play.png') });
    assert.deepEqual(errors, [], 'console errors');
});
