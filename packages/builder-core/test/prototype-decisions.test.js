import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePrototype, assertPrototypeData, saveBlockedBy } from '../src/prototype/validate.js';
import { planNodeRemoval, planDetach } from '../src/prototype/plan.js';
import { eventFromDom, transitionCss, timersFor } from '../src/prototype/events.js';

const frame = (id, extra = {}) => ({ id, name: id, type: 'frame', parentId: null, ...extra });
const child = (id, parentId, extra = {}) => ({ id, name: id, type: 'rectangle', parentId, ...extra });
const instant = { type: 'instant', durationMs: 0 };
const interaction = (id, trigger, action) => ({ id, trigger, action });
const proto = interactions => ({ version: 1, interactions });
const doc = pages => ({ pages });
const codesOf = d => validatePrototype(d).map(p => p.code);

test('navigate-to and back cannot run on while-hovering or while-pressing', () => {
    for (const trigger of [{ type: 'while-hovering' }, { type: 'while-pressing' }]) {
        const nav = doc([{ id: 'p', name: 'P', nodes: [frame('A', { prototype: proto([interaction('x', trigger, { type: 'navigate-to', destinationId: 'B', transition: instant })]) }), frame('B')] }]);
        assert.deepEqual(codesOf(nav), ['trigger-action-mismatch']);
        const back = doc([{ id: 'p', name: 'P', nodes: [frame('A', { prototype: proto([interaction('x', trigger, { type: 'back' })]) })] }]);
        assert.deepEqual(codesOf(back), ['trigger-action-mismatch']);
    }
});

test('open-link can run on while-hovering', () => {
    const d = doc([{ id: 'p', name: 'P', nodes: [frame('A', { prototype: proto([interaction('x', { type: 'while-hovering' }, { type: 'open-link', url: 'https://example.com' })]) })] }]);
    assert.deepEqual(validatePrototype(d), []);
});

test('saving is blocked by the first prototype problem, naming its page and node', () => {
    const ok = doc([{ id: 'p', name: 'P', nodes: [frame('A')] }]);
    assert.equal(saveBlockedBy(ok), null);
    const broken = doc([{ id: 'p', name: 'Screens', nodes: [frame('A', { prototype: proto([interaction('x', { type: 'on-click' }, { type: 'navigate-to', destinationId: 'Z', transition: instant })]) })] }]);
    const blocked = saveBlockedBy(broken);
    assert.equal(blocked.code, 'destination-missing');
    assert.equal(blocked.page, 'Screens');
    assert.equal(blocked.node, 'A');
});

test('assertPrototypeData with complete false still refuses a problem that is not a deferred reference', () => {
    const bad = doc([{ id: 'p', name: 'P', nodes: [frame('A', { prototype: { version: 9, interactions: [] } })] }]);
    assert.throws(() => assertPrototypeData(bad, { complete: false }), /node prototype must be version/);
});

test('deleting a flow start removes the flow, and reports it; a dangling flow is never left', () => {
    const pages = [{ id: 'p', name: 'Screens', nodes: [frame('B')], prototype: { version: 1, flows: [{ id: 'f', name: 'Main', startFrameId: 'B' }, { id: 'g', name: 'Other', startFrameId: 'C' }] } }, { id: 'q', name: 'More', nodes: [frame('C')] }];
    const plan = planNodeRemoval(pages, new Set(['B']));
    assert.deepEqual(plan.flows, [{ pageId: 'p', page: 'Screens', flowId: 'f', flowName: 'Main' }]);
    assert.deepEqual(plan.report.filter(r => r.code === 'flow-start-removed').map(r => r.flow), ['Main']);
});

const detachNodes = [
    { id: 'inst', name: 'Save', type: 'frame', parentId: null, isInstance: true, sourceId: 'main', prototype: proto([interaction('go', { type: 'on-click' }, { type: 'back' })]) },
    { id: 'inst-label', name: 'Label', type: 'text', parentId: 'inst', sourceId: 'main-label', prototype: proto([interaction('label-go', { type: 'on-click' }, { type: 'back' })]) },
    { id: 'inst-icon', name: 'iconStart', type: 'frame', parentId: 'inst', behavior: { version: 2, slot: 'iconStart' }, prototype: proto([interaction('icon-go', { type: 'on-click' }, { type: 'back' })]) },
    { id: 'inst-own', name: 'Badge', type: 'rectangle', parentId: 'inst', prototype: proto([interaction('own-go', { type: 'on-click' }, { type: 'back' })]) },
];

test('detaching an instance keeps its own interactions, and drops those on master-owned or managed layers, reporting each', () => {
    const plan = planDetach(detachNodes, 'inst');
    assert.deepEqual(plan.edits, [
        { nodeId: 'inst-label', interactions: [] },
        { nodeId: 'inst-icon', interactions: [] },
    ]);
    assert.deepEqual(plan.report.map(r => [r.code, r.node]), [['interaction-dropped-on-detach', 'Label'], ['interaction-dropped-on-detach', 'iconStart']]);
});

test('an instance with no inner interactions detaches with no edits and no report', () => {
    const plan = planDetach([{ id: 'i', name: 'I', type: 'frame', parentId: null, isInstance: true, prototype: proto([interaction('x', { type: 'on-click' }, { type: 'back' })]) }], 'i');
    assert.deepEqual(plan, { edits: [], report: [] });
});

test('a DOM mouse event becomes the pointer event the player takes, and an unknown one becomes nothing', () => {
    assert.deepEqual(eventFromDom('click', 'btn'), { type: 'pointer', nodeId: 'btn', trigger: 'on-click' });
    assert.deepEqual(eventFromDom('mouseenter', 'btn'), { type: 'pointer', nodeId: 'btn', trigger: 'mouse-enter' });
    assert.deepEqual(eventFromDom('mouseleave', 'btn'), { type: 'pointer', nodeId: 'btn', trigger: 'mouse-leave' });
    assert.deepEqual(eventFromDom('mousedown', 'btn'), { type: 'pointer', nodeId: 'btn', trigger: 'mouse-down' });
    assert.deepEqual(eventFromDom('mouseup', 'btn'), { type: 'pointer', nodeId: 'btn', trigger: 'mouse-up' });
    assert.equal(eventFromDom('keydown', 'btn'), null);
});

test('a transition becomes the CSS the runtime applies: duration and easing, with the moving transitions starting off the frame', () => {
    assert.deepEqual(transitionCss({ type: 'instant', durationMs: 0 }), { durationMs: 0, easing: 'linear', from: null });
    assert.deepEqual(transitionCss({ type: 'dissolve', durationMs: 200, easing: 'ease-in' }), { durationMs: 200, easing: 'ease-in', from: { opacity: '0' } });
    assert.deepEqual(transitionCss({ type: 'slide-in', direction: 'left', durationMs: 300, easing: 'ease-out' }), { durationMs: 300, easing: 'ease-out', from: { transform: 'translateX(-100%)' } });
    assert.deepEqual(transitionCss({ type: 'push', direction: 'top', durationMs: 250, easing: 'ease-in-out' }), { durationMs: 250, easing: 'ease-in-out', from: { transform: 'translateY(-100%)' } });
});

test('the timers a navigation schedules are keyed by node and interaction, so the runtime can clear them', () => {
    const effects = [{ type: 'navigate' }, { type: 'schedule', nodeId: 'btn', interactionId: 'go', delayMs: 800 }, { type: 'schedule', nodeId: 'x', interactionId: 'y', delayMs: 1 }];
    assert.deepEqual(timersFor(effects), [{ key: 'btn|go', nodeId: 'btn', interactionId: 'go', delayMs: 800 }, { key: 'x|y', nodeId: 'x', interactionId: 'y', delayMs: 1 }]);
});
