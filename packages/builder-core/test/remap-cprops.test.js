// A component imported from a library gets new layer ids, so every id a component property stores is remapped: the default and preferred components of an
// instance-swap property, and the preferred components of a slot property.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { remapCprops } from '../src/behavior-engine/remap-cprops.js';

const ids = new Map([['a', 'A'], ['b', 'B'], ['d', 'D']]);
const remap = props => remapCprops(props, ids);

test('an instance property remaps its default and its preferred components', () => {
    assert.deepEqual(remap([{ id: 'p', type: 'instance', def: 'a', preferred: ['b', 'z'] }]), [{ id: 'p', type: 'instance', def: 'A', preferred: ['B', 'z'] }]);
});

test('a slot property remaps its preferred components, and a slot has no default to remap', () => {
    const slot = { id: 's', name: 'Content', type: 'slot', def: null, onlyPreferred: true, preferred: ['a', 'b', 'outside'], min: 1 };
    assert.deepEqual(remap([slot]), [{ ...slot, preferred: ['A', 'B', 'outside'] }]);
    assert.deepEqual(remap([{ id: 's', type: 'slot', def: null }]), [{ id: 's', type: 'slot', def: null }], 'no preferred list, nothing to remap');
});

test('other properties, and an id the library does not hold, are left as they are; the input is not changed', () => {
    const props = [{ id: 't', type: 'text', def: 'a' }, { id: 'p', type: 'instance', def: 'unknown', preferred: undefined }, { id: 's', type: 'slot', def: null, preferred: ['a'], accepts: ['input'] }];
    const before = structuredClone(props);
    const out = remap(props);
    assert.deepEqual(out[0], props[0]);
    assert.deepEqual(out[1], props[1]);
    assert.deepEqual(out[2], { ...props[2], preferred: ['A'] }, 'accepts names templates, never layers');
    assert.deepEqual(props, before);
});
