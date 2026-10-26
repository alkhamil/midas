// Type mapping: each of the four feedback levels resolves to its own value of a component's type collection or variant.
import test from 'node:test';
import assert from 'node:assert/strict';
import { matchLevel, levelsCovered } from '../src/index.js';

test('each level finds its own mode from the usual names', () => {
    const modes = ['Info', 'Success', 'Warning', 'Error'];
    assert.equal(matchLevel(modes, 'success'), 'Success');
    assert.equal(matchLevel(modes, 'error'), 'Error');
    assert.equal(matchLevel(modes, 'warning'), 'Warning');
    assert.equal(matchLevel(modes, 'info'), 'Info');
});

test('synonyms and sentence-case names resolve', () => {
    const modes = ['Danger', 'Ok', 'Caution', 'Neutral'];
    assert.equal(matchLevel(modes, 'error'), 'Danger');
    assert.equal(matchLevel(modes, 'success'), 'Ok');
    assert.equal(matchLevel(modes, 'warning'), 'Caution');
    assert.equal(matchLevel(modes, 'info'), 'Neutral');
});

test('an explicit mapping always wins over the names', () => {
    const modes = ['Info', 'Success', 'Warning', 'Error', 'Brand'];
    assert.equal(matchLevel(modes, 'info', { info: 'Brand' }), 'Brand');
    assert.equal(matchLevel(modes, 'error', { error: 'Warning' }), 'Warning');
});

test('a level with no matching value is null, never another level\'s value', () => {
    const modes = ['Primary', 'Secondary'];
    assert.equal(matchLevel(modes, 'error'), null);
    assert.equal(matchLevel(modes, 'success'), null);
});

test('a mapping that names a value the collection does not have is ignored', () => {
    assert.equal(matchLevel(['Info', 'Error'], 'success', { success: 'Gone' }), null);
});

test('levelsCovered counts the levels a collection can draw', () => {
    assert.equal(levelsCovered(['Info', 'Success', 'Warning', 'Error']), 4);
    assert.equal(levelsCovered(['Default', 'Error']), 1);
});
