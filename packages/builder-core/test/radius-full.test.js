// The full radius: Semantic/borderRadiusFull aliases the Primitive radius/full (9999) in both modes, so a template reaches it through Semantic like every
// other radius. Every surface clamps a radius to half the shorter side, so 9999 on a square box is a circle (see circle-radius.test.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_SNAPSHOT, planFromSnapshot } from '../src/index.js';
import ROLES from '../src/base-tokens/roles.json' with { type: 'json' };
import SIZES from '../src/base-tokens/antd-sizes.json' with { type: 'json' };

test('the snapshot holds Semantic/borderRadiusFull, an alias of Primitives/radius/full in both modes', () => {
    const item = BASE_SNAPSHOT.items.find(i => i.collection === 'Semantic' && i.name === 'borderRadiusFull');
    assert.ok(item, 'Semantic/borderRadiusFull exists');
    assert.equal(item.type, 'number');
    assert.deepEqual(Object.keys(item.values).sort(), ['Dark', 'Light']);
    for (const value of Object.values(item.values)) assert.deepEqual(value, { alias: { collection: 'Primitives', name: 'radius/full' } });
    const primitive = BASE_SNAPSHOT.items.find(i => i.collection === 'Primitives' && i.name === 'radius/full');
    assert.deepEqual(primitive.values, { Base: { literal: 9999 } });
});

test('the radius-full role points at it, and the size table names its primitive', () => {
    assert.deepEqual(ROLES['radius-full'], { base: 'Semantic/borderRadiusFull' });
    assert.equal(SIZES.borderRadiusFull.primitive, 'radius/full');
    assert.equal(SIZES.borderRadiusFull.value, 9999);
});

test('the plan holds the full radius and the two effects as Semantic items', () => {
    const per = {};
    for (const i of planFromSnapshot(BASE_SNAPSHOT).items) per[i.collection] = (per[i.collection] || 0) + 1;
    assert.equal(per.Semantic, 115);
});
