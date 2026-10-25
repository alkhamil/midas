// The Drawer of Add / Edit: whether removing the interaction that opens it may remove the layer.
// - A Drawer the user placed (a component on the page, not an overlay Midas made) is never removed by the cleanup.
// - A Drawer Midas placed for an interaction (open-overlay → "Place on canvas") is removed with that interaction.
// And the id counter of the table: a reset puts it back to its start, so ids are predictable.
import test from 'node:test';
import assert from 'node:assert/strict';
import { overlaysToPrune, unusedOverlays, createEvalCtx, runStateAction, normalizeStateVariable, cleanState } from '../src/index.js';

const helpers = { interactionsOf: n => n.interactions || [], targetOf: a => a.targetComponentId };
const page = { id: 'page', type: 'frame', parentId: null };
const addButton = (interactions) => ({ id: 'addM', type: 'frame', parentId: 'page', interactions });
const drawerComponent = { id: 'drawerM', type: 'frame', parentId: null, component: true, name: 'Drawer' };

test('a Drawer the user placed is kept when the interaction that opens it is removed', () => {
    const nodes = [page, drawerComponent, addButton([])];        // the Add button no longer has its interaction
    assert.deepEqual(overlaysToPrune(nodes, helpers), []);
    assert.deepEqual(unusedOverlays(nodes, helpers), []);        // it is not an overlay at all
});

test('a Drawer Midas placed for an interaction is removed with that interaction', () => {
    const drawerOverlay = { id: 'ovDrawer', type: 'frame', parentId: null, isInstance: true, isOverlay: true, overlayTrigger: 'addM', sourceId: 'drawerM', autoCreated: true, ownerId: 'ixAdd' };
    const withInteraction = [page, drawerComponent, addButton([{ id: 'ixAdd', trigger: 'onClick', actions: [{ type: 'open-overlay', targetComponentId: 'drawerM', overlayInstanceId: 'ovDrawer' }] }]), drawerOverlay];
    assert.deepEqual(overlaysToPrune(withInteraction, helpers), []);                 // while the interaction asks for it, it stays
    const without = [page, drawerComponent, addButton([]), drawerOverlay];          // the interaction is removed
    assert.deepEqual(overlaysToPrune(without, helpers), ['ovDrawer']);               // and the Drawer goes with it (one undo step in the editor)
});

test('a reset puts the id counter back to its start: ids after a reload are predictable', () => {
    const counter = normalizeStateVariable({ id: 'nextId', name: 'nextId', type: 'number', scope: 'page', initial: 100 });
    const ev = createEvalCtx(cleanState({ variables: [counter], derived: [] }));
    const inc = { type: 'set-state', variableId: 'nextId', op: 'increment', value: { op: 'value', value: 1 } };
    const reset = { type: 'set-state', variableId: 'nextId', op: 'reset' };
    assert.equal(runStateAction(inc, ev, ev.env()).ok, true);
    assert.equal(runStateAction(inc, ev, ev.env()).ok, true);
    assert.equal(ev.get('nextId'), 102);
    assert.equal(runStateAction(reset, ev, ev.env()).ok, true);
    assert.equal(ev.get('nextId'), 100);
});
