import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildNodeIndex, subtreeFrom } from '../src/engine/nodeIndex.js';

// Algoritma lama: bangun peta anak dari SEMUA node pada setiap pemanggilan.
function legacySubtreeOf(pages, rootId) {
    const nodes = pages.flatMap(p => p.nodes), kids = new Map();
    for (const n of nodes)
        if (n.parentId)
            (kids.get(n.parentId) || kids.set(n.parentId, []).get(n.parentId)).push(n);
    const out = [], root = nodes.find(n => n.id === rootId);
    if (!root)
        return out;
    const stack = [root];
    while (stack.length) {
        const n = stack.pop();
        out.push(n);
        stack.push(...(kids.get(n.id) || []));
    }
    return out;
}

// Dokumen acak deterministik: beberapa page, pohon bersarang, urutan anak tercampur antar-page.
function makeDoc(pageCount = 4, perPage = 400) {
    let seed = 11;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    return Array.from({ length: pageCount }, (_, pi) => {
        const nodes = [];
        for (let i = 0; i < perPage; i++) {
            const parent = i < 3 || rnd() < 0.1 ? null : nodes[Math.floor(rnd() * nodes.length)].id;
            nodes.push({ id: `p${pi}n${i}`, parentId: parent, type: 'frame' });
        }
        return { id: `page${pi}`, nodes };
    });
}

test('subtreeFrom returns exactly what the legacy full-scan subtreeOf returned, in the same order', () => {
    const pages = makeDoc();
    const index = buildNodeIndex(pages);
    const roots = pages.flatMap(p => p.nodes).filter((_, i) => i % 7 === 0);
    assert.ok(roots.length > 100);
    for (const r of roots)
        assert.deepEqual(subtreeFrom(index, r.id).map(n => n.id), legacySubtreeOf(pages, r.id).map(n => n.id), `subtree ${r.id}`);
});

test('unknown roots give an empty list and leaves give just themselves', () => {
    const pages = makeDoc(1, 50);
    const index = buildNodeIndex(pages);
    assert.deepEqual(subtreeFrom(index, 'nope'), []);
    const leaf = pages[0].nodes.find(n => !index.kidsMap.has(n.id));
    assert.deepEqual(subtreeFrom(index, leaf.id).map(n => n.id), [leaf.id]);
});

test('kids are kept in document order across pages', () => {
    const index = buildNodeIndex([{ nodes: [{ id: 'a', parentId: null }, { id: 'b', parentId: 'a' }] }, { nodes: [{ id: 'c', parentId: 'a' }] }]);
    assert.deepEqual(index.kidsMap.get('a').map(n => n.id), ['b', 'c']);
});
