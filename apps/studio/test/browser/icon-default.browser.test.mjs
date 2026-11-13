// The default icon, through the UI path. Create Button, switch Has Icon on: with the icon library in the file, the start slot holds the
// library's Icon/check component and draws ink in its box; the canvas and Play keep the gate's geometry. Without any Icon/ component, the
// slot keeps its box, draws nothing, and the Behavior panel reports the empty slot. The exported slot's box is checked by the export test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ARTIFACTS, ensureDevServers, inkIn, openImportedFile, launchBrowser } from './harness.mjs';
import { PAD, canvasTree, createFromPanel, isolatedStage, measurePair, setProp } from './parity-helpers.mjs';

/** The canvas rectangle of a layer, in device pixels of the pair screenshot (the crop starts PAD CSS pixels outside the root). */
const pairRect = (layer, dsf = 2) => ({ x: (PAD + layer.box.x) * dsf, y: (PAD + layer.box.y) * dsf, w: layer.box.w * dsf, h: layer.box.h * dsf });

test('Has Icon on with the library: the slot holds the library icon, draws ink in its box, and the canvas and Play keep the gate', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage({ icons: true, name: 'icon-default-stage.midas' }));
    const id = await createFromPanel(page, 'button');
    await setProp(page, 'hasIcon', true);
    const slot = await page.evaluate(id => window.midas.doc.children(id).find(c => c.behavior?.slot === 'iconStart'), id);
    assert.ok(slot, 'the start slot exists');
    const icon = await page.evaluate(slotId => window.midas.doc.children(slotId).map(c => c.name), slot.id);
    assert.deepEqual(icon, ['Icon/check'], 'the slot holds the library icon');

    const m = await measurePair(page, browser, id, 'button with the library icon', 'pair-icon-default-start');
    assert.deepEqual(m.failures, [], 'the canvas and Play keep the gate');
    const canvas = await canvasTree(page, id);
    const layer = canvas.find(n => n.name === 'iconStart');
    assert.ok(layer && layer.shown, 'the start slot is on the canvas');
    const ink = await inkIn(browser, resolve(ARTIFACTS, 'pair-icon-default-start-canvas.png'), pairRect(layer));
    assert.ok(ink > 0, `the icon draws ink in its box (${ink} pixels)`);
    assert.deepEqual(errors, [], 'console errors');
});

test('Has Icon on with no Icon/ component in the file: the slot keeps its box, draws nothing, and the warning shows', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page } = await openImportedFile(browser, isolatedStage({ icons: false, name: 'icon-empty-stage.midas' }));
    const id = await createFromPanel(page, 'button');
    await setProp(page, 'hasIcon', true);
    const m = await measurePair(page, browser, id, 'button with an empty icon slot', 'pair-icon-empty-start');
    assert.deepEqual(m.failures, [], 'the canvas and Play keep the gate');
    const canvas = await canvasTree(page, id);
    const layer = canvas.find(n => n.name === 'iconStart');
    assert.ok(layer && layer.shown, 'the empty start slot is on the canvas');
    assert.equal(layer.box.w, 14, 'the slot keeps its box (the icon size)');
    const ink = await inkIn(browser, resolve(ARTIFACTS, 'pair-icon-empty-start-canvas.png'), pairRect(layer));
    assert.equal(ink, 0, 'an empty slot draws nothing');
    await page.getByText(/icon slot is empty/).first().waitFor({ state: 'visible', timeout: 5000 });
});
