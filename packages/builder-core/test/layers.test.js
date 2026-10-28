import { test } from 'node:test';
import assert from 'node:assert/strict';
import { labelLayerOf, masterLayersOf } from '../src/behavior-engine/layers.js';

// A master: a root frame with an icon frame, then a text layer nested in a group, then a second text layer.
const nodes = [
    { id: 'root', type: 'frame', parentId: null },
    { id: 'icon', type: 'frame', parentId: 'root' },
    { id: 'group', type: 'group', parentId: 'root' },
    { id: 'deep', type: 'text', parentId: 'group' },
    { id: 'second', type: 'text', parentId: 'root' },
];
const childrenOf = id => nodes.filter(n => n.parentId === id);

test('the label is the first text layer, depth first', () => {
    assert.equal(labelLayerOf('root', childrenOf).id, 'deep');
});

test('a master with no text layer has no label', () => {
    assert.equal(labelLayerOf('icon', childrenOf), null);
});

test('the label of a master that is itself text is none: only layers inside it count', () => {
    assert.equal(labelLayerOf('deep', childrenOf), null);
});

test('masterLayersOf gives the root, and the label when there is one', () => {
    const root = nodes[0];
    assert.deepEqual(masterLayersOf(root, childrenOf).map(l => [l.key, l.node.id]), [['root', 'root'], ['label', 'deep']]);
    assert.deepEqual(masterLayersOf(nodes[1], childrenOf).map(l => l.key), ['root']);
});
