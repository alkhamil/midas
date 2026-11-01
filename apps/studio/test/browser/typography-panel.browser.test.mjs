// Typography editing in the studio: the editor window changes a member and the Variables chip follows; a style attached to two
// text nodes resolves in each node's own Size mode, switching the mode updates the canvas and Play, detaching keeps the resolved
// values, and each step is one undo step. Writes screenshots to .artifacts/.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { ARTIFACTS, ROOT, ensureDevServers, inkIn, openImportedFile, shotNode } from './harness.mjs';

const TESTING = resolve(ROOT, 'testing.midas');
const MATRIX = resolve(ROOT, 'scripts/fixtures/typography-matrix.midas');

const fieldSize = (page, id) => page.evaluate(id => window.midas.doc.get(id).fontSize, id);

/** The ink a canvas layer shows on the screen: its own screenshot at the canvas scale, read in device pixels. */
async function layerInk(page, browser, id, name) {
    const shot = await shotNode(page, id, name, 0);
    return inkIn(browser, shot.file, { x: 0, y: 0, w: Math.round(shot.rect.w * 2), h: Math.round(shot.rect.h * 2) });
}

test('the editor window changes a member, the chip follows, and a ratio line height is refused', async t => {
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
    await page.locator('.te-pop [data-te-member="fontSize"]').fill('18');
    await page.locator('.te-pop [data-te-member="fontSize"]').press('Enter');
    await page.waitForTimeout(200);
    assert.match(await page.locator('.vw-typo').first().textContent(), /^Inter 18\/20 · Regular/);
    await page.locator('.te-pop [data-te-member="lineHeight"]').fill('1.5');
    await page.locator('.te-pop [data-te-member="lineHeight"]').press('Enter');
    await page.waitForTimeout(150);
    assert.match(await page.locator('.te-pop .te-err').textContent(), /is a ratio/);
    assert.match(await page.locator('.vw-typo').first().textContent(), /20 · Regular/, 'the refused value is not written');
    await page.screenshot({ path: resolve(ARTIFACTS, 'typo-editor-window.png') });
    await page.keyboard.press('Escape');
    await page.waitForSelector('.te-pop', { state: 'detached' });
    assert.deepEqual(errors, [], 'console errors while editing');
});

test('a style attached to two text nodes resolves per Size mode; switching the mode updates canvas and Play; detach keeps values', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    const browser = await chromium.launch();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, MATRIX);

    // Two plain text layers with nothing attached: plain-a is in the xs mode, plain-b in the lg mode.
    await page.evaluate(() => window.midas.select(['plain-a', 'plain-b']));
    await page.waitForSelector('[data-typo-open]');
    assert.match(await page.locator('.typo-row').textContent(), /None/);
    await page.locator('[data-typo-open]').click();
    await page.locator('.var-picker .vp-item[title="labelTypography"]').click();
    await page.waitForTimeout(300);
    assert.equal(await fieldSize(page, 'plain-a'), 10, 'xs resolves to textXs (10px)');
    const inkXs = await layerInk(page, browser, 'plain-a', 'typo-plain-a-xs');
    assert.ok(inkXs > 0, 'the xs text is drawn on the screen');
    assert.equal(await fieldSize(page, 'plain-b'), 16, 'lg resolves to textLg (16px)');
    assert.match(await page.locator('.typo-row').textContent(), /labelTypography/);
    assert.equal(await page.locator('.typo-ro').count(), 1, 'the fields are read-only while attached');
    await page.screenshot({ path: resolve(ARTIFACTS, 'typo-attached-panel.png') });

    // Switch plain-a to Medium: its label follows its own mode (md is 14px); plain-b keeps lg.
    await page.evaluate(() => window.midas.select(['plain-a']));
    await page.waitForSelector('select[data-var-mode="c-size"]');
    await page.locator('select[data-var-mode="c-size"]').selectOption('md');
    await page.waitForTimeout(300);
    assert.equal(await fieldSize(page, 'plain-a'), 14, 'the Medium mode resolves to 14px');
    // On the screen: the larger size draws more ink in the same layer.
    const inkMd = await layerInk(page, browser, 'plain-a', 'typo-plain-a-md');
    assert.ok(inkMd > inkXs, `the Medium text draws more ink on the screen (${inkXs} at xs, ${inkMd} at md)`);
    assert.equal(await fieldSize(page, 'plain-b'), 16, 'the other node keeps its own mode');
    await shotNode(page, 'm-frame', 'typo-attached-canvas');

    // Play shows the same size as the canvas for the switched layer.
    await page.evaluate(() => window.midas.select(['m-frame']));
    await page.locator('#play').click();
    await page.waitForSelector('.play-overlay');
    await page.waitForTimeout(800);
    const playSize = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.play-overlay [data-node-id="plain-a"]')).fontSize));
    assert.equal(playSize, 14, 'Play draws 14px');
    await page.screenshot({ path: resolve(ARTIFACTS, 'typo-play-after-mode-switch.png') });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Detach: the resolved values stay as literals; the fields are editable again.
    await page.evaluate(() => window.midas.select(['plain-a']));
    await page.waitForSelector('[data-typo-detach]');
    const boundId = await page.evaluate(() => window.midas.doc.get('plain-a').vars.typography);
    await page.locator('[data-typo-detach]').click();
    await page.waitForTimeout(200);
    assert.equal(await page.locator('.typo-ro').count(), 0, 'the fields are editable after detach');
    assert.equal(await fieldSize(page, 'plain-a'), 14, 'the resolved size stays as a literal');
    assert.equal(await page.evaluate(() => window.midas.doc.get('plain-a').vars?.typography ?? null), null, 'the binding is gone');

    // One undo step restores the attached style.
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => window.midas.doc.get('plain-a').vars?.typography ?? null), boundId, 'undo restores the binding');
    assert.deepEqual(errors, [], 'console errors while editing');
});
