// The Breadcrumb's row: first and last items always show; with Truncated, the items between them are hidden, the separator before
// the first hidden item stays (it sits before the ellipsis), and the last separator stays before the last item.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { betweenPlan } from '../src/behavior-engine/box-between.js';

test('no truncation: every item and every gap shows, no ellipsis', () => {
    const p = betweenPlan(3, { truncated: false });
    assert.deepEqual(p.items.map(i => i.visible), [true, true, true]);
    assert.deepEqual(p.gaps.map(g => g.visible), [false, true, true], 'gap 0 is not a gap');
    assert.equal(p.ellipsis, false);
    assert.deepEqual(p.hidden, []);
});

test('truncated with three items: the middle one hides, an ellipsis sits after the first gap', () => {
    const p = betweenPlan(3, { truncated: true });
    assert.deepEqual(p.items.map(i => i.visible), [true, false, true]);
    assert.equal(p.ellipsis, true);
    assert.deepEqual(p.hidden, [1]);
});

test('truncated with four items: items 1 and 2 hide, the gap between them hides, the ellipsis holds the place', () => {
    const p = betweenPlan(4, { truncated: true });
    assert.deepEqual(p.items.map(i => i.visible), [true, false, false, true]);
    assert.deepEqual(p.gaps.map(g => g.visible), [false, true, false, true]);
    assert.deepEqual(p.hidden, [1, 2]);
});

test('truncated with two items or fewer: nothing to hide, no ellipsis', () => {
    for (const n of [0, 1, 2]) {
        const p = betweenPlan(n, { truncated: true });
        assert.equal(p.ellipsis, false, `n=${n}`);
        assert.deepEqual(p.hidden, [], `n=${n}`);
    }
});
