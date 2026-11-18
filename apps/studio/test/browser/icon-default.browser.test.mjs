// The default icon, through the UI path. Create Button, switch Has Icon on: with the icon library in the file, the start slot holds the
// library's Icon/check component and draws ink in its box; the canvas and Play keep the gate's geometry. With the icon set that Generate
// Design System creates, the slot holds a generated Icon/ component and draws ink too. An empty icon slot is not reachable through this
// path after Generate (it creates the icons), so it is covered by the unit tests (icon-slot-empty in Diagnostics). The exported slot's box
// is checked by the export test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ARTIFACTS, ensureDevServers, inkIn, openImportedFile, launchBrowser, shotNode } from './harness.mjs';
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

test('Has Icon on after Generate Design System, with no Icon/ component in the fixture: the slot holds the generated default icon and draws ink', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await launchBrowser();
    t.after(() => browser.close());
    // createFromPanel runs Generate Design System, which creates the icon set (Icon/circle among them): the file's default icon is generated, not the fixture's.
    const { page, errors } = await openImportedFile(browser, isolatedStage({ icons: false, name: 'icon-generated-stage.midas' }));
    const id = await createFromPanel(page, 'button');
    await setProp(page, 'hasIcon', true);
    const slot = await page.evaluate(id => window.midas.doc.children(id).find(c => c.behavior?.slot === 'iconStart'), id);
    assert.ok(slot, 'the start slot exists');
    const icon = await page.evaluate(slotId => window.midas.doc.children(slotId).map(c => c.name), slot.id);
    assert.equal(icon.length, 1, 'the slot holds one icon');
    assert.match(icon[0], /^Icon\//, 'the icon is a component of the icon set');

    const canvas = await canvasTree(page, id);
    const layer = canvas.find(n => n.name === 'iconStart');
    assert.ok(layer && layer.shown, 'the start slot is on the canvas');
    const shot = await shotNode(page, id, 'pair-icon-generated-start-canvas', PAD, 1);
    const ink = await inkIn(browser, shot.file, pairRect(layer));
    assert.ok(ink > 0, `the generated icon draws ink in its box (${ink} pixels)`);
    assert.deepEqual(errors, [], 'console errors');
});
