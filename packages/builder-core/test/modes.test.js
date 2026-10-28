import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveMode } from '../src/behavior-engine/modes.js';

const variant = { id: 'c-variant', name: 'Variant', modes: [{ id: 'primary' }, { id: 'danger' }] };
const nodesOf = list => new Map(list.map(n => [n.id, n]));

test('a node with its own mode for the collection uses it', () => {
    const nodes = nodesOf([{ id: 'a', parentId: null, varModes: { 'c-variant': 'danger' } }]);
    assert.equal(resolveMode(variant, nodes.get('a'), nodes, undefined), 'danger');
});

test('a node with no mode of its own inherits its nearest parent\'s mode', () => {
    const nodes = nodesOf([
        { id: 'root', parentId: null, varModes: { 'c-variant': 'danger' } },
        { id: 'mid', parentId: 'root' },
        { id: 'leaf', parentId: 'mid' },
    ]);
    assert.equal(resolveMode(variant, nodes.get('leaf'), nodes, undefined), 'danger');
});

test('the nearest ancestor wins over a farther one', () => {
    const nodes = nodesOf([
        { id: 'root', parentId: null, varModes: { 'c-variant': 'danger' } },
        { id: 'mid', parentId: 'root', varModes: { 'c-variant': 'primary' } },
        { id: 'leaf', parentId: 'mid' },
    ]);
    assert.equal(resolveMode(variant, nodes.get('leaf'), nodes, undefined), 'primary');
});

test('with no mode on the node or its parents, the page\'s mode is used', () => {
    const nodes = nodesOf([{ id: 'a', parentId: null }]);
    assert.equal(resolveMode(variant, nodes.get('a'), nodes, { 'c-variant': 'danger' }), 'danger');
});

test('a node\'s own mode beats the page\'s mode', () => {
    const nodes = nodesOf([{ id: 'a', parentId: null, varModes: { 'c-variant': 'primary' } }]);
    assert.equal(resolveMode(variant, nodes.get('a'), nodes, { 'c-variant': 'danger' }), 'primary');
});

test('with nothing set, the first mode of the collection is the default', () => {
    const nodes = nodesOf([{ id: 'a', parentId: null }]);
    assert.equal(resolveMode(variant, nodes.get('a'), nodes, undefined), 'primary');
});

test('a mode that the collection does not have is skipped, not used', () => {
    const nodes = nodesOf([
        { id: 'root', parentId: null, varModes: { 'c-variant': 'danger' } },
        { id: 'leaf', parentId: 'root', varModes: { 'c-variant': 'gone' } },
    ]);
    assert.equal(resolveMode(variant, nodes.get('leaf'), nodes, undefined), 'danger');
});

test('a collection with no modes resolves to null', () => {
    const nodes = nodesOf([{ id: 'a', parentId: null }]);
    assert.equal(resolveMode({ id: 'c-empty', modes: [] }, nodes.get('a'), nodes, undefined), null);
});

test('a parent that is missing from the document ends the walk; the page or the first mode is used', () => {
    const nodes = nodesOf([{ id: 'a', parentId: 'nowhere' }]);
    assert.equal(resolveMode(variant, nodes.get('a'), nodes, undefined), 'primary');
});
