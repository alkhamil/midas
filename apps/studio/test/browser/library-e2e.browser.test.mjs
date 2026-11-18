// A library is referenced, not copied (like Figma). A source file's Button, a colour variable and an image are published through the
// server; another file uses the library and places an instance of the Button. The tests check that the file saves no library page,
// variable or image, that the instance resolves again after reopen and offline (from this browser's cache), and that removing the
// library unmounts it while the instance stays and points at the missing component.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { ARTIFACTS, API_URL, ensureDevServers, launchBrowser, openImportedFile } from './harness.mjs';
import { isolatedStage } from './parity-helpers.mjs';
import { libraryCopyId } from '../../../../packages/builder-core/src/library/library-refs.js';

const fileIdOf = page => decodeURIComponent(new URL(page.url()).pathname.split('/').filter(Boolean)[1]);

/** The snapshot a library version carries, built from the source file's own layers: a component and its subtree, in document order. */
function snapshotOf(path, components) {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    const nodes = data.pages.flatMap(p => p.nodes);
    const subtree = root => {
        const out = [root];
        for (let i = 0; i < out.length; i++)
            out.push(...nodes.filter(n => n.parentId === out[i].id));
        return out;
    };
    const comps = components.map(id => {
        const root = nodes.find(n => n.id === id);
        return { id, name: root.name, set: false, ordered: true, nodes: subtree(root).map(n => ({ ...n, parentId: n.id === id ? null : n.parentId })) };
    });
    return { components: comps, variables: { collections: [], items: [] }, assets: {} };
}

/** The node with this id on any page of the open file, or null. */
const nodeWith = (page, id) => page.evaluate(id => window.midas.doc.data.pages.flatMap(p => p.nodes).find(n => n.id === id) ?? null, id);

/**
 * A source file publishes its Button, a colour variable and an image as a library; a second file uses it and places an instance of the
 * Button. Returns the consumer page and the ids the tests need.
 */
async function publishAndPlace(browser) {
    const srcPath = isolatedStage({ name: 'library-source.midas' });
    const src = await openImportedFile(browser, srcPath, { dpr: 1 });
    const srcId = fileIdOf(src.page);
    // The library also brings a colour variable and an image: both join the file in memory only.
    const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    const snapshot = {
        ...snapshotOf(srcPath, ['btn', 'icon-check']),
        assets: { 'lib-img': 'data:image/png;base64,' + PNG },
        variables: { collections: [{ id: 'lib-coll', name: 'Library colours', modes: [{ id: 'm', name: 'Light' }] }], items: [{ id: 'lib-red', collectionId: 'lib-coll', name: 'red', type: 'color', values: { m: '#ff0000ff' } }] },
    };
    const published = await src.page.request.post(`${API_URL}/api/libraries/${srcId}/versions`, {
        data: { name: 'Source library', snapshot, componentKeys: ['btn', 'icon-check'] },
    });
    assert.equal(published.status(), 200, 'the library publishes');
    // One page at a time: the server keeps the last file open, so the source page must not write it again.
    await src.page.context().close();

    const dst = await openImportedFile(browser, isolatedStage({ name: 'library-consumer.midas' }), { dpr: 1 });
    const dstId = fileIdOf(dst.page);
    const page = dst.page;
    const use = await page.request.put(`${API_URL}/api/files/${dstId}/libraries`, { data: { libraries: [{ id: srcId, version: 1 }] } });
    assert.equal(use.status(), 200, 'the file uses the library');
    await page.reload();
    await page.waitForFunction(() => window.midas?.doc?.data?.pages?.some(p => p.library), null, { timeout: 30000 });

    const copyId = libraryCopyId(srcId, 'btn');
    assert.equal((await nodeWith(page, copyId))?.name, 'Button', 'the library page holds the Button');

    const instId = await page.evaluate(async cid => {
        window.midas.instantiate(cid);
        const inst = window.midas.doc.data.pages.filter(p => !p.library).flatMap(p => p.nodes).find(n => n.sourceId === cid && n.parentId == null);
        return inst?.id ?? null;
    }, copyId);
    assert.ok(instId, 'an instance of the library Button is placed in the file');
    return { page, srcId, dstId, copyId, instId };
}

test('a library is referenced: published, used by another file, saved without its pages, and resolved after reopen and offline', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page, dstId, copyId, instId } = await publishAndPlace(browser);

    await page.evaluate(() => window.midas.save());
    await page.waitForFunction(() => document.querySelector('#save-indicator')?.textContent.includes('Saved'), null, { timeout: 30000 });
    const saved = await (await page.request.get(`${API_URL}/api/files/${dstId}`)).json();
    const pageNames = (saved.file.meta.pageMeta ?? []).map(p => p.name);
    assert.ok(pageNames.length > 0, 'the file has pages on the server');
    assert.deepEqual(pageNames.filter(n => n.startsWith('Library · ')), [], 'no library page is written to the server');
    assert.deepEqual((saved.file.meta.variables?.items ?? []).filter(i => i.libId || i.id === 'lib-red'), [], 'no library variable is saved');
    assert.equal(JSON.stringify(saved.file.meta.assetUrls ?? {}).includes('lib-img'), false, 'no library image is saved');
    const uploaded = await (await page.request.get(`${API_URL}/api/files/${dstId}/assets`)).text();
    assert.equal(uploaded.includes('lib-img'), false, 'no library image is uploaded with the file');

    // Reopen: the instance still resolves to the library's component, from the mounted snapshot.
    await page.reload();
    await page.waitForFunction(() => window.midas?.doc?.data?.pages?.some(p => p.library), null, { timeout: 30000 });
    assert.equal((await nodeWith(page, instId))?.sourceId, copyId, 'the instance keeps its reference to the library layer');
    assert.ok(await nodeWith(page, copyId), 'the library component is mounted again');
    assert.equal(await page.evaluate(() => window.midas.doc.data.variables.items.some(i => i.id === 'lib-red' && i.libId)), true, 'the library variable is in the file, read-only');
    assert.equal(await page.evaluate(() => !!window.midas.doc.data.assets['lib-img']), true, 'the library image is in the file, from its snapshot');

    // Offline: the server cannot answer, so the snapshot comes from this browser's cache and the file still renders its instance.
    await page.route(/\/api\/libraries\/[^/]+\/snapshot/, route => route.abort());
    await page.reload();
    await page.waitForFunction(() => window.midas?.doc?.data?.pages?.some(p => p.library), null, { timeout: 30000 });
    assert.equal((await nodeWith(page, instId))?.sourceId, copyId, 'the instance is still there offline');
    assert.ok(await nodeWith(page, copyId), 'the library renders offline from the cached snapshot');
});

test('removing a library unmounts it: its variables and image go, and its instance stays pointing at the missing component', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page, dstId, srcId, copyId, instId } = await publishAndPlace(browser);

    // The Assets panel's toggle removes the library the file uses.
    await page.locator('[data-rail="assets"]').click();
    // The removal is saved to the server (its uses) as the click lands: wait for that request, not a delay.
    await Promise.all([
        page.waitForResponse(r => r.request().method() === 'PUT' && r.url().endsWith(`/api/files/${dstId}/libraries`)),
        page.locator(`[data-lib-toggle="${srcId}"]`).first().click(),
    ]);
    await page.waitForFunction(() => !window.midas.doc.data.pages.some(p => p.library), null, { timeout: 15000 });

    assert.equal(await page.evaluate(() => window.midas.doc.data.variables.items.some(i => i.libId)), false, 'the library variables are gone');
    assert.equal(await page.evaluate(() => Object.keys(window.midas.doc.data.assets).includes('lib-img')), false, 'the library image is gone');
    assert.equal((await nodeWith(page, instId))?.sourceId, copyId, 'the instance stays in the file, still pointing at the library layer');
    assert.equal(await nodeWith(page, copyId), null, 'its component is no longer in the file');
    // The instance's Behavior tab names the missing library in Diagnostics.
    await page.evaluate(id => window.midas.select([id]), instId);
    await page.locator('#inspector-tab-behavior').click();
    await page.getByText(/its library is not added to this file/).first().waitFor({ state: 'visible', timeout: 15000 });

    const uses = await (await page.request.get(`${API_URL}/api/files/${dstId}/libraries`)).json();
    assert.deepEqual(uses.libraries, [], 'the file no longer uses the library on the server');
});

test('Duplicate keeps the library uses: the copy of a file that uses a library uses it too', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page, dstId, srcId } = await publishAndPlace(browser);

    // Save, then go Home, where the file menu (right-click on its card) has Duplicate.
    await page.evaluate(() => window.midas.save());
    await page.waitForFunction(() => document.querySelector('#save-indicator')?.textContent.includes('Saved'), null, { timeout: 30000 });
    const before = (await (await page.request.get(`${API_URL}/api/files`)).json()).files.map(f => f.id);
    await page.locator('#go-home').click();
    const card = page.locator(`[data-hf="${dstId}"]`).first();
    await card.waitFor({ state: 'visible', timeout: 30000 });
    await card.click({ button: 'right' });
    await page.locator('#home-menu').getByText('Duplicate', { exact: true }).click();

    // The copy is the file that did not exist before; it must use the same library on the server.
    let copyId = null;
    for (let i = 0; i < 60 && !copyId; i++) {
        const now = (await (await page.request.get(`${API_URL}/api/files`)).json()).files.map(f => f.id);
        copyId = now.find(id => !before.includes(id)) ?? null;
        if (!copyId) await page.waitForTimeout(500);
    }
    assert.ok(copyId, 'the duplicate is created');
    const uses = await (await page.request.get(`${API_URL}/api/files/${copyId}/libraries`)).json();
    assert.deepEqual(uses.libraries.map(l => l.id), [srcId], 'the copy uses the same library');
});
