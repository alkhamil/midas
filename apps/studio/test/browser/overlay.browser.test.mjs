// An overlay in Play: a button in the base frame opens another top-level frame on top of it, below the button. A click on the overlay keeps it open;
// a click on the empty stage outside it closes it. The screenshot is written to .artifacts for the review.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ARTIFACTS, ensureDevServers, openImportedFile, launchBrowser, settle } from './harness.mjs';
import { isolatedStage } from './parity-helpers.mjs';

/** Builds the scene: a base frame with a button that opens an overlay frame below it. Returns the ids. */
async function buildScene(page) {
    return page.evaluate(() => {
        const doc = window.midas.doc;
        const base = window.midas.createAtCenter('frame', { name: 'Base', x: 0, y: 0, w: 480, h: 360 });
        const card = window.midas.createAtCenter('frame', { name: 'Menu', w: 200, h: 120 });
        // The button is a layer of the base frame: a copy of a new rectangle, moved inside the frame.
        const rect = window.midas.createAtCenter('rect', { name: 'Open menu', w: 160, h: 48 });
        const button = structuredClone(doc.get(rect.id));
        button.id = 'open-menu-button';
        button.name = 'Open menu';
        button.parentId = base.id;
        button.x = 40;
        button.y = 40;
        button.prototype = {
            version: 1,
            interactions: [{ id: 'i-open', trigger: { type: 'on-click' }, action: { type: 'open-overlay', destinationId: card.id, placement: 'below', closeOnOutside: true, transition: { type: 'instant', durationMs: 0 } } }],
        };
        doc.add(button);
        doc.touch(button);
        // The overlay frame is a top-level frame of its own; its contents are a rectangle, so it has ink.
        const menuLayer = window.midas.createAtCenter('rect', { name: 'Menu item', w: 180, h: 40 });
        const item = structuredClone(doc.get(menuLayer.id));
        item.id = 'menu-item';
        item.parentId = card.id;
        item.x = 10;
        item.y = 10;
        doc.add(item);
        doc.touch(item);
        // Colour the frames so the overlay reads on the stage: the base in light grey, the overlay in white with a corner radius.
        const paint = (node, color) => { const fills = structuredClone(node.fills); fills[0].color = color; return fills; };
        doc.get(base.id).fills = paint(doc.get(base.id), '#eef1f5');
        doc.touch(doc.get(base.id));
        doc.get(card.id).fills = paint(doc.get(rect.id), '#ffffff');
        doc.get(card.id).radius = 12;
        doc.touch(doc.get(card.id));
        window.midas.select([base.id]);
        return { base: base.id, card: card.id, button: button.id, item: item.id };
    });
}

test('an overlay opens below its button in Play, stays on a click inside it, and closes on a click outside it', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage({ name: 'overlay.midas' }));
    const ids = await buildScene(page);
    await page.locator('#play').click();
    await page.waitForSelector('.play-overlay');
    await page.locator('.play-overlay [aria-label="View options"]').click();
    await page.locator('.play-overlay [data-mode="actual-size"]').click();
    await settle(page, 6);

    assert.equal(await page.locator('.play-overlay-frame').count(), 0, 'no overlay before the click');
    await page.locator(`.play-overlay [data-node-id="${ids.button}"]`).click();
    await settle(page, 6);
    assert.equal(await page.locator('.play-overlay-frame').count(), 1, 'the click opens the overlay');
    const shot = resolve(ARTIFACTS, 'overlay-play.png');
    await page.locator('.play-overlay .play-stage').screenshot({ path: shot });

    await page.locator(`.play-overlay-frame [data-node-id="${ids.item}"]`).click();
    await settle(page, 4);
    assert.equal(await page.locator('.play-overlay-frame').count(), 1, 'a click on the overlay keeps it open');

    // The empty stage at the bottom right of the base frame is no layer: a click there is outside the overlay.
    const stage = await page.locator('.play-overlay .play-stage').boundingBox();
    await page.mouse.click(stage.x + stage.width - 20, stage.y + stage.height - 20);
    await settle(page, 4);
    assert.equal(await page.locator('.play-overlay-frame').count(), 0, 'a click outside closes it');
    assert.deepEqual(errors, [], 'console errors');
});
