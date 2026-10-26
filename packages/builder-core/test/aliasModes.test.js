// Variable aliases across collections: the target is read in its own collection, with the mode the instance picks for it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { variableValueInMode, aliasCollectionIds } from '../src/index.js';

const colls = [
    { id: 'styles', modes: [{ id: 's-info' }, { id: 's-danger' }] },
    { id: 'variant', modes: [{ id: 'v-basic' }, { id: 'v-light' }] },
    { id: 'semantic', modes: [{ id: 'light' }, { id: 'dark' }] },
];
const items = [
    // styles.icon-color: per mode, an alias into semantic
    { id: 'icon-info', collectionId: 'styles', type: 'color', values: { 's-info': { alias: 'sem-blue' }, 's-danger': { alias: 'sem-red' } } },
    { id: 'icon-variant', collectionId: 'variant', type: 'color', values: { 'v-basic': { alias: 'icon-info' }, 'v-light': { alias: 'icon-info' } } },
    { id: 'sem-blue', collectionId: 'semantic', type: 'color', values: { light: '#0f4f9e', dark: '#7aa7ff' } },
    { id: 'sem-red', collectionId: 'semantic', type: 'color', values: { light: '#a01713', dark: '#ff7a70' } },
];
const modeFromInstance = { styles: 's-danger', semantic: 'light' };
const modeFor = cid => modeFromInstance[cid] ?? null;

test('an alias chain follows the mode the instance picks in the middle collection', () => {
    assert.equal(variableValueInMode(items[1], colls[1], 'v-light', items, colls, modeFor), '#a01713');
});

test('without a pick the target collection uses its first mode, not the source mode id', () => {
    assert.equal(variableValueInMode(items[1], colls[1], 'v-light', items, colls), '#0f4f9e');
});

test('the chain reports every collection it passes through', () => {
    assert.deepEqual(aliasCollectionIds(items[1], items), ['variant', 'styles', 'semantic']);
});
