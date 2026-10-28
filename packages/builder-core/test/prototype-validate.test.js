import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePrototype, assertPrototypeData, PrototypeDataError, introducedProblems } from '../src/prototype/validate.js';

const frame = (id, extra = {}) => ({ id, name: id, type: 'frame', parentId: null, ...extra });
const child = (id, parentId, extra = {}) => ({ id, name: id, type: 'rectangle', parentId, ...extra });
const link = (id, destinationId, trigger = { type: 'on-click' }) => ({ id: `i-${id}`, trigger, action: { type: 'navigate-to', destinationId, transition: { type: 'instant', durationMs: 0 } } });
const proto = interactions => ({ version: 1, interactions });
const doc = pages => ({ pages });
const codesOf = (d, opts) => validatePrototype(d, opts).map(p => p.code);

test('a file with no prototype data is valid', () => {
    assert.deepEqual(validatePrototype(doc([{ id: 'p', name: 'P', nodes: [frame('A'), child('a', 'A')] }])), []);
});

test('a valid link between two top-level frames on one page is valid', () => {
    const d = doc([{ id: 'p', name: 'P', nodes: [frame('A', { prototype: proto([link('a', 'B')]) }), frame('B')] }]);
    assert.deepEqual(validatePrototype(d), []);
});

test('the structured problem names the page, the node and the interaction', () => {
    const d = doc([{ id: 'p', name: 'Screens', nodes: [frame('A', { prototype: proto([link('a', 'X')]) })] }]);
    const [problem] = validatePrototype(d);
    assert.equal(problem.code, 'destination-missing');
    assert.equal(problem.page, 'Screens');
    assert.equal(problem.node, 'A');
    assert.equal(problem.interaction, 'i-a');
    assert.equal(typeof problem.message, 'string');
});

test('an unknown prototype version on a node is refused', () => {
    const d = doc([{ id: 'p', name: 'P', nodes: [frame('A', { prototype: { version: 2, interactions: [] } })] }]);
    assert.deepEqual(codesOf(d), ['node-prototype-version']);
});

test('an unknown field on the node prototype is refused', () => {
    const d = doc([{ id: 'p', name: 'P', nodes: [frame('A', { prototype: { version: 1, interactions: [], extra: 1 } })] }]);
    assert.deepEqual(codesOf(d), ['node-prototype-shape']);
});

test('an unknown trigger is refused', () => {
    const d = doc([{ id: 'p', name: 'P', nodes: [frame('A', { prototype: proto([link('a', 'B', { type: 'on-hover' })]) }), frame('B')] }]);
    assert.deepEqual(codesOf(d), ['trigger-unknown']);
});

test('after-delay needs a delay above zero', () => {
    const zero = doc([{ id: 'p', name: 'P', nodes: [frame('A', { prototype: proto([link('a', 'B', { type: 'after-delay', delayMs: 0 })]) }), frame('B')] }]);
    assert.deepEqual(codesOf(zero), ['trigger-delay']);
    const ok = doc([{ id: 'p', name: 'P', nodes: [frame('A', { prototype: proto([link('a', 'B', { type: 'after-delay', delayMs: 800 })]) }), frame('B')] }]);
    assert.deepEqual(validatePrototype(ok), []);
});

test('an unknown action is refused', () => {
    const d = doc([{ id: 'p', name: 'P', nodes: [frame('A', { prototype: proto([{ id: 'i-x', trigger: { type: 'on-click' }, action: { type: 'overlay' } }]) })] }]);
    assert.deepEqual(codesOf(d), ['action-unknown']);
});

test('a navigate-to without a destination is refused', () => {
    const d = doc([{ id: 'p', name: 'P', nodes: [frame('A', { prototype: proto([{ id: 'i-x', trigger: { type: 'on-click' }, action: { type: 'navigate-to', transition: { type: 'instant', durationMs: 0 } } }]) })] }]);
    assert.deepEqual(codesOf(d), ['action-shape']);
});

test('an unknown transition, a negative duration, or a slide without a direction is refused', () => {
    const withTransition = t => doc([{ id: 'p', name: 'P', nodes: [frame('A', { prototype: proto([{ id: 'i-x', trigger: { type: 'on-click' }, action: { type: 'navigate-to', destinationId: 'B', transition: t } }]) }), frame('B')] }]);
    assert.deepEqual(codesOf(withTransition({ type: 'fade', durationMs: 100 })), ['transition-unknown']);
    assert.deepEqual(codesOf(withTransition({ type: 'dissolve', durationMs: -1 })), ['transition-duration']);
    assert.deepEqual(codesOf(withTransition({ type: 'slide-in', direction: 'diagonal', durationMs: 300, easing: 'linear' })), ['transition-direction']);
});

test('open-link accepts http and https only', () => {
    const open = url => doc([{ id: 'p', name: 'P', nodes: [frame('A', { prototype: proto([{ id: 'i-x', trigger: { type: 'on-click' }, action: { type: 'open-link', url } }]) })] }]);
    assert.deepEqual(validatePrototype(open('https://example.com')), []);
    assert.deepEqual(codesOf(open('javascript:alert(1)')), ['open-link-url']);
    assert.deepEqual(codesOf(open('not a url')), ['open-link-url']);
});

test('a duplicate interaction id on one node is refused', () => {
    const d = doc([{ id: 'p', name: 'P', nodes: [frame('A', { prototype: proto([link('a', 'B'), link('a', 'B')]) }), frame('B')] }]);
    assert.deepEqual(codesOf(d), ['interaction-duplicate-id']);
});

test('a destination that is not a top-level frame is refused', () => {
    const d = doc([{ id: 'p', name: 'P', nodes: [frame('A', { prototype: proto([link('a', 'C')]) }), frame('B'), child('C', 'B')] }]);
    assert.deepEqual(codesOf(d), ['destination-not-frame']);
});

test('a managed layer cannot own interactions', () => {
    const d = doc([{ id: 'p', name: 'P', nodes: [frame('A'), child('icon', 'A', { behavior: { version: 2, slot: 'iconStart' }, prototype: proto([link('a', 'A')]) })] }]);
    assert.deepEqual(codesOf(d), ['managed-layer-interaction']);
});

test('flow start must be a top-level frame on a loaded page', () => {
    const missing = doc([{ id: 'p', name: 'P', nodes: [frame('A')], prototype: { version: 1, flows: [{ id: 'f', name: 'Main', startFrameId: 'Z' }] } }]);
    assert.deepEqual(codesOf(missing), ['flow-start-missing']);
    const notFrame = doc([{ id: 'p', name: 'P', nodes: [frame('A'), child('c', 'A')], prototype: { version: 1, flows: [{ id: 'f', name: 'Main', startFrameId: 'c' }] } }]);
    assert.deepEqual(codesOf(notFrame), ['flow-start-not-frame']);
});

test('a page prototype with another version or an unknown field is refused', () => {
    assert.deepEqual(codesOf(doc([{ id: 'p', name: 'P', nodes: [], prototype: { version: 3, flows: [] } }])), ['page-prototype-version']);
    assert.deepEqual(codesOf(doc([{ id: 'p', name: 'P', nodes: [], prototype: { version: 1, flows: [], extra: 1 } }])), ['page-prototype-shape']);
});

test('an incomplete (lazy) document defers references it cannot resolve yet', () => {
    const d = doc([{ id: 'p', name: 'P', nodes: [frame('A', { prototype: proto([link('a', 'OnPageNotLoaded')]) })], prototype: { version: 1, flows: [{ id: 'f', name: 'Main', startFrameId: 'AlsoNotLoaded' }] } }]);
    assert.deepEqual(codesOf(d, { complete: false }), []);
    assert.deepEqual(codesOf(d, { complete: true }), ['flow-start-missing', 'destination-missing']);
});

test('assertPrototypeData throws a PrototypeDataError naming the first problem', () => {
    const d = doc([{ id: 'p', name: 'Screens', nodes: [frame('A', { prototype: proto([link('a', 'X')]) })] }]);
    assert.throws(() => assertPrototypeData(d), err => err instanceof PrototypeDataError && /Screens/.test(err.message) && /"A"/.test(err.message));
    assert.doesNotThrow(() => assertPrototypeData(doc([{ id: 'p', name: 'P', nodes: [frame('A')] }])));
});

test('a trigger that takes no delay refuses a delay field', () => {
    const d = doc([{ id: 'p', name: 'P', nodes: [frame('A', { prototype: proto([link('a', 'B', { type: 'on-click', delayMs: 500 })]) }), frame('B')] }]);
    assert.deepEqual(codesOf(d), ['trigger-shape']);
});

test('an unknown easing is refused, and an absent easing is allowed', () => {
    const withEasing = easing => doc([{ id: 'p', name: 'P', nodes: [frame('A', { prototype: proto([{ id: 'i-x', trigger: { type: 'on-click' }, action: { type: 'navigate-to', destinationId: 'B', transition: { type: 'dissolve', durationMs: 100, easing } } }]) }), frame('B')] }]);
    assert.deepEqual(codesOf(withEasing('bounce')), ['transition-easing']);
    assert.deepEqual(validatePrototype(withEasing(undefined)), []);
});

test('an edit introduces only the problems it did not find before (a problem that was there stays a problem, not the edit\'s)', () => {
    const before = validatePrototype(doc([{ id: 'p', name: 'Screens', nodes: [frame('A', { prototype: proto([link('a', 'gone')]) })] }]));
    const after = validatePrototype(doc([{ id: 'p', name: 'Screens', nodes: [frame('A', { prototype: proto([link('a', 'gone'), link('b', 'missing-too')]) })] }]));
    const introduced = introducedProblems(before, after);
    assert.deepEqual(introduced.map(p => [p.code, p.interaction]), [['destination-missing', 'i-b']]);
});

test('a valid edit introduces no problem', () => {
    const before = validatePrototype(doc([{ id: 'p', name: 'Screens', nodes: [frame('A'), frame('B')] }]));
    const after = validatePrototype(doc([{ id: 'p', name: 'Screens', nodes: [frame('A', { prototype: proto([link('a', 'B')]) }), frame('B')] }]));
    assert.deepEqual(introducedProblems(before, after), []);
});

test('moving a link target out of the top level is an introduced problem, with the page and node named', () => {
    const before = validatePrototype(doc([{ id: 'p', name: 'Screens', nodes: [frame('A', { prototype: proto([link('a', 'B')]) }), frame('B')] }]));
    const after = validatePrototype(doc([{ id: 'p', name: 'Screens', nodes: [frame('A', { prototype: proto([link('a', 'B')]) }), frame('B', { parentId: 'A' })] }]));
    const [problem] = introducedProblems(before, after);
    assert.equal(problem.code, 'destination-not-frame');
    assert.equal(problem.page, 'Screens');
    assert.equal(problem.node, 'A');
});

// Conditional: a variable, an operator its type allows, a literal of its type; branches of plain actions and an optional else.
const variable = (id, type, name = id) => ({ id, name, type, collectionId: 'c', values: {} });
const withItems = (pages, items) => ({ pages, variables: { collections: [], items } });
const go = destinationId => ({ type: 'navigate-to', destinationId, transition: { type: 'instant', durationMs: 0 } });
const condition = (variableId, operator, value) => ({ variableId, operator, value });
const branch = (cond, actions) => ({ condition: cond, actions });
const conditional = (branches, elseActions) => ({ type: 'conditional', branches, ...(elseActions ? { else: elseActions } : {}) });
const onClick = (id, action, trigger = { type: 'on-click' }) => ({ id: `i-${id}`, trigger, action });
const flowWith = (action, trigger) => withItems([{ id: 'p', name: 'P', nodes: [frame('A', { prototype: proto([onClick('c', action, trigger)]) }), frame('B'), frame('C')] }], [variable('v-bool', 'boolean'), variable('v-num', 'number'), variable('v-str', 'string'), variable('v-col', 'color')]);

test('a conditional with a boolean branch and an else is valid', () => {
    assert.deepEqual(validatePrototype(flowWith(conditional([branch(condition('v-bool', '==', true), [go('B')])], [go('C')]))), []);
});

test('a conditional with only an else is valid', () => {
    assert.deepEqual(validatePrototype(flowWith(conditional([], [go('B')]))), []);
});

test('a condition on a variable that does not exist is refused', () => {
    assert.deepEqual(codesOf(flowWith(conditional([branch(condition('v-none', '==', true), [go('B')])]))), ['condition-variable-missing']);
});

test('a condition on a variable of a type a condition cannot compare is refused', () => {
    assert.deepEqual(codesOf(flowWith(conditional([branch(condition('v-col', '==', '#fff'), [go('B')])]))), ['condition-variable-type']);
});

test('a literal of the wrong type is refused', () => {
    assert.deepEqual(codesOf(flowWith(conditional([branch(condition('v-num', '==', '3'), [go('B')])]))), ['condition-value-type']);
    assert.deepEqual(codesOf(flowWith(conditional([branch(condition('v-bool', '==', 1), [go('B')])]))), ['condition-value-type']);
    assert.deepEqual(codesOf(flowWith(conditional([branch(condition('v-str', '==', 5), [go('B')])]))), ['condition-value-type']);
});

test('an operator the type does not allow is refused: booleans have no order', () => {
    assert.deepEqual(codesOf(flowWith(conditional([branch(condition('v-bool', '>', true), [go('B')])]))), ['condition-operator']);
});

test('every number and string operator is valid', () => {
    for (const op of ['==', '!=', '>', '<', '>=', '<=']) {
        assert.deepEqual(codesOf(flowWith(conditional([branch(condition('v-num', op, 3), [go('B')])]))), [], op);
        assert.deepEqual(codesOf(flowWith(conditional([branch(condition('v-str', op, 'x'), [go('B')])]))), [], op);
    }
});

test('a branch with no actions is refused, and so is an empty else', () => {
    assert.deepEqual(codesOf(flowWith(conditional([branch(condition('v-bool', '==', true), [])]))), ['conditional-empty-branch']);
    assert.deepEqual(codesOf(flowWith(conditional([branch(condition('v-bool', '==', true), [go('B')])], []))), ['conditional-empty-branch']);
});

test('a conditional with no branch and no else is refused', () => {
    assert.deepEqual(codesOf(flowWith(conditional([]))), ['conditional-empty']);
});

test('a conditional inside a conditional is refused', () => {
    const inner = conditional([branch(condition('v-bool', '==', true), [go('B')])]);
    assert.deepEqual(codesOf(flowWith(conditional([branch(condition('v-bool', '==', true), [inner])]))), ['conditional-nested']);
});

test('a nested navigate-to to a missing frame is refused like a plain one', () => {
    assert.deepEqual(codesOf(flowWith(conditional([branch(condition('v-bool', '==', true), [go('X')])]))), ['destination-missing']);
});

test('a nested navigate-to cannot run on while hovering, and a nested open-link can', () => {
    const hover = { type: 'while-hovering' };
    assert.deepEqual(codesOf(flowWith(conditional([branch(condition('v-bool', '==', true), [go('B')])]), hover)), ['trigger-action-mismatch']);
    const link = { type: 'open-link', url: 'https://example.com' };
    assert.deepEqual(codesOf(flowWith(conditional([branch(condition('v-bool', '==', true), [link])]), hover)), []);
});

test('an unknown field on a branch or a condition is refused', () => {
    assert.deepEqual(codesOf(flowWith(conditional([{ condition: condition('v-bool', '==', true), actions: [go('B')], extra: 1 }]))), ['action-shape']);
    assert.deepEqual(codesOf(flowWith(conditional([branch({ ...condition('v-bool', '==', true), extra: 1 }, [go('B')])]))), ['condition-shape']);
});
