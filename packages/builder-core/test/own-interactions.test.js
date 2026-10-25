// Regression (bulk delete defect): a plain layer with its own interactions is wired in Preview; a layer without any is not.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hasOwnInteractions } from '../src/index.js';

test('a plain frame with an On click is wired (it is not an instance)', () => {
    const plain = { id: 'bulkM', type: 'frame', isInstance: false, interactions: [{ id: 'ix', trigger: 'onClick', actions: [{ type: 'request', delay: 200 }] }] };
    assert.equal(hasOwnInteractions(plain), true);
});

test('a layer with no interactions, or none set, is not wired for them', () => {
    assert.equal(hasOwnInteractions({ id: 'x', type: 'frame' }), false);
    assert.equal(hasOwnInteractions({ id: 'x', interactions: [] }), false);
    assert.equal(hasOwnInteractions(undefined), false);
});
