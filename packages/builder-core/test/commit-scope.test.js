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

test('a layer with prototype interactions takes the full path: the prototype check depends on it', () => {
    assert.equal(commitAffectsComponents(change({ added: [layer('p', { flags: ['prototype'] })] })).affects, true);
    assert.deepEqual(layerFlagsOf({ type: 'rect', prototype: { interactions: [{ id: 'i' }] } }), ['prototype']);
});

// The change sets the editor records for the real entry points (probed on an editable file, see the step 2 table).
const edited = (id, keys, extra = {}) => ({ id, type: 'path', parentId: null, flags: [], inComponent: false, keys, ...extra });
const penFinish = () => change({ added: [layer('v', { type: 'path', parentId: null })], changed: [edited('v', ['x', 'y', 'w', 'h', 'points', 'pathW', 'pathH'])] });
const inFrame = (parentExtra = {}) => change({
    added: [layer('r', { type: 'rect', parentId: 'frame' })],
    changed: [edited('frame', null, { type: 'frame', parentId: null, ...parentExtra })],
});

test('pen finish at page level: the new path is edited with geometry keys only, so the commit does not affect a component', () => {
    assert.equal(commitAffectsComponents(penFinish()).affects, false);
});

test('a layer added to a plain frame, with the frame recorded as changed (its children list), does not affect a component', () => {
    assert.equal(commitAffectsComponents(inFrame()).affects, false);
});

test('a layer added to an auto-layout frame, with the frame and its laid-out children recorded, does not affect a component', () => {
    const autoLayout = change({
        added: [layer('r', { type: 'rect', parentId: 'frame' })],
        changed: [edited('frame', null, { type: 'frame', parentId: null }), edited('sibling', ['x', 'y'], { type: 'rect', parentId: 'frame' })],
    });
    assert.equal(commitAffectsComponents(autoLayout).affects, false);
});

test('deleting the pen path, or a layer from a plain frame with its frame recorded, does not affect a component', () => {
    assert.equal(commitAffectsComponents(change({ removed: [layer('v', { type: 'path', parentId: null })] })).affects, false);
    assert.equal(commitAffectsComponents(change({ removed: [layer('r', { type: 'rect', parentId: 'frame' })], changed: [edited('frame', null, { type: 'frame', parentId: null })] })).affects, false);
});

test('the same commits keep the full path when the parent is a master, an instance or a boolean group', () => {
    for (const parent of [{ component: true, flags: ['component'] }, { isInstance: true, flags: ['instance'] }, { booleanOp: 'union', flags: ['booleanOp'] }]) {
        const under = change({ added: [layer('r', { type: 'rect', parentId: 'p', inComponent: true })], changed: [edited('p', null, { type: 'frame', parentId: null, ...parent })] });
        assert.equal(commitAffectsComponents(under).affects, true);
        assert.equal(commitAffectsComponents(change({ added: [layer('r', { type: 'rect', parentId: 'p', inComponent: true })] })).affects, true);
    }
});

test('an edit to an existing plain layer is allowed only when its keys are all whitelisted', () => {
    assert.equal(commitAffectsComponents(change({ changed: [edited('p', ['x', 'y', 'name', 'fills'])] })).affects, false);
    assert.equal(commitAffectsComponents(change({ changed: [edited('p', ['behavior'])] })).affects, true);
    assert.equal(commitAffectsComponents(change({ changed: [edited('p', ['x', 'vars'])] })).affects, true);
    assert.equal(commitAffectsComponents(change({ changed: [edited('p', null)] })).affects, true);
});

test('a whitelisted edit of a flagged or in-component layer still takes the full path', () => {
    assert.equal(commitAffectsComponents(change({ changed: [edited('i', ['x'], { flags: ['instance'] })] })).affects, true);
    assert.equal(commitAffectsComponents(change({ changed: [edited('m', ['x'], { inComponent: true })] })).affects, true);
});

test('undo and redo keep the full path, whatever the keys', () => {
    assert.equal(commitAffectsComponents(change({ full: true, changed: [edited('p', ['x'])] })).affects, true);
});
