// A file refers to a published library; it does not copy the library's components into its own pages. The components of a
// library are rebuilt in memory from its snapshot (snapshotPageOf), with ids that do not depend on the file, so an instance
// saved in the file finds them again. These tests pin that format; no document is written by them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { libraryCopyId, snapshotPageOf, isLibraryPage, persistedPages, persistedDocumentOf, libraryVariablesOf, legacyLibraryProblem } from '../src/library/library-refs.js';

const snap = {
    id: 'lib-1',
    name: 'Web DS',
    version: 3,
    components: [
        {
            id: 'c-button', ordered: true,
            nodes: [
                { id: 'n-root', name: 'Button', parentId: null, type: 'frame', component: true, x: 40, y: 40, w: 100, h: 32 },
                { id: 'n-label', name: 'label', parentId: 'n-root', type: 'text', sourceId: 'n-glyph' },
                { id: 'n-glyph', name: 'icon', parentId: 'n-root', type: 'frame', swapOf: 'n-other' },
            ],
        },
        {
            id: 'c-other', ordered: true,
            nodes: [{ id: 'n-other', name: 'Other', parentId: null, type: 'frame', component: true, x: 0, y: 0, w: 10, h: 10 }],
        },
    ],
};

test('a copy id is stable for the same library and layer, and differs between libraries and layers', () => {
    assert.equal(libraryCopyId('lib-1', 'n-root'), libraryCopyId('lib-1', 'n-root'));
    assert.notEqual(libraryCopyId('lib-1', 'n-root'), libraryCopyId('lib-1', 'n-label'));
    assert.notEqual(libraryCopyId('lib-1', 'n-root'), libraryCopyId('lib-2', 'n-root'));
    assert.match(libraryCopyId('lib-1', 'n-root'), /^[A-Za-z0-9_~.-]+$/, 'a plain id the file can store');
});

test('the library page is rebuilt from the snapshot: ids, parents and references are mapped, and it is not persisted', () => {
    const page = snapshotPageOf(snap);
    assert.equal(isLibraryPage(page), true);
    assert.equal(page.name, 'Library · Web DS');
    assert.deepEqual(page.library, { id: 'lib-1', version: 3, assets: [] });
    const ids = Object.fromEntries(page.nodes.map(n => [n.libRef, n.id]));
    const root = page.nodes.find(n => n.libRef === 'lib-1:n-root');
    assert.equal(root.id, libraryCopyId('lib-1', 'n-root'));
    assert.equal(root.parentId, null);
    const label = page.nodes.find(n => n.libRef === 'lib-1:n-label');
    assert.equal(label.parentId, root.id, 'a child points at its copied parent');
    assert.equal(label.sourceId, libraryCopyId('lib-1', 'n-glyph'), 'a reference points at the copied layer');
    const glyph = page.nodes.find(n => n.libRef === 'lib-1:n-glyph');
    assert.equal(glyph.swapOf, libraryCopyId('lib-1', 'n-other'), 'a swap reference is mapped too');
    assert.ok(ids['lib-1:n-other'], 'every component of the snapshot is in the page');
});

test('the root of each component keeps its place in the snapshot, not a place in the file', () => {
    const page = snapshotPageOf(snap);
    const root = page.nodes.find(n => n.libRef === 'lib-1:n-root');
    assert.equal(root.x, 40);
    assert.equal(root.y, 40);
});

test('saving keeps the file pages only: library pages are never written into the file', () => {
    const file = [{ id: 'p1', name: 'Page 1', nodes: [] }, snapshotPageOf(snap)];
    assert.deepEqual(persistedPages(file).map(p => p.id), ['p1']);
});

test('a file that still holds a copied library page is refused with a clear message', () => {
    const legacy = [{ id: 'old', name: 'Library · Web DS', internal: true, nodes: [{ id: 'x', libRef: 'lib-1:n-root' }] }];
    const problem = legacyLibraryProblem(legacy);
    assert.match(problem, /Library · Web DS/);
    assert.match(problem, /re-?publish|rebuild|create/i, 'it says what to do');
    assert.equal(legacyLibraryProblem([{ id: 'p1', name: 'Page 1', nodes: [] }]), null, 'a normal file opens');
    assert.equal(legacyLibraryProblem([snapshotPageOf(snap)]), null, 'a library page from this format is not legacy');
});

const withAssets = {
    ...snap,
    assets: { 'lib-img': 'data:image/png;base64,AAAA' },
    variables: { collections: [{ id: 'lib-coll', name: 'Library colours', modes: [{ id: 'm', name: 'Light' }] }], items: [{ id: 'lib-red', collectionId: 'lib-coll', name: 'red', type: 'color', values: { m: '#ff0000ff' } }] },
};

test('a library page names its assets, so saving can leave them out', () => {
    assert.deepEqual(snapshotPageOf(withAssets).library.assets, ['lib-img']);
    assert.deepEqual(snapshotPageOf(snap).library.assets, []);
});

test('a library\'s variables are tagged with the library and the snapshot is not changed', () => {
    const v = libraryVariablesOf(withAssets);
    assert.deepEqual(v.collections.map(c => [c.id, c.libId]), [['lib-coll', 'lib-1']]);
    assert.deepEqual(v.items.map(i => [i.id, i.libId]), [['lib-red', 'lib-1']]);
    assert.equal(withAssets.variables.items[0].libId, undefined);
});

test('a file\'s saved document holds no library page, asset or variable, and keeps its own', () => {
    const data = {
        name: 'File', pageId: 'p1',
        pages: [{ id: 'p1', name: 'Page 1', nodes: [] }, snapshotPageOf(withAssets)],
        assets: { 'file-img': 'data:image/png;base64,BBBB', 'lib-img': 'data:image/png;base64,AAAA' },
        variables: { collections: [{ id: 'file-coll', name: 'Mine', modes: [] }, { id: 'lib-coll', libId: 'lib-1', name: 'Library colours', modes: [] }], items: [{ id: 'lib-red', libId: 'lib-1', collectionId: 'lib-coll' }, { id: 'file-x', collectionId: 'file-coll' }] },
    };
    const saved = persistedDocumentOf(data);
    assert.deepEqual(saved.pages.map(p => p.id), ['p1']);
    assert.deepEqual(Object.keys(saved.assets), ['file-img']);
    assert.deepEqual(saved.variables.collections.map(c => c.id), ['file-coll']);
    assert.deepEqual(saved.variables.items.map(i => i.id), ['file-x']);
    assert.equal(saved.name, 'File', 'the rest of the document is kept');
    assert.equal(data.pages.length, 2, 'the document in memory is not changed');
});
