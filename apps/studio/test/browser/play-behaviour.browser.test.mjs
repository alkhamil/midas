// Play-only behaviour of a Button: the spinner turns while it is loading (the canvas draws it at rest), and a click on a loading Button
// fires nothing (no wave, no interaction). A Button that is not loading gets the wave on the same click, which is the control. Real
// clicks and real animation timing; the components are made on the isolated stage from the Components panel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureDevServers, openImportedFile, launchBrowser } from './harness.mjs';
import { createFromPanel, isolatedStage, setProp } from './parity-helpers.mjs';

/** Opens Play on the instance (selected), at actual size. Animations are left running. */
async function openPlay(page, id) {
    await page.evaluate(id => window.midas.select([id]), id);
    await page.locator('#play').click();
    await page.waitForSelector('.play-overlay');
    await page.locator('.play-overlay [aria-label="View options"]').click();
    await page.locator('.play-overlay [data-mode="actual-size"]').click();
    await page.waitForTimeout(400);
}

/** The Play element of the instance's spinner, found by its node id (the canvas node named spinner). */
const spinnerId = (page, id) => page.evaluate(id => window.midas.doc.children(id).find(c => c.behavior?.part === 'spinner')?.id, id);

test('a loading Button spins in Play: the spinner rotates over time', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage());
    const id = await createFromPanel(page, 'button');
    await setProp(page, 'loading', true);
    await openPlay(page, id);
    const spinner = page.locator(`.play-overlay [data-node-id="${await spinnerId(page, id)}"]`);
    const a = await spinner.evaluate(el => getComputedStyle(el).transform);
    await page.waitForTimeout(350);
    const b = await spinner.evaluate(el => getComputedStyle(el).transform);
    assert.notEqual(a, b, `the spinner turns: ${a} then ${b}`);
    await page.locator('[aria-label="Close (Esc)"]').click();
    await page.waitForSelector('.play-overlay', { state: 'detached' });
    assert.deepEqual(errors, [], 'console errors');
});

test('a click on a loading Button fires nothing; the same click on a Button that is not loading starts its wave', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page } = await openImportedFile(browser, isolatedStage());
    const id = await createFromPanel(page, 'button');
    const clickInPlay = async () => {
        await openPlay(page, id);
        const button = page.locator(`.play-overlay [data-node-id="${id}"]`);
        const box = await button.boundingBox();
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(150);
        const waved = await button.evaluate(el => el.hasAttribute('data-wave-on'));
        await page.locator('[aria-label="Close (Esc)"]').click();
        await page.waitForSelector('.play-overlay', { state: 'detached' });
        return waved;
    };
    await setProp(page, 'loading', true);
    assert.equal(await clickInPlay(), false, 'a loading Button starts no wave on a click');
    await setProp(page, 'loading', false);
    assert.equal(await clickInPlay(), true, 'a Button that is not loading starts its wave on the same click (the control)');
});
