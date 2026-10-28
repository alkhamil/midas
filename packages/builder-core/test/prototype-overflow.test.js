import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePrototype } from '../src/prototype/validate.js';
import { addInteraction, editInteraction, removeInteraction, setOverflow, planCopiedInteractions } from '../src/prototype/plan.js';

const link = (id, destinationId) => ({ id, trigger: { type: 'on-click' }, action: { type: 'navigate-to', destinationId, transition: { type: 'instant', durationMs: 0 } } });
const frameNode = (prototype, type = 'frame') => ({ id: 'F', name: 'Frame', type, parentId: null, prototype });
const docOf = node => ({ pages: [{ id: 'p', name: 'Screens', nodes: [frameNode({ version: 1, interactions: [], ...node }), { id: 'B', name: 'B', type: 'frame', parentId: null }] }] });

test('a frame may name one of the four scroll behaviours, with or without interactions', () => {
    for (const overflow of ['none', 'horizontal', 'vertical', 'both']) {
        assert.deepEqual(validatePrototype(docOf({ overflow })), [], overflow);
    }
});

test('an unknown scroll behaviour is a problem that names the page and the frame', () => {
    const [problem] = validatePrototype(docOf({ overflow: 'diagonal' }));
    assert.deepEqual([problem.code, problem.page, problem.node], ['overflow-unknown', 'Screens', 'Frame']);
});

test('a scroll behaviour on a layer that is not a frame is a problem', () => {
    const doc = { pages: [{ id: 'p', name: 'Screens', nodes: [frameNode({ version: 1, interactions: [], overflow: 'both' }, 'rectangle')] }] };
    assert.deepEqual(validatePrototype(doc).map(p => p.code), ['overflow-not-frame']);
});

test('a node prototype with only a scroll behaviour and no interactions list is refused: the interactions list stays', () => {
    const doc = { pages: [{ id: 'p', name: 'Screens', nodes: [{ id: 'F', name: 'Frame', type: 'frame', parentId: null, prototype: { version: 1, overflow: 'both' } }] }] };
    assert.deepEqual(validatePrototype(doc).map(p => p.code), ['node-prototype-shape']);
});

test('the scroll behaviour keeps the version at 1; another version is still refused', () => {
    assert.deepEqual(validatePrototype(docOf({ overflow: 'vertical' })), []);
    assert.deepEqual(validatePrototype({ pages: [{ id: 'p', name: 'Screens', nodes: [frameNode({ version: 2, interactions: [], overflow: 'vertical' })] }] }).map(p => p.code), ['node-prototype-version']);
});

test('adding, editing and removing an interaction keeps the scroll behaviour of the frame', () => {
    const scrolled = { version: 1, interactions: [], overflow: 'horizontal' };
    const added = addInteraction(scrolled, link('a', 'B'));
    assert.deepEqual(added, { version: 1, interactions: [link('a', 'B')], overflow: 'horizontal' });
    assert.equal(editInteraction(added, 'a', { trigger: { type: 'mouse-enter' } }).overflow, 'horizontal');
    assert.deepEqual(removeInteraction(added, 'a'), { version: 1, interactions: [], overflow: 'horizontal' });
});

test('removing the last interaction of a frame with no scroll behaviour leaves no prototype data', () => {
    assert.equal(removeInteraction({ version: 1, interactions: [link('a', 'B')] }, 'a'), undefined);
});

test('setting a scroll behaviour stores it, keeps the interactions, and removes it again for none', () => {
    const set = setOverflow({ version: 1, interactions: [link('a', 'B')] }, 'both');
    assert.deepEqual(set, { version: 1, interactions: [link('a', 'B')], overflow: 'both' });
    assert.deepEqual(setOverflow(set, 'none'), { version: 1, interactions: [link('a', 'B')] });
});

test('setting none on a frame with nothing else leaves no prototype data, and an unknown value is refused', () => {
    assert.equal(setOverflow(undefined, 'none'), undefined);
    assert.deepEqual(setOverflow(undefined, 'vertical'), { version: 1, interactions: [], overflow: 'vertical' });
    assert.throws(() => setOverflow(undefined, 'diagonal'), /Unknown scroll behaviour "diagonal"/);
});

test('copying a frame copies its scroll behaviour, even when its interactions are all dropped', () => {
    const copied = planCopiedInteractions({ prototype: { version: 1, interactions: [link('a', 'gone')], overflow: 'vertical' }, exists: () => false });
    assert.deepEqual(copied.prototype, { version: 1, interactions: [], overflow: 'vertical' });
    assert.deepEqual(copied.dropped.map(d => d.code), ['interaction-dropped']);
});

test('a template instance cannot have a scroll behaviour: the validator names the page and the node', () => {
    const instance = { id: 'I', name: 'Card', type: 'frame', parentId: null, isInstance: true, sourceId: 'M', prototype: { version: 1, interactions: [], overflow: 'both' } };
    const [problem] = validatePrototype({ pages: [{ id: 'p', name: 'Screens', nodes: [instance] }] });
    assert.deepEqual([problem.code, problem.page, problem.node], ['overflow-on-instance', 'Screens', 'Card']);
});

test('an instance with no scroll behaviour is valid', () => {
    const instance = { id: 'I', name: 'Card', type: 'frame', parentId: null, isInstance: true, sourceId: 'M', prototype: { version: 1, interactions: [] } };
    assert.deepEqual(validatePrototype({ pages: [{ id: 'p', name: 'Screens', nodes: [instance] }] }), []);
});
