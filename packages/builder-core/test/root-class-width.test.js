import test from 'node:test';
import assert from 'node:assert/strict';
import { rootClassWidth } from '../src/behavior-engine/layout.js';

// The component class carries the master's width only for a fixed master with no width variable: an instance that fills or hugs must not
// inherit it (the Alert's 400px master made every instance 400px in Play). Play and the export read this one rule.
test('a fixed master without a width variable gives the component class its width', () => {
    assert.equal(rootClassWidth({ layoutSizingH: 'fixed', w: 400 }), 400);
});

test('a hugging or filling master, or one bound to a width variable, gives no class width', () => {
    assert.equal(rootClassWidth({ layoutSizingH: 'hug', w: 400 }), null);
    assert.equal(rootClassWidth({ layoutSizingH: 'fill', w: 400 }), null);
    assert.equal(rootClassWidth({ layoutSizingH: 'fixed', w: 400, vars: { w: 'var-1' } }), null);
});

test('a fixed master with no width gives no class width', () => {
    assert.equal(rootClassWidth({ layoutSizingH: 'fixed', w: 0 }), null);
});
