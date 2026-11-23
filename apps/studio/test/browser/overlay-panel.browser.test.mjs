// An overlay made in the Prototype panel, as a designer does it: Add interaction, Action Open overlay, Frame, Placement, then Play. The button
// opens the overlay below it; a second overlay action (Close overlay) on the overlay's own button closes it. The screenshot goes to .artifacts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ARTIFACTS, ensureDevServers, openImportedFile, launchBrowser, settle } from './harness.mjs';
import { isolatedStage } from './parity-helpers.mjs';

/** A base frame with a button (a layer of the frame, copied from a new rectangle) and a second frame to open, with a layer in it. */
async function buildScene(page) {
    return page.evaluate(() => {
        const doc = window.midas.doc;
        const base = window.midas.createAtCenter('frame', { name: 'Base', x: 0, y: 0, w: 480, h: 360 });
        const card = window.midas.createAtCenter('frame', { name: 'Menu', w: 200, h: 120 });
        const rect = window.midas.createAtCenter('rect', { name: 'Open menu', w: 160, h: 48 });
        const button = structuredClone(doc.get(rect.id));
        Object.assign(button, { id: 'open-menu-button', name: 'Open menu', parentId: base.id, x: 40, y: 40 });
        doc.add(button);
        doc.touch(button);
        const menu = window.midas.createAtCenter('rect', { name: 'Close', w: 180, h: 40 });
        const close = structuredClone(doc.get(menu.id));
        Object.assign(close, { id: 'close-button', name: 'Close', parentId: card.id, x: 10, y: 10 });
        doc.add(close);
        doc.touch(close);
        const paint = (node, color) => { const fills = structuredClone(node.fills); fills[0].color = color; return fills; };
        doc.get(base.id).fills = paint(doc.get(base.id), '#eef1f5');
        doc.touch(doc.get(base.id));
        doc.get(card.id).fills = paint(doc.get(rect.id), '#ffffff');
        doc.get(card.id).radius = 12;
        doc.touch(doc.get(card.id));
        window.midas.select([button.id]);
        return { base: base.id, card: card.id, button: button.id, close: close.id };
    });
}

test('an overlay made in the Prototype panel opens below its button in Play and closes from its own Close button', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage({ name: 'overlay-panel.midas' }));
    const ids = await buildScene(page);

    // The button's interaction, through the panel: Add interaction, then Open overlay to the Menu frame, placed below the button.
    await page.locator('[data-inspector-tab="prototype"]').click();
    await page.locator('[data-pt-add]').click();
    await page.selectOption('select[data-pt="action"]', 'open-overlay');
    await page.selectOption('select[data-pt="destination"]', ids.card);
    await page.selectOption('select[data-pt="placement"]', 'below');
    await settle(page, 4);

    // The Close button of the overlay: a second button in the Menu frame, with Close overlay on click.
    await page.evaluate(id => window.midas.select([id]), ids.close);
    await page.locator('[data-inspector-tab="prototype"]').click();
    await page.locator('[data-pt-add]').click();
    await page.selectOption('select[data-pt="action"]', 'close-overlay');
    await settle(page, 4);
    await page.evaluate(id => window.midas.select([id]), ids.button);

    await page.locator('#play').click();
    await page.waitForSelector('.play-overlay');
    await page.locator('.play-overlay [aria-label="View options"]').click();
    await page.locator('.play-overlay [data-mode="actual-size"]').click();
    await settle(page, 6);

    await page.locator(`.play-overlay [data-node-id="${ids.button}"]`).click();
    await settle(page, 6);
    assert.equal(await page.locator('.play-overlay-frame').count(), 1, 'the panel\'s overlay opens');
    await page.locator('.play-overlay .play-stage').screenshot({ path: resolve(ARTIFACTS, 'overlay-panel-play.png') });

    await page.locator(`.play-overlay-frame [data-node-id="${ids.close}"]`).click();
    await settle(page, 4);
    assert.equal(await page.locator('.play-overlay-frame').count(), 0, 'Close overlay closes it');
    assert.deepEqual(errors, [], 'console errors');
});
