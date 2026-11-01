// Selection through the UI path: a real pointer click selects an instance root or an inner layer; the Behavior panel opens for an
// instance root; the selection survives a Size mode change and the layout passes that follow it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ROOT, ensureDevServers, openImportedFile, selectByClick } from './harness.mjs';
import { resolve } from 'node:path';

const TESTING = resolve(ROOT, 'testing.midas');

test('a click selects an instance root, and a click inside it selects the same root', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    const browser = await chromium.launch();
    t.after(() => browser.close());
    const { page } = await openImportedFile(browser, TESTING);
    assert.deepEqual(await selectByClick(page, 'i-value'), ['i-value'], 'the instance root is selected');
    // A click inside an instance selects the instance as a whole; the inner layers are reached by double-click or the layers panel.
    assert.deepEqual(await selectByClick(page, 'i-value-label'), ['i-value'], 'a click on an inner layer selects its instance root');
});

test('the Behavior panel opens for an instance root selected by a click', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    const browser = await chromium.launch();
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
    const browser = await chromium.launch();
    t.after(() => browser.close());
    const { page } = await openImportedFile(browser, TESTING);
    await selectByClick(page, 'i-size-md');
    await page.waitForSelector('select[data-var-mode="c-input-size"]');
    await page.locator('select[data-var-mode="c-input-size"]').selectOption({ index: 0 });
    await page.waitForTimeout(400);
    assert.deepEqual(await page.evaluate(() => [...window.midas.state.selection]), ['i-size-md'], 'still selected after the mode change');
});
