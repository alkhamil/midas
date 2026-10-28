import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrototypeFixture, buildInvalidPrototypeFixture } from '../../../scripts/make-prototype-fixture.js';
import { validatePrototype } from '../src/prototype/validate.js';
import { createPlayer, respond } from '../src/prototype/player.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { isDisabledTarget } from '../src/prototype/events.js';
import { assertBehaviorData } from '../src/behavior-engine/document-check.js';

const doc = buildPrototypeFixture();
const nodes = doc.pages.flatMap(p => p.nodes);
const byId = new Map(nodes.map(n => [n.id, n]));
const ctx = {
    interactionsOf: id => byId.get(id)?.prototype?.interactions ?? [],
    frameOf: id => byId.get(id)?.parentId ?? null,
    nodesOf: frameId => nodes.filter(n => n.parentId === frameId).map(n => ({ id: n.id, interactions: n.prototype?.interactions ?? [] })),
};
const pointer = (nodeId, trigger = 'on-click') => ({ type: 'pointer', nodeId, trigger });

test('the flow fixture is valid as a complete document', () => {
    assert.deepEqual(validatePrototype(doc), []);
});

test('the invalid variant has exactly one problem: the destination that does not exist, on the node that names it', () => {
    const problems = validatePrototype(buildInvalidPrototypeFixture());
    assert.deepEqual(problems.map(p => [p.code, p.page, p.node, p.interaction]), [['destination-missing', 'Flow', 'Continue', 'details-continue-go']]);
});

test('the flow walks from Home to Details, back to Home, to Confirm and Done, and after the delay back to Home', () => {
    let state = createPlayer('frame-home');
    let step = respond(state, pointer('home-next'), ctx);
    assert.equal(step.state.current, 'frame-details');
    assert.deepEqual(step.effects.find(e => e.type === 'navigate').transition, { type: 'slide-in', direction: 'left', durationMs: 300, easing: 'ease-out' });
    state = step.state;

    step = respond(state, pointer('details-back'), ctx);
    assert.deepEqual(step.state, { current: 'frame-home', history: [] });
    state = step.state;

    step = respond(state, pointer('home-delete', 'mouse-enter'), ctx);
    assert.equal(step.state.current, 'frame-confirm');
    state = step.state;

    step = respond(state, pointer('confirm-done'), ctx);
    assert.equal(step.state.current, 'frame-done');
    assert.deepEqual(step.effects.filter(e => e.type === 'schedule'), [{ type: 'schedule', nodeId: 'done-home', interactionId: 'done-home-go', delayMs: 1200 }]);
    state = step.state;

    step = respond(state, { type: 'timer', nodeId: 'done-home', interactionId: 'done-home-go' }, ctx);
    assert.equal(step.state.current, 'frame-home');
});

test('restart goes back to the start frame and empties the history', () => {
    const start = { current: 'frame-done', history: ['frame-home', 'frame-details', 'frame-confirm'] };
    assert.deepEqual(respond(start, { type: 'restart', startFrameId: 'frame-home' }, ctx).state, { current: 'frame-home', history: [] });
});

test('the disabled Button draws disabled, and its layers are disabled targets for Play', () => {
    const { root } = toDomTree(doc, 'frame-home');
    const off = root.children[2];
    assert.equal(off.nodeId, 'home-off');
    assert.equal(isDisabledTarget(off, [root]), true);
    assert.equal(isDisabledTarget(off.children[0], [root, off]), true);
    assert.equal(isDisabledTarget(root.children[0], [root]), false);
});

test('the Home frame draws as a flex column with three Button elements: primary, danger and disabled', () => {
    const before = JSON.stringify(doc);
    const { root, styles, problems } = toDomTree(doc, 'frame-home');
    assert.deepEqual(problems, []);
    assert.equal(root.style.display, 'flex');
    assert.equal(root.style.flexDirection, 'column');
    assert.deepEqual(root.children.map(b => [b.tag, b.attrs.class, b.attrs['data-variant'], b.attrs.disabled === true]), [
        ['button', 'button', 'primary', false],
        ['button', 'button', 'danger', false],
        ['button', 'button', 'primary', true],
    ]);
    assert.deepEqual(root.children.map(b => b.children[0].text), ['Next', 'Delete', 'Unavailable']);
    assert.match(styles, /\.button\[data-variant="danger"\]\[data-size="lg"\]/);
    assert.equal(JSON.stringify(doc), before, 'building the DOM does not change the document');
});

test('the Done frame draws its one Button under the after-delay interaction, with no interaction data in the DOM', () => {
    const { root } = toDomTree(doc, 'frame-done');
    assert.equal(root.children.length, 1);
    assert.equal(root.children[0].children[0].text, 'Back home');
    assert.equal(JSON.stringify(root).includes('after-delay'), false);
});

test('the flow fixture passes the Behavior load rules, so it opens in the editor', () => {
    assert.doesNotThrow(() => assertBehaviorData(buildPrototypeFixture()));
});
