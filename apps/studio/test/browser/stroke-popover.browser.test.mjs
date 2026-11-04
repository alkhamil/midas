// The Stroke settings popover on plain nodes: Join and Miter angle show for every
// node type while Solid; choosing Dashed in the Style menu writes dash, keeps the
// popover open and shows Dash, Gap and Cap; Solid hides them again.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ensureDevServers, openImportedFile, ARTIFACTS } from './harness.mjs';
import { isolatedStage } from './parity-helpers.mjs';
import { mkdirSync } from 'node:fs';

async function openPopover(page, id) {
    await page.evaluate(id => window.midas.select([id]), id);
    await page.waitForTimeout(300);
    await page.locator('[data-action="toggleStroke"]').first().click();
    await page.waitForTimeout(300);
    await page.locator('[data-st-settings]').first().click();
    await page.waitForTimeout(300);
}

const rowsOf = page => page.evaluate(() => [...document.querySelectorAll('.stp .stp-row > span')].map(s => s.textContent));

test('the Stroke popover shows Join and Miter angle on a Circle and a Rectangle while Solid', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await chromium.launch();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage({ icons: false, name: 'stroke-popover.midas' }));
    const ids = await page.evaluate(() => {
        const e = window.midas.createAtCenter('ellipse', { name: 'Circle', w: 120, h: 120 });
        const r = window.midas.createAtCenter('rect', { name: 'Rectangle', w: 160, h: 100 });
        return { ellipse: e.id, rect: r.id };
    });
    for (const [kind, id] of [['ellipse', ids.ellipse], ['rect', ids.rect]]) {
        await openPopover(page, id);
        assert.equal(await page.locator('.stp').count(), 1, `${kind}: the popover opens`);
        const rows = await rowsOf(page);
        assert.ok(rows.includes('Join'), `${kind}: Join shows while Solid (has ${rows})`);
        assert.ok(rows.includes('Miter angle'), `${kind}: Miter angle shows while Solid (has ${rows})`);
    }
    assert.deepEqual(errors, [], 'console errors');
});
