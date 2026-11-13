// The part generator through the UI: "Create Input" and "Create Button" in the Components panel build a master and an instance. Each part
// is checked on the screen: its box on the canvas, and the ink its screenshot shows inside that box, for every state the panel sets.
// Every step is a real click (the panel's own controls for props). Writes screenshots to .artifacts/.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ARTIFACTS, ROOT, ensureDevServers, inkIn, openImportedFile, shotNode, launchBrowser } from './harness.mjs';
import { PAD, canvasTree, createFromPanel, setProp } from './parity-helpers.mjs';

const TESTING = resolve(ROOT, 'testing.midas');

/** A layer's canvas rectangle in device pixels of its pair screenshot (zoom 1, the crop starts PAD CSS pixels outside the root). */
const onShot = layer => ({ x: (PAD + layer.box.x) * 2, y: (PAD + layer.box.y) * 2, w: layer.box.w * 2, h: layer.box.h * 2 });

/** A layer of the instance as the canvas has it now (shown or hidden), by name. */
const layerNamed = (page, id, name) => canvasTree(page, id).then(all => all.find(n => n.name === name));

/** Shoots the instance at zoom 1 and returns the ink of each named layer's box in that shot (its shown state is read from the canvas). */
async function inkOf(page, browser, id, shot, names) {
    const file = await shotNode(page, id, shot, PAD, 1);
    const all = await canvasTree(page, id);
    const out = {};
    for (const name of names) {
        const layer = all.find(n => n.name === name);
        out[name] = { shown: !!layer && layer.shown, ink: layer && layer.shown ? await inkIn(browser, file.file, onShot(layer)) : 0 };
    }
    return out;
}

test('Create Input: the clear and the count show on the screen only when their props say so, and the placeholder when the value is empty', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, TESTING);
    const id = await createFromPanel(page, 'input');
    await setProp(page, 'placeholder', 'Search');
    // Empty value, no Allow Clear, no Show Count: the placeholder is the only thing drawn.
    let state = await inkOf(page, browser, id, 'parts-input-empty', ['placeholder', 'clear', 'count']);
    assert.equal(state.clear.shown, false, 'the clear is hidden with no value and Allow Clear off');
    assert.equal(state.count.shown, false, 'the count is hidden with Show Count off');
    assert.equal(state.clear.ink, 0, 'no clear is drawn');
    assert.equal(state.count.ink, 0, 'no count is drawn');
    assert.ok(state.placeholder.shown && state.placeholder.ink > 0, 'the placeholder is drawn while the value is empty');

    // A value, Allow Clear and Show Count on: the value replaces the placeholder, and the clear and the count are drawn.
    await setProp(page, 'value', 'Hi');
    await setProp(page, 'allowClear', true);
    await setProp(page, 'showCount', true);
    state = await inkOf(page, browser, id, 'parts-input-value', ['placeholder', 'value', 'clear', 'count']);
    assert.equal(state.placeholder.shown, false, 'the placeholder is hidden once there is a value');
    assert.ok(state.value.shown && state.value.ink > 0, 'the value is drawn');
    assert.ok(state.clear.shown && state.clear.ink > 0, 'the clear is drawn with a value and Allow Clear on');
    assert.ok(state.count.shown && state.count.ink > 0, 'the count is drawn with Show Count on');
    await page.screenshot({ path: resolve(ARTIFACTS, 'parts-input-panel.png') });
    assert.deepEqual(errors.filter(e => !/500/.test(e)), [], 'no console errors except the libraries endpoint');
});

test('Create Button: Loading draws the spinner on the screen; the plain Button draws nothing where the spinner would be', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page } = await openImportedFile(browser, TESTING);
    const id = await createFromPanel(page, 'button');
    let state = await inkOf(page, browser, id, 'parts-button-plain', ['spinner', 'label']);
    assert.equal(state.spinner.shown, false, 'the spinner is hidden while not loading');
    assert.equal(state.spinner.ink, 0, 'nothing is drawn where the spinner would be');
    assert.ok(state.label.ink > 0, 'the label is drawn');

    await setProp(page, 'loading', true);
    state = await inkOf(page, browser, id, 'parts-button-loading', ['spinner', 'label']);
    assert.equal(state.spinner.shown, true, 'Loading shows the spinner');
    assert.ok(state.spinner.ink > 0, 'the spinner draws ink in its box');
    assert.ok(state.label.ink > 0, 'the label is still drawn after the spinner');
    const spinner = await layerNamed(page, id, 'spinner');
    const label = await layerNamed(page, id, 'label');
    assert.ok(label.box.x >= spinner.box.x + spinner.box.w, 'the spinner sits before the label, without covering it');
});
