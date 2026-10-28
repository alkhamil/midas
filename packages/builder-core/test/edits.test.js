import { test } from 'node:test';
import assert from 'node:assert/strict';
import { varsWithOp, varsWithBinding, varModesWith, collectionOfProp } from '../src/behavior-engine/edits.js';

test('a binding op sets its prop on the vars and keeps the others', () => {
    assert.deepEqual(varsWithOp({ radius: 'i-r' }, { prop: 'fill', value: 'i-bg-disabled' }), { radius: 'i-r', fill: 'i-bg-disabled' });
});

test('a null op removes its prop; vars left empty become undefined, so the node loses them', () => {
    assert.deepEqual(varsWithOp({ fill: 'i-bg', radius: 'i-r' }, { prop: 'fill', value: null }), { radius: 'i-r' });
    assert.equal(varsWithOp({ fill: 'i-bg' }, { prop: 'fill', value: null }), undefined);
    assert.equal(varsWithOp(undefined, { prop: 'fill', value: null }), undefined);
});

test('a bound token sets its var key to the variable item, keeping the other bindings', () => {
    assert.deepEqual(varsWithBinding(undefined, 'fill', 'i-bg'), { fill: 'i-bg' });
    assert.deepEqual(varsWithBinding({ radius: 'i-r' }, 'fill', 'i-bg'), { radius: 'i-r', fill: 'i-bg' });
    assert.deepEqual(varsWithBinding({ fill: 'i-old' }, 'fill', 'i-new'), { fill: 'i-new' });
});

test('the Appearance mode of a collection is written, replaced, and cleared; an empty map is dropped', () => {
    assert.deepEqual(varModesWith(undefined, 'c-variant', 'danger'), { 'c-variant': 'danger' });
    assert.deepEqual(varModesWith({ 'c-variant': 'primary', 'c-size': 'sm' }, 'c-variant', 'danger'), { 'c-variant': 'danger', 'c-size': 'sm' });
    assert.deepEqual(varModesWith({ 'c-variant': 'primary', 'c-size': 'sm' }, 'c-variant', ''), { 'c-size': 'sm' });
    assert.equal(varModesWith({ 'c-variant': 'primary' }, 'c-variant', null), undefined);
    assert.equal(varModesWith(undefined, 'c-variant', ''), undefined);
});

test('a variable prop writes the mode of the collection bound to it; an unbound prop has none', () => {
    const binding = { templateId: 'button', variables: { variant: 'c-variant', size: null } };
    assert.equal(collectionOfProp(binding, 'variant'), 'c-variant');
    assert.equal(collectionOfProp(binding, 'size'), null);
    assert.equal(collectionOfProp(binding, 'missing'), null);
    assert.equal(collectionOfProp(undefined, 'variant'), null);
});
