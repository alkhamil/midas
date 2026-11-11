// Avatar with a picture, on the canvas and in Play, in Chrome. The image content is chosen through the Behavior tab's file row (an asset of the file), then the canvas and Play
// are shot at 1:1: both draw the picture in the box (its colour at the centre), and Play carries the data attribute and the custom property the stylesheet reads.
// Screenshots go to .artifacts/avatar-image-{canvas,play,panel}.png.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { ARTIFACTS, ensureDevServers, openImportedFile, shotNode } from './harness.mjs';
import { PAD, createFromPanel, isolatedStage, playTree } from './parity-helpers.mjs';

/** The pixel at the centre of a screenshot, as [r, g, b]. */
async function centreOf(browser, file) {
    const page = await browser.newPage();
    try {
        return await page.evaluate(async src => {
            const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
            const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
            const g = c.getContext('2d'); g.drawImage(img, 0, 0);
            return [...g.getImageData(Math.floor(img.width / 2), Math.floor(img.height / 2), 1, 1).data].slice(0, 3);
        }, 'data:image/png;base64,' + readFileSync(file).toString('base64'));
    } finally { await page.close(); }
}

const isRed = ([r, g, b]) => r > 200 && g < 60 && b < 60;

test('Avatar picture: the canvas and Play draw the chosen image in the box', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await chromium.launch({ channel: 'chrome' });
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage({ name: 'avatar.midas' }), { dpr: 1 });
    const id = await createFromPanel(page, 'antd-avatar');
    await page.locator('#inspector-tab-behavior').click();
    // A red square, made in the page: the picture the user would upload.
    const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#ff0000'; g.fillRect(0, 0, 64, 64); return c.toDataURL('image/png').split(',')[1]; });
    await page.locator('[data-bp-action="segment"][data-bp-prop="content"][data-bp-value="image"]').click();
    await page.waitForTimeout(250);
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-bp-action="image-pick"]').click()]);
    await chooser.setFiles({ name: 'red.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await page.waitForFunction(id => !!window.midas.doc.get(id)?.fills?.some(f => f.type === 'image'), id, { timeout: 10000 });
    await page.waitForTimeout(500);
    // The instance holds the picture as an image fill over a hidden colour fill, with no text or icon layer.
    const fills = await page.evaluate(id => window.midas.doc.get(id).fills.map(f => ({ type: f.type, visible: f.visible })), id);
    assert.deepEqual(fills.map(f => f.type), ['solid', 'image']);
    assert.equal(fills[0].visible, false, 'the colour does not show under the picture');
    await page.locator('#inspector').screenshot({ path: `${ARTIFACTS}/avatar-image-panel.png` });
    await page.evaluate(() => window.midas.select([]));
    const canvas = await shotNode(page, id, 'avatar-image-canvas', PAD, 1);
    assert.ok(isRed(await centreOf(browser, canvas.file)), 'the canvas draws the picture');
    const play = await playTree(page, id, 'avatar-image');
    assert.ok(play, 'Play draws the Avatar');
    assert.ok(isRed(await centreOf(browser, `${ARTIFACTS}/avatar-image-play.png`)), 'Play draws the picture');
    // Replace from the Design tab (the Fill panel): the prop takes the new asset, so the picture survives a sync (a change of Size runs one).
    const blue = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#0000ff'; g.fillRect(0, 0, 64, 64); return c.toDataURL('image/png').split(',')[1]; });
    await page.evaluate(id => window.midas.select([id]), id);
    await page.locator('[data-inspector-tab="design"]').click();
    await page.locator('.fr-sw.img[data-fill-open="1"]').click();
    const [fillChooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-fill-image-pick]').first().click()]);
    await fillChooser.setFiles({ name: 'blue.png', mimeType: 'image/png', buffer: Buffer.from(blue, 'base64') });
    await page.waitForTimeout(600);
    const picture = () => page.evaluate(id => { const n = window.midas.doc.get(id); return { prop: n.behavior.props.src, fill: n.fills.find(f => f.type === 'image')?.image }; }, id);
    const replaced = await picture();
    assert.ok(replaced.prop && replaced.prop === replaced.fill, 'the prop holds the new asset and the fill shows it');
    await page.locator('#inspector-tab-behavior').click();
    await page.locator('[data-bp-prop="size"]').first().selectOption({ label: 'lg' });
    await page.waitForTimeout(500);
    assert.deepEqual(await picture(), replaced, 'the replaced picture survives a sync');
    await page.evaluate(() => window.midas.select([]));
    const after = await shotNode(page, id, 'avatar-image-replaced-canvas', PAD, 1);
    const [r, g, b] = await centreOf(browser, after.file);
    assert.ok(b > 200 && r < 60 && g < 60, 'the canvas draws the new picture');
    // The eye on the picture's fill is the designer's: it stays off through a sync (the prop owns the asset only), and on again when turned back on.
    const shown = () => page.evaluate(id => window.midas.doc.get(id).fills.find(f => f.type === 'image').visible !== false, id);
    await page.evaluate(id => window.midas.select([id]), id);
    await page.locator('[data-inspector-tab="design"]').click();
    await page.locator('[data-fill-toggle="1"]').click();
    await page.locator('#inspector-tab-behavior').click();
    await page.locator('[data-bp-prop="size"]').first().selectOption({ label: 'md' });
    await page.waitForTimeout(500);
    assert.equal(await shown(), false, 'the hidden picture stays hidden after a sync');
    await page.locator('[data-inspector-tab="design"]').click();
    await page.locator('[data-fill-toggle="1"]').click();
    assert.equal(await shown(), true);
    // Remove from the Design tab (the minus on the picture's fill): the prop clears, the picture goes and the colour shows again, and a sync keeps it that way.
    await page.evaluate(id => window.midas.select([id]), id);
    await page.locator('[data-inspector-tab="design"]').click();
    await page.locator('[data-fill-remove="1"]').click();
    await page.waitForTimeout(600);
    const removed = () => page.evaluate(id => { const n = window.midas.doc.get(id); return { prop: n.behavior.props.src ?? null, fills: n.fills.map(f => [f.type, f.visible !== false]) }; }, id);
    assert.deepEqual(await removed(), { prop: null, fills: [['solid', true]] });
    await page.locator('#inspector-tab-behavior').click();
    await page.locator('[data-bp-prop="size"]').first().selectOption({ label: 'md' });
    await page.waitForTimeout(500);
    assert.deepEqual(await removed(), { prop: null, fills: [['solid', true]] }, 'the picture does not come back after a sync');
    assert.deepEqual(errors, [], 'no console error');
});
