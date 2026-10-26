// Can type is on only while the input behavior names a layer, an input type or a bound state. Remove leaves an empty {}.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hasTypeable } from '../src/index.js';

test('an empty typeable after Remove is not Can type', () => {
    assert.equal(hasTypeable({ typeable: {} }), false);
    assert.equal(hasTypeable({ validation: { required: true } }), false);
    assert.equal(hasTypeable(undefined), false);
});

test('a layer, an input type or a bound state each makes Can type on', () => {
    assert.equal(hasTypeable({ typeable: { frameId: 'f1' } }), true);
    assert.equal(hasTypeable({ typeable: { inputType: 'email' } }), true);
    assert.equal(hasTypeable({ typeable: { bindTo: 's1' } }), true);
});
