// The Input in Play is live: typing updates the counter and the box width, and the clear appears while the value is not empty; a real click
// on the clear empties the value, hides the clear again and brings the placeholder back. The canvas stays static throughout: its count
// and label keep the nodes' values. Real keyboard and mouse input on the isolated stage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { ARTIFACTS, ensureDevServers, inkIn, openImportedFile } from './harness.mjs';
import { createFromPanel, isolatedStage, setProp } from './parity-helpers.mjs';

/** Opens Play on the instance (selected), at actual size. Animations run. */
async function openPlay(page, id) {
    await page.evaluate(id => window.midas.select([id]), id);
    await page.locator('#play').click();
    await page.waitForSelector('.play-overlay');
    await page.locator('.play-overlay [aria-label="View options"]').click();
    await page.locator('.play-overlay [data-mode="actual-size"]').click();
    await page.waitForTimeout(400);
}

/** The ink an element shows on the screen: its own screenshot, read in device pixels (the element's box times the device scale). */
async function inkOnScreen(browser, locator, name) {
    const file = resolve(ARTIFACTS, `${name}.png`);
    await locator.screenshot({ path: file });
    const box = await locator.boundingBox();
    return inkIn(browser, file, { x: 0, y: 0, w: Math.round(box.width * 2), h: Math.round(box.height * 2) });
}

/** The Play parts of the input: the input, the clear and the counter, with their text, hidden state and root width. */
const playState = page => page.evaluate(() => {
    const input = document.querySelector('.play-overlay input[data-role="value"]');
    const root = input.parentElement;
    const clear = root.querySelector(':scope > [data-role="clear"]');
    const count = root.querySelector(':scope > [data-role="count"]');
    return {
        value: input.value,
        placeholderShown: input.matches(':placeholder-shown'),
        clearHidden: clear ? clear.hidden : null,
        count: count ? count.textContent : null,
        rootWidth: root.getBoundingClientRect().width,
    };
});

test('the Input in Play follows typing and a click on its clear; the canvas stays as it is', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    const browser = await chromium.launch();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage());
    const id = await createFromPanel(page, 'input');
    await setProp(page, 'allowClear', true);
    await setProp(page, 'showCount', true);
    await setProp(page, 'placeholder', 'Search');
    const countId = await page.evaluate(id => window.midas.doc.children(id).find(c => c.behavior?.part === 'count')?.id, id);
    const canvasCount = () => page.evaluate(countId => window.midas.doc.get(countId).text, countId);
    const canvasBefore = await canvasCount();

    await openPlay(page, id);
    const start = await playState(page);
    assert.equal(start.value, '');
    assert.equal(start.placeholderShown, true, 'the placeholder shows while the value is empty');
    assert.equal(start.clearHidden, true, 'the clear is hidden while the value is empty');
    assert.equal(start.count, '0', 'the counter starts at the length of the empty value');
    // On the screen: the placeholder is drawn in the input, and the hidden clear is not.
    mkdirSync(ARTIFACTS, { recursive: true });
    const input = page.locator('.play-overlay input[data-role="value"]');
    assert.equal(await page.locator('.play-overlay [data-role="clear"]').isVisible(), false, 'no clear is on the screen while the value is empty');
    assert.ok(await inkOnScreen(browser, input, 'play-input-placeholder') > 0, 'the placeholder is drawn on the screen');

    // Real typing: the input takes the focus from a real click on it.
    const box = await input.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.type('Hello');
    await page.waitForTimeout(100);
    const typed = await playState(page);
    assert.equal(typed.value, 'Hello');
    assert.equal(typed.placeholderShown, false, 'the placeholder hides once there is a value');
    assert.equal(typed.clearHidden, false, 'the clear shows while the value is not empty');
    assert.equal(typed.count, '5', 'the counter follows the typed length');
    assert.ok(typed.rootWidth > start.rootWidth, `the box re-hugs the value: ${start.rootWidth} then ${typed.rootWidth}`);
    // On the screen: the value is drawn, the clear and the counter are visible with ink, and the placeholder is gone.
    assert.ok(await inkOnScreen(browser, input, 'play-input-typed') > 0, 'the typed value is drawn on the screen');
    assert.ok(await page.locator('.play-overlay [data-role="clear"]').isVisible(), 'the clear is on the screen');
    assert.ok(await inkOnScreen(browser, page.locator('.play-overlay [data-role="clear"]'), 'play-clear-typed') > 0, 'the clear draws its glyph');
    assert.ok(await inkOnScreen(browser, page.locator('.play-overlay [data-role="count"]'), 'play-count-typed') > 0, 'the counter draws its digits');

    // A real click on the clear empties the value and hides the clear again.
    const clear = page.locator('.play-overlay [data-role="clear"]');
    const clearBox = await clear.boundingBox();
    await page.mouse.click(clearBox.x + clearBox.width / 2, clearBox.y + clearBox.height / 2);
    await page.waitForTimeout(100);
    const cleared = await playState(page);
    assert.equal(cleared.value, '', 'the click empties the value');
    assert.equal(cleared.clearHidden, true, 'the clear hides itself');
    assert.equal(cleared.placeholderShown, true, 'the placeholder comes back');
    assert.equal(cleared.count, '0');
    assert.ok(cleared.rootWidth <= start.rootWidth + 0.5, `the box returns to the placeholder width: ${cleared.rootWidth}`);
    // On the screen: the clear is gone again and the placeholder is drawn once more.
    assert.equal(await page.locator('.play-overlay [data-role="clear"]').isVisible(), false, 'the clear is off the screen once emptied');
    assert.ok(await inkOnScreen(browser, input, 'play-input-cleared') > 0, 'the placeholder is drawn again on the screen');

    assert.equal(await canvasCount(), canvasBefore, 'the canvas counter is not changed by Play');
    assert.deepEqual(errors, [], 'console errors');
});
