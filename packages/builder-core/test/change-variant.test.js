import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAction, resolveMotion, ACTION_MAP, VARIANT_TRANSITIONS } from '../src/behavior.js';

test('Change variant keeps only the properties that were picked', () => {
    const a = normalizeAction({ type: 'change-variant', variants: { State: 'Hover', Size: '', Tone: null, Icon: 'on' } });
    assert.equal(a.type, 'change-variant');
    assert.deepEqual(a.variants, { State: 'Hover', Icon: 'on' });
});

test('Change variant without a pick has no variants key', () => {
    assert.equal(normalizeAction({ type: 'change-variant', variants: { State: '' } }).variants, undefined);
    assert.equal(normalizeAction({ type: 'change-variant' }).variants, undefined);
});

test('Change variant defaults to Smart animate and keeps its motion', () => {
    assert.ok(ACTION_MAP['change-variant']);
    assert.equal(resolveMotion(null, 'change-variant').transition, 'smart-animate');
    const a = normalizeAction({ type: 'change-variant', variants: { State: 'Hover' }, transition: 'instant', duration: 90, easing: 'linear' });
    assert.deepEqual([a.transition, a.duration, a.easing], ['instant', 90, 'linear']);
    assert.deepEqual(VARIANT_TRANSITIONS.map(t => t.id), ['smart-animate', 'dissolve', 'instant']);
});

test('other actions do not carry variants', () => {
    assert.equal(normalizeAction({ type: 'navigate', variants: { State: 'Hover' } }).variants, undefined);
});
