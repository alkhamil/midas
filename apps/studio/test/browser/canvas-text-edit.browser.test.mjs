// A text edit made on the canvas through the real editor (select the text layer, Enter, type, leave the editor) shows the same text in the node, in the instance's prop,
// in the Behavior tab and in Play. One generic rule for every template with managed text, checked here on each kind of text part.
// Run: npm run test:browser --workspace @midas/studio (this file alone: node --test test/browser/canvas-text-edit.browser.test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { ARTIFACTS, ensureDevServers, openImportedFile } from './harness.mjs';
import { createFromPanel, isolatedStage, setProp } from './parity-helpers.mjs';

// [template, props to set first, text part (a slot or a canvas part), prop that stores it, how Play shows it]
const CASES = [
    ['antd-text', {}, { slot: 'label' }, 'label', 'text'],
    ['antd-title', {}, { slot: 'label' }, 'label', 'text'],
    ['checkbox', {}, { slot: 'label' }, 'label', 'text'],
    ['radio', {}, { slot: 'label' }, 'label', 'text'],
    ['antd-avatar', { content: 'text' }, { slot: 'label' }, 'label', 'text'],
    ['antd-tag', {}, { slot: 'label' }, 'label', 'text'],
    ['button', {}, { slot: 'label' }, 'label', 'text'],
    ['input', {}, { part: 'placeholder' }, 'placeholder', 'input-placeholder'],
    ['input', { value: 'seed' }, { slot: 'value' }, 'value', 'input-value'],
];

/** The text layer of the instance a template's part maps to: the first text layer that is not a part or an affix for the primary label, else the slot or part by marker. */
const layerOf = (page, instanceId, part) => page.evaluate(({ instanceId, part }) => {
    const { doc } = window.midas;
    const below = doc.descendants(instanceId).filter(c => c.type === 'text');
    // The label of a template with no managed layer (Button) is its first text layer that is not a part or an affix.
    const found = part.slot
        ? below.find(c => c.behavior?.slot === part.slot) ?? (part.slot === 'label' ? below.find(c => !c.behavior?.part && !c.behavior?.text) : undefined)
        : below.find(c => c.behavior?.part === part.part);
    return found?.id ?? null;
}, { instanceId, part });

/** Edits the text of a layer as a designer does: select it, Enter opens the editor with everything selected, type, and leave the editor. */
async function editOnCanvas(page, layerId, text) {
    await page.evaluate(id => window.midas.select([id]), layerId);
    await page.locator('#canvas, canvas').first().focus().catch(() => {});
    await page.keyboard.press('Enter');
    await page.waitForFunction(id => window.midas.state.editing === id, layerId, { timeout: 5000 });
    // Inserted as text, not typed key by key: a contenteditable gains a line break when typed over a selection.
    await page.keyboard.insertText(text);
    await page.evaluate(() => document.getElementById('text-editor').blur());
    await page.waitForFunction(() => window.midas.state.editing == null, null, { timeout: 5000 });
    await page.waitForTimeout(500);
}

const playShows = (page, instanceId, how) => page.evaluate(({ instanceId, how }) => {
    const root = document.querySelector('.play-overlay').querySelector(`[data-node-id="${instanceId}"]`);
    if (!root) return null;
    if (how === 'input-value') return root.querySelector('input, textarea')?.value ?? null;
    if (how === 'input-placeholder') return root.querySelector('input, textarea')?.getAttribute('placeholder') ?? null;
    return root.textContent;
}, { instanceId, how });

test('a canvas text edit shows the same text in the prop, the Behavior tab and Play, for every kind of text part', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await chromium.launch({ channel: 'chrome' });
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage({ name: 'canvas-text-edit.midas' }), { dpr: 1 });
    const failures = [];
    for (const [templateId, props, part, prop, how] of CASES) {
        const label = `${templateId}.${prop}`;
        try {
            const id = await createFromPanel(page, templateId);
            for (const [name, value] of Object.entries(props)) {
                if (name === 'content') {
                    await page.locator('#inspector-tab-behavior').click();
                    await page.locator(`[data-bp-action="segment"][data-bp-prop="content"][data-bp-value="${value}"]`).click();
                    await page.waitForTimeout(250);
                }
                else await setProp(page, name, value);
            }
            await page.waitForTimeout(300);
            const layerId = await layerOf(page, id, part);
            assert.ok(layerId, `${label}: the instance holds the text layer`);
            const edited = `Edited ${templateId} ${prop}`.slice(0, 40);
            await editOnCanvas(page, layerId, edited);
            const state = await page.evaluate(({ id, layerId, prop }) => ({ text: window.midas.doc.get(layerId)?.text, stored: window.midas.doc.get(id).behavior.props[prop] }), { id, layerId, prop });
            assert.equal(state.text, edited, `${label}: the canvas layer holds the edit (got ${JSON.stringify(state)})`);
            assert.equal(state.stored, edited, `${label}: the prop that stores it holds the edit`);
            // The Behavior tab shows it.
            await page.evaluate(id => window.midas.select([id]), id);
            await page.locator('#inspector-tab-behavior').click();
            const field = page.locator(`[data-bp-prop="${prop}"]`).first();
            assert.equal(await field.inputValue(), edited, `${label}: the Behavior tab shows the edit`);
            // Play shows it.
            await page.locator('#play').click();
            await page.waitForSelector('.play-overlay');
            await page.waitForTimeout(500);
            const shown = await playShows(page, id, how);
            assert.ok(shown !== null && String(shown).includes(edited), `${label}: Play shows the edit (got ${JSON.stringify(shown)})`);
            await page.keyboard.press('Escape');
            await page.waitForSelector('.play-overlay', { state: 'detached', timeout: 5000 }).catch(() => {});
        }
        catch (e) {
            failures.push(`${label}: ${e.message.split('\n')[0]}`);
            await page.keyboard.press('Escape').catch(() => {});
        }
    }
    assert.deepEqual(failures, []);
    assert.deepEqual(errors.filter(e => !/503|WebSocket/.test(e)), [], 'no console errors');
});
