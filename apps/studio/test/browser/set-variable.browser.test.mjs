// Set variable in Play: a button made in the Prototype panel writes a boolean variable for the session; a second button's conditional opens an
// overlay only once it is written. Before the write the condition does not hold (the document's value is false), after it the overlay opens.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ARTIFACTS, ensureDevServers, openImportedFile, launchBrowser, settle } from './harness.mjs';
import { isolatedStage } from './parity-helpers.mjs';

/** A base frame with two buttons (copies of a new rectangle moved into the frame) and the frame to open. Returns the ids. */
async function buildScene(page) {
    return page.evaluate(() => {
        const doc = window.midas.doc;
        // A boolean variable of the document, with the value the document gives (false).
        doc.data.variables.items = [...(doc.data.variables.items ?? []), { id: 'flag-var', name: 'flag', type: 'boolean', values: {} }];
        const base = window.midas.createAtCenter('frame', { name: 'Base', x: 0, y: 0, w: 480, h: 360 });
        const card = window.midas.createAtCenter('frame', { name: 'Menu', w: 200, h: 120 });
        const rect = window.midas.createAtCenter('rect', { name: 'Button', w: 160, h: 48 });
        const place = (id, y) => {
            const copy = structuredClone(doc.get(rect.id));
            Object.assign(copy, { id, name: id, parentId: base.id, x: 40, y });
            doc.add(copy);
            doc.touch(copy);
            return copy;
        };
        place('set-button', 40);
        place('show-button', 120);
        const paint = (node, color) => { const fills = structuredClone(node.fills); fills[0].color = color; return fills; };
        doc.get(base.id).fills = paint(doc.get(base.id), '#eef1f5');
        doc.touch(doc.get(base.id));
        doc.get(card.id).fills = paint(doc.get(rect.id), '#ffffff');
        doc.touch(doc.get(card.id));
        return { base: base.id, card: card.id, set: 'set-button', show: 'show-button' };
    });
}

test('a conditional opens an overlay only after Set variable has written the variable in Play', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage({ name: 'set-variable.midas' }));
    const ids = await buildScene(page);

    // The Set button: Add interaction, Action Set variable, Variable flag, Value True.
    await page.evaluate(id => window.midas.select([id]), ids.set);
    await page.locator('[data-inspector-tab="prototype"]').click();
    await page.locator('[data-pt-add]').click();
    await page.selectOption('select[data-pt="action"]', 'set-variable');
    await page.selectOption('select[data-pt="variable"]', 'flag-var');
    await page.selectOption('select[data-pt="value"]', 'true');
    await settle(page, 4);

    // The Show button: a conditional on flag, opening the frame when it holds. Written straight into the document (the panel's conditional
    // editor is covered by the unit tests), so the test checks the Play behaviour alone.
    await page.evaluate(ids => {
        const show = window.midas.doc.get(ids.show);
        show.prototype = {
            version: 1,
            interactions: [{ id: 'i-show', trigger: { type: 'on-click' }, action: { type: 'conditional', branches: [{ condition: { variableId: 'flag-var', operator: '==', value: true }, actions: [{ type: 'open-overlay', destinationId: ids.card, placement: 'center', closeOnOutside: true, transition: { type: 'instant', durationMs: 0 } }] }] } }],
        };
        window.midas.doc.touch(show);
    }, ids);
    await settle(page, 4);

    await page.locator('#play').click();
    await page.waitForSelector('.play-overlay');
    await page.locator('.play-overlay [aria-label="View options"]').click();
    await page.locator('.play-overlay [data-mode="actual-size"]').click();
    await settle(page, 6);

    await page.locator(`.play-overlay [data-node-id="${ids.show}"]`).click();
    await settle(page, 6);
    assert.equal(await page.locator('.play-overlay-frame').count(), 0, 'before the write the condition does not hold');

    await page.locator(`.play-overlay [data-node-id="${ids.set}"]`).click();
    await settle(page, 4);
    await page.locator(`.play-overlay [data-node-id="${ids.show}"]`).click();
    await settle(page, 6);
    assert.equal(await page.locator('.play-overlay-frame').count(), 1, 'after the write the condition holds and the overlay opens');
    await page.locator('.play-overlay .play-stage').screenshot({ path: resolve(ARTIFACTS, 'set-variable-play.png') });
    assert.deepEqual(errors, [], 'console errors');
});
