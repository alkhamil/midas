// Size reaches nested instances: a List set to xl gives its List Items and Dividers xl. A Breadcrumb with an icon separator draws it square at its
// line height (the xl step, 24px). Truncated hides items without renaming the separators that stay: their layer ids are kept as the prop toggles.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { ARTIFACTS, ensureDevServers, openImportedFile, launchBrowser, settle } from './harness.mjs';
import { createFromPanel, isolatedStage, setProp } from './parity-helpers.mjs';

// The nodes of a slot's box: each child with its template, its Size mode name (its own variable mode) and its separator marker.
const boxRows = (page, id) => page.evaluate(id => {
    const doc = window.midas.doc;
    const collections = doc.data.variables?.collections ?? [];
    const box = doc.descendants(id).find(n => n.propBind?.slot === 'items');
    return doc.children(box.id).map(c => {
        const master = doc.get(c.sourceId) ?? null;
        const sizeCollection = master?.behavior?.variables?.size;
        const modeId = c.varModes?.[sizeCollection];
        return {
            id: c.id,
            template: master?.behavior?.templateId ?? null,
            size: collections.find(k => k.id === sizeCollection)?.modes.find(m => m.id === modeId)?.name ?? null,
            between: c.behavior?.between ?? c.behavior?.slot ?? null,
            box: c.behavior?.between ? doc.world(c.id).box : null,
        };
    });
}, id);

test('a List set to xl gives its items and Dividers xl, and a Breadcrumb icon separator is square at its line height', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage({ name: 'list-breadcrumb-sizing.midas' }));

    // List: one Divider between two items, then Size xl reaches both kinds.
    const listId = await createFromPanel(page, 'list');
    await page.evaluate(id => window.midas.select([id]), listId);
    await page.locator('#inspector-tab-behavior').click();
    await setProp(page, 'separator', true);
    await page.locator('[data-bp-action="slot-add"]').click();
    await settle(page, 6);
    await page.locator('[data-bp-prop="size"]').first().selectOption({ label: 'xl' });
    await settle(page, 6);
    const list = await boxRows(page, listId);
    assert.deepEqual(list.map(r => r.template), ['antd-list-item', 'antd-divider', 'antd-list-item', 'antd-divider', 'antd-list-item'], 'three items and their Dividers');
    assert.deepEqual(list.map(r => r.size), ['xl', 'xl', 'xl', 'xl', 'xl'], 'the items and the Dividers are xl');

    // Breadcrumb: an icon separator, square at the xl line height, then Truncated over three items.
    const crumbId = await createFromPanel(page, 'antd-breadcrumb');
    await page.evaluate(id => window.midas.select([id]), crumbId);
    await page.locator('#inspector-tab-behavior').click();
    await page.locator('[data-bp-prop="size"]').first().selectOption({ label: 'xl' });
    await settle(page, 4);
    await page.locator('[data-bp-action="segment"][data-bp-prop="separatorKind"][data-bp-value="icon"]').click();
    await settle(page, 4);
    await page.locator('[data-bp-action="icon"][data-bp-prop="separatorIcon"]').click();
    // The picker's folders start closed; a search opens the ones that hold a match.
    await page.locator('[data-vpk-search]').fill('chevron');
    await page.locator('[data-pick]').first().click();
    await settle(page, 6);
    const separators = rows => rows.filter(r => r.between === 'separator');
    const icon = separators(await boxRows(page, crumbId));
    assert.equal(icon.length, 1, 'one separator between the two links');
    assert.equal(icon[0].box.w, icon[0].box.h, 'the icon separator is square');
    assert.equal(icon[0].box.w, 24, 'and as tall as the xl line height');

    await page.locator('[data-bp-action="slot-add"][data-bp-slot="items"]').click();
    await settle(page, 6);
    const before = separators(await boxRows(page, crumbId)).map(r => r.id);
    assert.equal(before.length, 2, 'three links, two separators');

    await setProp(page, 'truncated', true);
    await settle(page, 6);
    const truncated = await boxRows(page, crumbId);
    assert.deepEqual(separators(truncated).map(r => r.id), before, 'Truncated keeps the separators: same layer ids');
    assert.ok(truncated.some(r => r.between === 'ellipsis'), 'and shows the ellipsis');

    await setProp(page, 'truncated', false);
    await settle(page, 6);
    assert.deepEqual(separators(await boxRows(page, crumbId)).map(r => r.id), before, 'turning Truncated off keeps the same ids too');
    assert.deepEqual(errors, [], 'console errors');
});
