import assert from 'node:assert/strict';
import { test } from 'node:test';
import { commitAffectsComponents, layerFlagsOf } from '../src/commit-scope.js';

// A layer as the classifier sees it: its type, its parent, the flags its own fields give, and whether it lies inside a master or an instance.
const layer = (id, extra = {}) => ({ id, type: 'path', parentId: 'frame', flags: [], inComponent: false, ...extra });
const change = (parts = {}) => ({ added: [], removed: [], changed: [], full: false, ...parts });

test('a vector added to a plain frame affects no component', () => {
    assert.equal(commitAffectsComponents(change({ added: [layer('v')] })).affects, false);
});

test('a vector deleted from a plain frame affects no component', () => {
    assert.equal(commitAffectsComponents(change({ removed: [layer('v')] })).affects, false);
});

test('a rectangle added at page level affects no component', () => {
    assert.equal(commitAffectsComponents(change({ added: [layer('r', { type: 'rect', parentId: null })] })).affects, false);
});

test('a top-level frame is page structure and takes the full path', () => {
    const r = commitAffectsComponents(change({ added: [layer('f', { type: 'frame', parentId: null })] }));
    assert.equal(r.affects, true);
    assert.match(r.reason, /page structure/);
});

test('a layer added inside a master takes the full path', () => {
    assert.equal(commitAffectsComponents(change({ added: [layer('v', { inComponent: true })] })).affects, true);
});

test('a layer with a component flag takes the full path, added or removed', () => {
    assert.equal(commitAffectsComponents(change({ added: [layer('c', { flags: ['component'] })] })).affects, true);
    assert.equal(commitAffectsComponents(change({ removed: [layer('i', { flags: ['instance'] })] })).affects, true);
});

test('deleting an instance takes the full path', () => {
    assert.equal(commitAffectsComponents(change({ removed: [layer('i', { flags: ['instance'] })] })).affects, true);
});

test('a layer bound to a variable takes the full path', () => {
    assert.equal(commitAffectsComponents(change({ added: [layer('b', { flags: ['vars'] })] })).affects, true);
});

test('a slot property or template behaviour takes the full path', () => {
    assert.equal(commitAffectsComponents(change({ added: [layer('s', { flags: ['propBind'] })] })).affects, true);
    assert.equal(commitAffectsComponents(change({ removed: [layer('t', { flags: ['behavior'] })] })).affects, true);
});

test('an edit to an existing layer takes the full path: its changed keys are not known here', () => {
    assert.equal(commitAffectsComponents(change({ changed: [layer('p')] })).affects, true);
});

test('undo and redo, paste and import take the full path whatever they touched', () => {
    assert.equal(commitAffectsComponents(change({ full: true, added: [layer('v')] })).affects, true);
});

test('no change at all affects no component', () => {
    assert.equal(commitAffectsComponents(change()).affects, false);
});

test('a missing change set takes the full path', () => {
    assert.equal(commitAffectsComponents(null).affects, true);
});

test('layerFlagsOf names the fields that tie a layer to components, and nothing else', () => {
    assert.deepEqual(layerFlagsOf({ type: 'rect', fills: [] }), []);
    assert.deepEqual(layerFlagsOf({ type: 'frame', component: true, isInstance: true, sourceId: 'x' }).sort(), ['component', 'instance', 'sourceId']);
    assert.deepEqual(layerFlagsOf({ type: 'rect', behavior: { templateId: 't' }, vars: { fill: 'v' }, propBind: { slot: 's' } }).sort(), ['behavior', 'propBind', 'vars']);
    assert.deepEqual(layerFlagsOf({ type: 'frame', componentSet: true, cprops: [{}] }).sort(), ['componentSet', 'cprops']);
    assert.deepEqual(layerFlagsOf({ type: 'path', booleanOp: 'union' }), ['booleanOp']);
});
