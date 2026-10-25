// A text field can keep what is typed in a State variable (typeable.bindTo), so Save can read it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeInputBehavior } from '../src/index.js';

test('typeable.bindTo is kept; an empty one is dropped', () => {
    assert.equal(normalizeInputBehavior({ typeable: { frameId: 'a', bindTo: 'name' } }).typeable.bindTo, 'name');
    assert.equal(normalizeInputBehavior({ typeable: { frameId: 'a' } }).typeable.bindTo, undefined);
    assert.equal(normalizeInputBehavior({ typeable: { bindTo: '' } }).typeable.bindTo, undefined);
});
