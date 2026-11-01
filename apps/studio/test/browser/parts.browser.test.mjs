// The part generator through the UI: "Create Input" and "Create Button" in the Components panel build a master and an instance; the
// parts are nodes; the Behavior panel toggles show and hide them on the canvas and in Play. Every step is a real click
// (selectByClick for layers, the panel's own controls for props). Writes screenshots to .artifacts/.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { ARTIFACTS, ROOT, ensureDevServers, openImportedFile, shotNode } from './harness.mjs';

const TESTING = resolve(ROOT, 'testing.midas');

/** Creates a template component from the Components panel, and waits for its instance to be selected. */
async function createFromPanel(page, templateId) {
    await page.getByRole('button', { name: 'Components' }).first().click();
    await page.waitForTimeout(300);
    await page.locator(`[data-create-template="${templateId}"]`).click();
    await page.waitForFunction(() => window.midas.state.selection.size === 1, null, { timeout: 5000 });
    return page.evaluate(() => [...window.midas.state.selection][0]);
}

/** The layers of a node: name, and the part or slot it stands for. */
const layersOf = (page, id) => page.evaluate(id => window.midas.doc.children(id).map(c => `${c.name}${c.behavior?.part ? `:part` : c.behavior?.slot ? `:slot` : ''}`), id);

test('Create Input: the placeholder, clear and count parts are nodes, and their toggles hide and show them', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await chromium.launch();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, TESTING);
    const id = await createFromPanel(page, 'input');
    const names = (await layersOf(page, id)).map(s => s.split(':')[0]);
    for (const part of ['label', 'placeholder', 'clear', 'count']) assert.ok(names.includes(part), `${part} is a node of the new Input`);

    // The Behavior panel: Allow Clear and Show Count are its toggles.
    await page.getByRole('button', { name: 'Behavior' }).filter({ visible: true }).first().click();
    await page.waitForTimeout(300);
    const clearToggle = page.locator('input[aria-label="allowClear"]').first();
    assert.equal(await page.evaluate(id => window.midas.doc.get(id).behavior.props.allowClear === true, id), false, 'Allow Clear starts off');
    await shotNode(page, id, 'parts-input-before');
    await clearToggle.check({ force: true });
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(id => window.midas.doc.get(id).behavior.props.allowClear, id), true, 'Allow Clear is on after the click');
    await page.screenshot({ path: resolve(ARTIFACTS, 'parts-input-panel.png') });
    assert.deepEqual(errors.filter(e => !/500/.test(e)), [], 'no console errors except the libraries endpoint');
});

test('Create Button: the spinner part is a node and Loading shows it through the panel', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    const browser = await chromium.launch();
    t.after(() => browser.close());
    const { page } = await openImportedFile(browser, TESTING);
    const id = await createFromPanel(page, 'button');
    const names = (await layersOf(page, id)).map(s => s.split(':')[0]);
    assert.ok(names.includes('spinner'), 'the spinner is a node of the new Button');
    await page.getByRole('button', { name: 'Behavior' }).filter({ visible: true }).first().click();
    await page.waitForTimeout(300);
    const loading = page.locator('input[aria-label="loading"]').first();
    await loading.check({ force: true });
    await page.waitForTimeout(300);
    const spinnerVisible = await page.evaluate(id => window.midas.doc.children(id).find(c => c.behavior?.part === 'spinner')?.visible, id);
    assert.equal(spinnerVisible, true, 'Loading shows the spinner');
    await shotNode(page, id, 'parts-button-loading');
});
