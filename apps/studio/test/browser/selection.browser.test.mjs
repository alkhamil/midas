// Selection through the UI path: a real pointer click selects an instance root or an inner layer; the Behavior panel opens for an
// instance root; the selection survives a Size mode change and the layout passes that follow it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ARTIFACTS, ROOT, ensureDevServers, inkIn, openImportedFile, selectByClick, launchBrowser } from './harness.mjs';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const TESTING = resolve(ROOT, 'testing.midas');

/** The ink the canvas shows on the screen: its element's screenshot, read in device pixels. A selected layer draws its outline in ink. */
async function canvasInk(page, browser, name) {
    mkdirSync(ARTIFACTS, { recursive: true });
    const file = resolve(ARTIFACTS, `${name}.png`);
    await page.locator('#scene').screenshot({ path: file });
    const box = await page.locator('#scene').boundingBox();
    return inkIn(browser, file, { x: 0, y: 0, w: Math.round(box.width * 2), h: Math.round(box.height * 2) });
}

test('a click selects an instance root, and a click inside it selects the same root', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page } = await openImportedFile(browser, TESTING);
    await page.mouse.move(2, 2);
    const before = await canvasInk(page, browser, 'selection-before');
    assert.deepEqual(await selectByClick(page, 'i-value'), ['i-value'], 'the instance root is selected');
    // On the screen: the selected instance draws its outline, so the canvas shows more ink than before the click.
    await page.mouse.move(2, 2);
    const after = await canvasInk(page, browser, 'selection-after');
    assert.ok(after > before, `the selection outline is drawn (${before} ink before, ${after} after)`);
    // A click inside an instance selects the instance as a whole; the inner layers are reached by double-click or the layers panel.
    assert.deepEqual(await selectByClick(page, 'i-value-label'), ['i-value'], 'a click on an inner layer selects its instance root');
});

test('the Behavior panel opens for an instance root selected by a click', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page } = await openImportedFile(browser, TESTING);
    await selectByClick(page, 'i-value');
    await page.getByRole('button', { name: 'Behavior' }).filter({ visible: true }).first().click();
    await page.waitForTimeout(300);
    assert.ok(await page.getByText('Allow Clear').first().isVisible(), 'the Allow Clear toggle is shown');
});

test('the selection survives a Size mode change and the layout after it', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page } = await openImportedFile(browser, TESTING);
    await selectByClick(page, 'i-size-md');
    await page.waitForSelector('select[data-var-mode="c-input-size"]');
    await page.mouse.move(2, 2);
    const before = await canvasInk(page, browser, 'selection-size-before');
    await page.locator('select[data-var-mode="c-input-size"]').selectOption({ index: 0 });
    await page.waitForTimeout(400);
    // On the screen: the Size mode changes the drawn text, so the canvas shows different ink.
    await page.mouse.move(2, 2);
    assert.notEqual(await canvasInk(page, browser, 'selection-size-after'), before, 'the canvas redraws at the new Size');
    assert.deepEqual(await page.evaluate(() => [...window.midas.state.selection]), ['i-size-md'], 'still selected after the mode change');
});
