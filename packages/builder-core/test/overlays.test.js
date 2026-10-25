// Overlay layers Midas places for Open dropdown / overlay / popover: ownership, reference counting, cleanup.
import test from 'node:test';
import assert from 'node:assert/strict';
import { overlayRefs, unusedOverlays, overlaysToPrune, reowned, overlaysOfTriggers, ownerOfAction, dropDanglingOverlays, allActions, overlayActionsOf } from '../src/index.js';

const open = (id, extra = {}) => ({ id, trigger: 'onClick', actions: [{ type: 'open-dropdown', targetComponentId: 'dd', ...extra }] });
const helpers = { interactionsOf: n => n.interactions || [], targetOf: a => a.targetComponentId };
const trigger = (interactions, id = 'email') => ({ id, type: 'frame', parentId: 'form', interactions });
const overlay = (id, extra = {}) => ({ id, type: 'frame', parentId: null, isInstance: true, isOverlay: true, overlayTrigger: 'email', sourceId: 'dd', autoCreated: true, ownerId: 'ix', ...extra });
const form = { id: 'form', type: 'frame', parentId: null };
const mine = { id: 'mine', type: 'frame', parentId: null, name: 'My note' };

test('an overlay is kept while an interaction asks for it', () => {
    const nodes = [form, trigger([open('ix')]), overlay('ov'), mine];
    assert.equal(overlayRefs(nodes, helpers).get('ov').length, 1);
    assert.deepEqual(overlaysToPrune(nodes, helpers), []);
});

test('removing the interaction removes the overlay Midas made for it, and nothing the user drew', () => {
    const nodes = [form, trigger([]), overlay('ov'), mine];
    assert.deepEqual(overlaysToPrune(nodes, helpers), ['ov']);
    assert.ok(!overlaysToPrune(nodes, helpers).includes('mine'));
});

test('changing the action to one that opens nothing removes it too', () => {
    const it = { id: 'ix', trigger: 'onClick', actions: [{ type: 'navigate', targetFrameId: 'p2' }] };
    assert.deepEqual(overlaysToPrune([form, trigger([it]), overlay('ov')], helpers), ['ov']);
});

test('an overlay two interactions ask for survives until the last one goes, and its owner moves', () => {
    const two = [open('ix'), open('iy')];
    const nodes = [form, trigger(two), overlay('ov')];
    assert.deepEqual(overlaysToPrune(nodes, helpers), []);
    const left = [form, trigger([open('iy')]), overlay('ov')];            // ix removed
    assert.deepEqual(overlaysToPrune(left, helpers), []);                 // still asked for by iy
    assert.deepEqual(reowned(left, helpers), [{ id: 'ov', ownerId: 'iy' }]);
    assert.deepEqual(overlaysToPrune([form, trigger([]), overlay('ov')], helpers), ['ov']);   // last one gone
});

test('an action inside a rule counts, and so does one an instance inherits', () => {
    const it = { id: 'ix', trigger: 'onClick', actions: [{ type: 'validate-field' }], rules: { items: [{ id: 'r', actions: [{ type: 'open-overlay', targetComponentId: 'dd' }] }] } };
    assert.equal(allActions([it]).length, 2);
    assert.equal(overlayActionsOf([it]).length, 1);
    assert.deepEqual(overlaysToPrune([form, trigger([it]), overlay('ov')], helpers), []);
    const inst = { id: 'email', type: 'frame', isInstance: true, parentId: 'form' };
    const inherit = { interactionsOf: n => (n.isInstance ? [open('ix')] : []), targetOf: helpers.targetOf };
    assert.deepEqual(overlaysToPrune([form, inst, overlay('ov')], inherit), []);
});

test('an overlay without the mark is never removed by itself, but is offered for cleanup', () => {
    const legacy = overlay('old', { autoCreated: undefined, ownerId: undefined });
    const nodes = [form, trigger([]), legacy, mine];
    assert.deepEqual(overlaysToPrune(nodes, helpers), []);
    assert.deepEqual(unusedOverlays(nodes, helpers).map(o => [o.id, o.auto]), [['old', false]]);
});

test('layers the user placed (no isOverlay) are never overlays', () => {
    const placed = { id: 'p', type: 'frame', parentId: null, isInstance: true, sourceId: 'dd', overlayTrigger: 'email' };
    assert.deepEqual(unusedOverlays([form, trigger([]), placed], helpers), []);
    assert.deepEqual(overlaysToPrune([form, trigger([]), placed], helpers), []);
});

test('deleting the trigger (or its frame) takes the overlays Midas made for it', () => {
    const nodes = [form, trigger([open('ix')]), overlay('ov'), overlay('ov2', { overlayTrigger: 'other' }), overlay('legacy', { autoCreated: undefined }), mine];
    assert.deepEqual(overlaysOfTriggers(nodes, ['email']), ['ov']);
    assert.deepEqual(overlaysOfTriggers(nodes, new Set(['email', 'other'])).sort(), ['ov', 'ov2']);
});

test('which interaction owns what an action creates', () => {
    const list = [{ id: 'a', trigger: 'onClick', actions: [{ type: 'navigate' }] }, open('b')];
    assert.equal(ownerOfAction(list, list[1].actions[0]), 'b');
    assert.equal(ownerOfAction(list, { targetComponentId: 'dd' }), 'b');         // the button that places it only knows the target
    assert.equal(ownerOfAction(list, { targetComponentId: 'zzz' }), '');
});

test('no orphan survives save and load: a Midas-made overlay whose trigger is gone is dropped, with its contents', () => {
    const data = { pages: [{ id: 'p1', nodes: [form, overlay('ov', { overlayTrigger: 'gone' }), { id: 'ovChild', parentId: 'ov', type: 'text' }, overlay('keep'), trigger([open('ix')]), overlay('legacy', { autoCreated: undefined, overlayTrigger: 'gone' }), mine] }] };
    const saved = JSON.parse(JSON.stringify(data));
    assert.equal(dropDanglingOverlays(saved), 1);
    assert.deepEqual(saved.pages[0].nodes.map(n => n.id), ['form', 'keep', 'email', 'legacy', 'mine']);
    assert.equal(dropDanglingOverlays(saved), 0);                                // idempotent
});

test('the migration finds the leftover of a deleted interaction (the reported case)', () => {
    // The interaction is gone, the placed instance stayed: it has no mark (an older file), nothing opens it.
    const nodes = [form, trigger([]), overlay('left', { autoCreated: undefined, ownerId: undefined }), mine];
    const found = unusedOverlays(nodes, helpers);
    assert.equal(found.length, 1);
    assert.deepEqual({ id: found[0].id, auto: found[0].auto, trigger: found[0].trigger }, { id: 'left', auto: false, trigger: '' });
});
