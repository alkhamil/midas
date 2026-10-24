// State default tidak boleh jatuh ke inactive/empty: instance yang belum
// disentuh harus tampil apa adanya, bukan memakai tampilan varian empty.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stateChain, overridesFor } from '../src/index.js';

test('rantai default berhenti di default', () => {
    assert.deepEqual(stateChain('default'), ['default']);
});

test('state mapping default tidak mewarisi baris empty', () => {
    const mapping = { empty: { fill: { value: '#eee' } } };
    assert.deepEqual(overridesFor(mapping, 'default'), {});
});

test('fallback lain tetap berlaku (pressed -> hover -> default)', () => {
    assert.deepEqual(stateChain('pressed'), ['pressed', 'hover', 'default']);
    const mapping = { default: { fill: { value: '#fff' } }, hover: { fill: { value: '#eee' } } };
    assert.deepEqual(overridesFor(mapping, 'pressed'), { fill: { value: '#eee' } });
});
