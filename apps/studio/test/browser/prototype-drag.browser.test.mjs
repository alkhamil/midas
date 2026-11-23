// Reordering actions by drag in the Prototype panel: the grip of an action dropped on the lower half of another action moves it there, one
// history step. The order of the other actions is kept.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { ARTIFACTS, ensureDevServers, openImportedFile, launchBrowser, settle } from './harness.mjs';
import { isolatedStage } from './parity-helpers.mjs';

test('dragging an action onto the lower half of another moves it there', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page } = await openImportedFile(browser, isolatedStage({ name: 'prototype-drag.midas' }));

    const id = await page.evaluate(() => {
        const doc = window.midas.doc;
        const button = window.midas.createAtCenter('rect', { name: 'Button', w: 160, h: 48 });
        const open = url => ({ type: 'open-link', url, transition: { type: 'instant', durationMs: 0 } });
        doc.get(button.id).prototype = { version: 2, interactions: [{ id: 'i-click', trigger: { type: 'on-click' }, actions: [open('a'), open('b'), open('c')] }] };
        doc.touch(doc.get(button.id));
        window.midas.select([button.id]);
        return button.id;
    });
    await settle(page, 4);
    await page.locator('[data-inspector-tab="prototype"]').click();
    await settle(page, 2);

    const urls = () => page.evaluate(id => window.midas.doc.get(id).prototype.interactions[0].actions.map(a => a.url), id);
    await page.locator('.pt-action[data-pt-action-row="0"] .pt-grip').dragTo(page.locator('.pt-action[data-pt-action-row="2"]'), { targetPosition: { x: 20, y: 40 } });
    await settle(page, 4);
    assert.deepEqual(await urls(), ['b', 'c', 'a']);

    // Dropped on the upper half of the first action: back to the front.
    await page.locator('.pt-action[data-pt-action-row="2"] .pt-grip').dragTo(page.locator('.pt-action[data-pt-action-row="0"]'), { targetPosition: { x: 20, y: 2 } });
    await settle(page, 4);
    assert.deepEqual(await urls(), ['a', 'b', 'c']);
});

// A screenshot of a conditional in the panel (the look of its branch, its else and their actions), for the review of the panel's layout.
test('a conditional with a branch and an else is drawn in the Prototype panel', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page } = await openImportedFile(browser, isolatedStage({ name: 'prototype-conditional.midas' }));
    const id = await page.evaluate(() => {
        const doc = window.midas.doc;
        doc.data.variables.items = [...(doc.data.variables.items ?? []), { id: 'flag-var', name: 'flag', type: 'boolean', values: {} }];
        const button = window.midas.createAtCenter('rect', { name: 'Button', w: 160, h: 48 });
        const open = url => ({ type: 'open-link', url, transition: { type: 'instant', durationMs: 0 } });
        const cond = { type: 'conditional', branches: [{ condition: { variableId: 'flag-var', operator: '==', value: true }, actions: [open('a'), open('b')] }], else: [open('c')] };
        doc.get(button.id).prototype = { version: 2, interactions: [{ id: 'i-click', trigger: { type: 'on-click' }, actions: [cond] }] };
        doc.touch(doc.get(button.id));
        window.midas.select([button.id]);
        return button.id;
    });
    await settle(page, 4);
    await page.locator('[data-inspector-tab="prototype"]').click();
    await settle(page, 2);
    assert.ok(await page.locator(`.pt-card[data-pt-row="i-click"] .pt-cond`).count() === 2, 'one branch and one else are drawn');
    await page.locator('#right-panel').screenshot({ path: `${ARTIFACTS}/prototype-conditional-${id}.png` });
});
