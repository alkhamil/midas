// The Prototype panel's overlay edits (interactionPatch): choosing Open overlay or Close overlay, and the placement and close-on-outside fields.
// Every patch the panel can write is a valid action (validatePrototype is the judge).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interactionPatch, nestedPatch } from '../src/prototype/play.js';
import { validatePrototype } from '../src/prototype/validate.js';

const interaction = (action, trigger = { type: 'on-click' }) => ({ id: 'i1', trigger, action });
const doc = action => ({ pages: [{ id: 'p', name: 'P', nodes: [
    { id: 'A', name: 'A', type: 'frame', parentId: null, prototype: { version: 1, interactions: [{ id: 'i1', trigger: { type: 'on-click' }, action }] } },
    { id: 'O', name: 'O', type: 'frame', parentId: null },
] }] });
const ctx = { firstDestination: 'O' };

test('Open overlay opens the first top-level frame, centred, closing on outside clicks, instant', () => {
    const { action } = interactionPatch(interaction({ type: 'back' }), 'action', 'open-overlay', ctx);
    assert.deepEqual(action, { type: 'open-overlay', destinationId: 'O', placement: 'center', closeOnOutside: true, transition: { type: 'instant', durationMs: 0 } });
    assert.deepEqual(validatePrototype(doc(action)), []);
});

test('Open overlay is refused while hovering or pressing, and with no frame to open', () => {
    assert.throws(() => interactionPatch(interaction({ type: 'back' }, { type: 'while-hovering' }), 'action', 'open-overlay', ctx), /while hovering/i);
    assert.throws(() => interactionPatch(interaction({ type: 'back' }), 'action', 'open-overlay', {}), /no top-level frame/i);
});

test('Close overlay is a plain action with no fields, and is refused while hovering', () => {
    const { action } = interactionPatch(interaction({ type: 'back' }), 'action', 'close-overlay', ctx);
    assert.deepEqual(action, { type: 'close-overlay' });
    assert.deepEqual(validatePrototype(doc(action)), []);
    assert.throws(() => interactionPatch(interaction({ type: 'back' }, { type: 'while-pressing' }), 'action', 'close-overlay', ctx), /while pressing/i);
});

test('placement and close-on-outside change only an overlay, and each stays a valid action', () => {
    const open = { type: 'open-overlay', destinationId: 'O', placement: 'center', closeOnOutside: true, transition: { type: 'instant', durationMs: 0 } };
    for (const placement of ['below', 'above', 'center']) {
        const { action } = interactionPatch(interaction(open), 'placement', placement, ctx);
        assert.equal(action.placement, placement);
        assert.deepEqual(validatePrototype(doc(action)), []);
    }
    assert.equal(interactionPatch(interaction(open), 'close-outside', 'false', ctx).action.closeOnOutside, false);
    assert.equal(interactionPatch(interaction(open), 'close-outside', 'true', ctx).action.closeOnOutside, true);
    assert.throws(() => interactionPatch(interaction(open), 'placement', 'left', ctx), /placement must be/i);
    assert.throws(() => interactionPatch(interaction({ type: 'back' }), 'placement', 'below', ctx), /only an overlay/i);
});

test('a conditional branch may hold an overlay, and the nested edit writes it into the branch', () => {
    const cond = { type: 'conditional', branches: [{ condition: { variableId: 'v', operator: '==', value: true }, actions: [{ type: 'back' }] }] };
    const action = nestedPatch(interaction(cond), 'action', 'open-overlay', 'b0', 0, { ...ctx, variables: [{ id: 'v', type: 'boolean' }] });
    assert.equal(action.branches[0].actions[0].type, 'open-overlay');
});
