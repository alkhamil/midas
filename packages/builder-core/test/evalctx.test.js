import test from 'node:test';
import assert from 'node:assert/strict';
import { createEvalCtx } from '../src/evalctx.js';
import { cleanState } from '../src/state.js';

const state = () => cleanState({
    variables: [
        { id: 'items', name: 'Items', type: 'list', schema: [{ key: 'price', type: 'number' }, { key: 'status', type: 'string' }], initial: [{ price: 5, status: 'active' }, { price: 7, status: 'off' }] },
        { id: 'name', name: 'Name', type: 'string', initial: 'Ada' },
        { id: 'step', name: 'Step', type: 'option', options: ['one', 'two'], scope: 'app' },
    ],
    derived: [
        { id: 'total', name: 'total', expr: { op: 'sum', list: { op: 'var', ref: 'items' }, field: 'price' } },
        { id: 'loop', name: 'loop', expr: { op: 'var', ref: 'loop' } },
    ],
});

test('starts at the initial values and derives from them', () => {
    const c = createEvalCtx(state());
    assert.equal(c.get('name'), 'Ada');
    assert.equal(c.get('total'), 12);
    assert.equal(c.get('step'), 'one');
    assert.deepEqual([c.kind('name'), c.kind('total'), c.kind('nope')], ['state', 'derived', null]);
    assert.match(c.error('loop'), /Circular/);
    assert.equal(c.get('loop'), undefined);
});

test('set validates, recomputes derived values, and never changes derived ones', () => {
    const c = createEvalCtx(state());
    assert.deepEqual(c.set('items', [{ price: 1, status: 'a' }]), { ok: true });
    assert.equal(c.get('total'), 1);
    assert.equal(c.set('name', 5).ok, false);
    assert.equal(c.get('name'), 'Ada');
    assert.equal(c.set('step', 'three').ok, false);
    assert.match(c.set('total', 3).error, /derived/i);
    assert.match(c.set('ghost', 3).error, /Unknown/);
});

test('reset restores initial values, and a copy of them: editing does not leak into the initial', () => {
    const s = state(), c = createEvalCtx(s);
    c.get('items').push({ price: 100, status: 'x' });             // mutate what get() returned
    c.set('name', 'Bo');
    c.reset();
    assert.equal(c.get('name'), 'Ada');
    assert.equal(c.get('total'), 12);
    assert.equal(s.variables[0].initial.length, 2);
});

test('leaving a page resets page state but keeps app state', () => {
    const c = createEvalCtx(state());
    c.set('name', 'Bo');
    c.set('step', 'two');
    c.reset(['page']);
    assert.equal(c.get('name'), 'Ada');
    assert.equal(c.get('step'), 'two');
    c.reset();
    assert.equal(c.get('step'), 'one');
});

test('no state at all is fine', () => {
    const c = createEvalCtx(undefined);
    assert.equal(c.get('x'), undefined);
    assert.equal(c.has('x'), false);
});
