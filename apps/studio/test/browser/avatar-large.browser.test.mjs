// Avatar with a large picture in Play, in Chrome.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { ARTIFACTS, ensureDevServers, openImportedFile } from './harness.mjs';
import { createFromPanel, isolatedStage } from './parity-helpers.mjs';
// A picture over about 2 MB as a data URL: Chrome drops a CSS custom property that large, so Play draws the picture as the root's own background image, not through a variable.
test('Avatar picture: a large image still shows in Play', async t => {
    const stop = await ensureDevServers(); t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await chromium.launch({ channel: 'chrome' }); t.after(() => browser.close());
    const { page } = await openImportedFile(browser, isolatedStage({ name: 'avatar-large.midas' }), { dpr: 1 });
    const id = await createFromPanel(page, 'antd-avatar');
    await page.locator('#inspector-tab-behavior').click();
    const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 1800; c.height = 1000; const g = c.getContext('2d'); g.fillStyle = '#ff0000'; g.fillRect(0, 0, 1800, 1000); const d = g.getImageData(0, 0, 1800, 400); for (let i = 0; i < d.data.length; i += 4) { d.data[i] = Math.random() * 255; d.data[i + 1] = Math.random() * 255; d.data[i + 2] = Math.random() * 255; } g.putImageData(d, 0, 0); return c.toDataURL('image/png').split(',')[1]; });
    assert.ok(png.length > 2.5e6, 'the picture is a data URL over the size a custom property keeps');
    await page.locator('[data-bp-action="segment"][data-bp-prop="content"][data-bp-value="image"]').click();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-bp-action="image-pick"]').click()]);
    await chooser.setFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await page.waitForFunction(id => !!window.midas.doc.get(id)?.fills?.some(f => f.type === 'image'), id, { timeout: 20000 });
    await page.waitForTimeout(800);
    await page.evaluate(id => window.midas.select([id]), id);
    await page.locator('#play').click();
    await page.waitForSelector('.play-overlay');
    await page.waitForTimeout(800);
    const r = await page.evaluate(id => { const el = document.querySelector(`.play-overlay [data-node-id="${id}"]`); const cs = getComputedStyle(el); return { attr: el.hasAttribute('data-src'), var: el.style.getPropertyValue('--antd-avatar-src').length, bg: cs.backgroundImage.slice(0, 30) }; }, id);
    assert.equal(r.attr, true);
    assert.ok(r.bg.startsWith("url("), 'Play draws the large picture');
});
