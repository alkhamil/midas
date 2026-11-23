// List: its Items box starts with one List Item, the Plus row adds one more, and Separator puts a Divider between two items. The items leave only from
// the Slots section (its minus): the minus takes its Divider with it, and the canvas refuses to delete an item.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { ARTIFACTS, ensureDevServers, openImportedFile, launchBrowser, settle } from './harness.mjs';
import { createFromPanel, isolatedStage } from './parity-helpers.mjs';

test('List starts with one List Item, Plus adds one, Separator puts a Divider between them, and the minus removes an item with its Divider', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page } = await openImportedFile(browser, isolatedStage({ name: 'list.midas' }));

    const id = await createFromPanel(page, 'list');
    await settle(page, 4);
    // The template of each child of the Items box: the List Items, and the Dividers the Separator puts between them.
    const rows = () => page.evaluate(id => {
        const doc = window.midas.doc;
        const box = doc.descendants(id).find(n => n.propBind?.slot === 'items');
        return doc.children(box.id).map(c => doc.get(c.sourceId)?.behavior?.templateId);
    }, id);
    assert.deepEqual(await rows(), ['antd-list-item'], 'a new List starts with one List Item');

    await page.evaluate(id => window.midas.select([id]), id);
    await page.locator('#inspector-tab-behavior').click();
    await page.locator('[data-bp-action="slot-add"]').click();
    await settle(page, 4);
    assert.deepEqual(await rows(), ['antd-list-item', 'antd-list-item'], 'Plus adds a List Item');

    await page.locator('[data-bp-prop="separator"]').first().click({ force: true });
    await settle(page, 6);
    assert.deepEqual(await rows(), ['antd-list-item', 'antd-divider', 'antd-list-item'], 'Separator puts one Divider between each pair');

    await page.locator('[data-bp-action="slot-add"]').click();
    await settle(page, 4);
    assert.deepEqual(await rows(), ['antd-list-item', 'antd-divider', 'antd-list-item', 'antd-divider', 'antd-list-item'], 'the Divider follows the new item');

    // Play: the List with its Dividers, at its own place in the Design System page, for the review.
    await page.evaluate(id => window.midas.select([id]), id);
    await page.locator('#play').click();
    await page.waitForSelector('.play-overlay .play-stage');
    await settle(page, 8);
    const listInPlay = page.locator(`.play-overlay [data-node-id="${id}"]`);
    await listInPlay.scrollIntoViewIfNeeded();
    await settle(page, 4);
    await listInPlay.screenshot({ path: `${ARTIFACTS}/list-play-separator.png` });
    await page.keyboard.press('Escape');
    await settle(page, 4);

    // The minus of the middle item removes it and its Divider: two items, one Divider between them.
    await page.locator('[data-bp-action="slot-remove"]').nth(1).click();
    await settle(page, 4);
    assert.deepEqual(await rows(), ['antd-list-item', 'antd-divider', 'antd-list-item'], 'the minus takes the item and the Divider that follows the rest');

    // The canvas does not delete an item: Delete on a List Item is refused, and the item stays.
    const itemId = await page.evaluate(id => window.midas.doc.children(window.midas.doc.descendants(id).find(n => n.propBind?.slot === 'items').id).find(c => c.sourceId)?.id, id);
    await page.evaluate(itemId => window.midas.select([itemId]), itemId);
    await page.keyboard.press('Delete');
    await settle(page, 4);
    assert.deepEqual(await rows(), ['antd-list-item', 'antd-divider', 'antd-list-item'], 'Delete on the canvas leaves the item');

    await page.evaluate(id => window.midas.select([id]), id);
    await page.locator('#inspector-tab-behavior').click();
    await page.locator('[data-bp-prop="separator"]').first().click({ force: true });
    await settle(page, 6);
    assert.deepEqual(await rows(), ['antd-list-item', 'antd-list-item'], 'Separator off takes the Dividers away');
});
