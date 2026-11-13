// The Stroke settings popover on plain nodes: Join and Miter angle show for every
// node type while Solid; choosing Dashed in the Style menu writes dash, keeps the
// popover open and shows Dash, Gap and Cap; Solid hides them again.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureDevServers, openImportedFile, ARTIFACTS, launchBrowser } from './harness.mjs';
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
    const browser = await launchBrowser();
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

async function chooseStyle(page, label) {
    await page.locator('.stp select[data-stp="strokeStyle"]').click();
    await page.waitForSelector('.sel-menu');
    await page.locator(`.sel-menu button:has-text("${label}")`).click();
    await page.waitForTimeout(400);
}

const settingsRows = page => page.evaluate(() => [...document.querySelectorAll('.stp:not(.sel-menu) .stp-row > span')].map(s => s.textContent));

test('choosing Dashed in the Style menu writes dash, keeps the popover open and shows Dash, Gap and Cap', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage({ icons: false, name: 'stroke-popover-dash.midas' }));
    const ids = await page.evaluate(() => {
        const e = window.midas.createAtCenter('ellipse', { name: 'Circle', w: 120, h: 120 });
        const r = window.midas.createAtCenter('rect', { name: 'Rectangle', w: 160, h: 100 });
        return { ellipse: e.id, rect: r.id };
    });
    for (const [kind, id] of [['ellipse', ids.ellipse], ['rect', ids.rect]]) {
        await openPopover(page, id);
        await chooseStyle(page, 'Dashed');
        assert.equal(await page.locator('.stp:not(.sel-menu)').count(), 1, `${kind}: the popover stays open after choosing Dashed`);
        const node = await page.evaluate(id => {
            const n = window.midas.doc.get(id);
            return { style: n.strokeStyle, hasGap: 'strokeGap' in n, join: n.strokeJoin };
        }, id);
        assert.equal(node.style, 'dash', `${kind}: Dashed writes dash`);
        assert.equal(node.hasGap, false, `${kind}: no gap key, so Gap follows Dash`);
        const rows = await settingsRows(page);
        for (const name of ['Style', 'Dash', 'Gap', 'Cap', 'Join', 'Miter angle']) assert.ok(rows.includes(name), `${kind}: ${name} shows while Dashed (has ${rows})`);
        await chooseStyle(page, 'Solid');
        assert.equal(await page.evaluate(id => window.midas.doc.get(id).strokeStyle, id), 'solid', `${kind}: Solid writes solid`);
        const back = await settingsRows(page);
        assert.deepEqual(back, ['Style', 'Join', 'Miter angle'], `${kind}: Solid hides Dash, Gap and Cap (has ${back})`);
    }
    assert.deepEqual(errors, [], 'console errors');
});
