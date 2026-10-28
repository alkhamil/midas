import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { buildFidelityFixture, FIDELITY_FIXTURE_PATH } from '../../../scripts/make-fidelity-fixture.js';

const doc = buildFidelityFixture();
const frameIds = doc.pages[0].nodes.filter(n => n.type === 'frame').map(n => n.id);

test('the fidelity fixture on disk is the one the generator builds', () => {
    assert.deepEqual(JSON.parse(readFileSync(FIDELITY_FIXTURE_PATH, 'utf8')), doc);
});

test('every feature frame draws, and the only layers not drawn are the known gaps: images and glass', () => {
    const types = new Set();
    for (const id of frameIds) {
        const { root, unsupported } = toDomTree(doc, id);
        assert.ok(root, id);
        for (const u of unsupported) types.add(u.type);
    }
    assert.deepEqual([...types].sort(), ['glass', 'image']);
});

test('building the tree does not change the document', () => {
    const before = JSON.stringify(doc);
    for (const id of frameIds) toDomTree(doc, id);
    assert.equal(JSON.stringify(doc), before);
});
