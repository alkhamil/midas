// A library is referenced, not copied (like Figma). A source file's Button is published through the server, another file uses the library,
// places an instance, saves, and reopens: the instance still finds its component, and no "Library · …" page is written to the server. With the
// server cut off, the same file renders from the snapshot this browser cached.
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

test('a library is referenced: published, used by another file, saved without its pages, and resolved after reopen and offline', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await launchBrowser();
    t.after(() => browser.close());

    // The source file: its Button and the default icon are the library.
    const srcPath = isolatedStage({ name: 'library-source.midas' });
    const src = await openImportedFile(browser, srcPath, { dpr: 1 });
    const srcId = fileIdOf(src.page);
    // The library also brings a colour variable and an image: both join the file in memory only.
    const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    const snapshot = { ...snapshotOf(srcPath, ['btn', 'icon-check']), assets: { 'lib-img': 'data:image/png;base64,' + PNG }, variables: { collections: [{ id: 'lib-coll', name: 'Library colours', modes: [{ id: 'm', name: 'Light' }] }], items: [{ id: 'lib-red', collectionId: 'lib-coll', name: 'red', type: 'color', values: { m: '#ff0000ff' } }] } };
    const published = await src.page.request.post(`${API_URL}/api/libraries/${srcId}/versions`, {
        data: { name: 'Source library', snapshot, componentKeys: ['btn', 'icon-check'] },
    });
    assert.equal(published.status(), 200, 'the library publishes');
    // One page at a time: the server keeps the last file open, so the source page must not write it again.
    await src.page.context().close();

    // The consumer file: it uses the library and places an instance of its Button.
    const dst = await openImportedFile(browser, isolatedStage({ name: 'library-consumer.midas' }), { dpr: 1 });
    const dstId = fileIdOf(dst.page);
    const page = dst.page;
    const use = await page.request.put(`${API_URL}/api/files/${dstId}/libraries`, { data: { libraries: [{ id: srcId, version: 1 }] } });
    assert.equal(use.status(), 200, 'the file uses the library');
    await page.reload();
    await page.waitForFunction(() => window.midas?.doc?.data?.pages?.some(p => p.library), null, { timeout: 30000 });

    const copyId = libraryCopyId(srcId, 'btn');
    assert.equal(await page.evaluate(id => window.midas.doc.data.pages.flatMap(p => p.nodes).find(n => n.id === id)?.name, copyId), 'Button', 'the library page holds the Button');

    const instId = await page.evaluate(async cid => {
        window.midas.instantiate(cid);
        const inst = window.midas.doc.data.pages.filter(p => !p.library).flatMap(p => p.nodes).find(n => n.sourceId === cid && n.parentId == null);
        return inst?.id ?? null;
    }, copyId);
    assert.ok(instId, 'an instance of the library Button is placed in the file');

    await page.evaluate(() => window.midas.save());
    await page.waitForFunction(() => document.querySelector('#save-indicator')?.textContent.includes('Saved'), null, { timeout: 30000 });
    const meta = await (await page.request.get(`${API_URL}/api/files/${dstId}`)).json();
    const pageNames = (meta.file?.meta?.pageMeta ?? []).map(p => p.name);
    assert.ok(pageNames.length > 0, 'the file has pages on the server');
    assert.deepEqual(pageNames.filter(n => n.startsWith('Library · ')), [], 'no library page is written to the server');
    const saved = await (await page.request.get(`${API_URL}/api/files/${dstId}`)).json();
    assert.deepEqual((saved.file.meta.variables?.items ?? []).filter(i => i.libId || i.id === 'lib-red'), [], 'no library variable is saved');
    assert.equal(JSON.stringify(saved.file.meta.assetUrls ?? {}).includes('lib-img'), false, 'no library image is saved');
    const uploaded = await (await page.request.get(`${API_URL}/api/files/${dstId}/assets`)).text();
    assert.equal(uploaded.includes('lib-img'), false, 'no library image is uploaded with the file');

    // Reopen: the instance still resolves to the library's component, from the mounted snapshot.
    await page.reload();
    await page.waitForFunction(() => window.midas?.doc?.data?.pages?.some(p => p.library), null, { timeout: 30000 });
    const after = await page.evaluate(([iid, cid]) => ({ sourceId: window.midas.doc.data.pages.flatMap(p => p.nodes).find(n => n.id === iid)?.sourceId ?? null, component: !!window.midas.doc.data.pages.flatMap(p => p.nodes).find(n => n.id === cid) }), [instId, copyId]);
    assert.equal(after.sourceId, copyId, 'the instance keeps its reference to the library layer');
    assert.equal(after.component, true, 'the library component is mounted again');
    assert.equal(await page.evaluate(() => window.midas.doc.data.variables.items.some(i => i.id === 'lib-red' && i.libId)), true, 'the library variable is in the file, read-only');
    assert.equal(await page.evaluate(() => !!window.midas.doc.data.assets['lib-img']), true, 'the library image is in the file, from its snapshot');

    // Offline: the server cannot answer, so the snapshot comes from this browser's cache and the file still renders its instance.
    await page.route(/\/api\/libraries\/[^/]+\/snapshot/, route => route.abort());
    await page.reload();
    await page.waitForFunction(() => window.midas?.doc?.data?.pages?.some(p => p.library), null, { timeout: 30000 });
    const offline = await page.evaluate(([iid, cid]) => ({ sourceId: window.midas.doc.data.pages.flatMap(p => p.nodes).find(n => n.id === iid)?.sourceId ?? null, component: !!window.midas.doc.data.pages.flatMap(p => p.nodes).find(n => n.id === cid) }), [instId, copyId]);
    assert.equal(offline.sourceId, copyId, 'the instance is still there offline');
    assert.equal(offline.component, true, 'the library renders offline from the cached snapshot');
});
