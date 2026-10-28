import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { buildFidelityFixture, FIDELITY_FIXTURE_PATH } from '../../../scripts/make-fidelity-fixture.js';

const doc = buildFidelityFixture();
const frameIds = doc.pages[0].nodes.filter(n => n.type === 'frame').map(n => n.id);

test('generator check: the fidelity fixture file equals what the generator builds (not a pixel comparison)', () => {
    assert.deepEqual(JSON.parse(readFileSync(FIDELITY_FIXTURE_PATH, 'utf8')), doc);
});

test('every feature frame draws, and exactly these are reported as not drawn: glass', () => {
    const reported = [];
    for (const id of frameIds) {
        const { root, unsupported } = toDomTree(doc, id);
        assert.ok(root, id);
        reported.push(...unsupported);
    }
    assert.deepEqual(reported.map(u => [u.nodeId, u.type]), [['x5', 'glass']]);
});

test('building the tree does not change the document', () => {
    const before = JSON.stringify(doc);
    for (const id of frameIds) toDomTree(doc, id);
    assert.equal(JSON.stringify(doc), before);
});
