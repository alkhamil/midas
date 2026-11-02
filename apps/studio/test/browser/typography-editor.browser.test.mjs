// The typography editor is the Design panel's font controls: the family opens the Design panel's font picker and a pick writes the
// style's family, and the editor draws no preview of its text. Writes a screenshot of the editor to .artifacts/.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { ARTIFACTS, ROOT, ensureDevServers, openImportedFile } from './harness.mjs';
import { resolve } from 'node:path';

const TESTING = resolve(ROOT, 'testing.midas');

test('the editor shows the Design panel font controls, no preview, and its family picker writes the style family', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await chromium.launch();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, TESTING);
    await page.getByRole('button', { name: 'Variables' }).first().click();
    await page.locator('[data-vw-create-toggle]').click();
    await page.locator('[data-vw-create="typography"]').click();
    await page.locator('.vw-typo').first().click();
    await page.waitForSelector('.te-pop');
    assert.equal(await page.locator('.te-pop .te-preview').count(), 0, 'no preview of the text in the editor');
    assert.equal(await page.locator('.te-pop [data-te-font-picker]').count(), 1, 'the family is the Design panel font button');
    assert.equal(await page.locator('.te-pop datalist').count(), 0, 'no typed family list: the picker replaces it');
    await page.locator('.te-pop [data-te-font-picker]').click();
    await page.waitForSelector('.font-pop');
    await page.locator('.font-pop [data-font="Roboto"]').first().click();
    await page.waitForTimeout(300);
    assert.match(await page.locator('.vw-typo').first().textContent(), /^Roboto/, 'the picked family is the style family');
    await page.locator('.te-pop').screenshot({ path: resolve(ARTIFACTS, 'typography-editor.png') });
    assert.deepEqual(errors, [], 'console errors');
});
