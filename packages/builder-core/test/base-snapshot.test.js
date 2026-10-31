// The committed base snapshot: what the build script wrote from the token JSON, pinned so the studio can rely on
// the bundled data instead of the token file. Counts equal the importer's output for the real JSON (5 collections,
// 281 variables, 5 derived, 0 needs value, 0 unresolved, 21 renamed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_SNAPSHOT, planFromSnapshot, applyBasePlan } from '../src/index.js';

test('the snapshot holds the five source collections with their modes', () => {
    const plan = planFromSnapshot(BASE_SNAPSHOT);
    assert.deepEqual(plan.collections.map(c => [c.name, c.modes]), [
        ['Primitives', ['Base']],
        ['Semantic', ['Light', 'Dark']],
        ['Size', ['small', 'middle', 'large']],
        ['Typography', ['Mode 1']],
        ['Icons', ['Base']],
    ]);
});

test('the snapshot equals the importer output: 281 variables with the known report', () => {
    const plan = planFromSnapshot(BASE_SNAPSHOT);
    const per = {};
    for (const i of plan.items) per[i.collection] = (per[i.collection] || 0) + 1;
    assert.deepEqual(per, { Primitives: 185, Typography: 31, Semantic: 15, Size: 18, Icons: 32 });
    assert.equal(plan.items.length, 281);
    assert.deepEqual(plan.report.derived.map(d => d.name), ['Size/controlHeightLG', 'Size/borderRadiusXS', 'Size/borderRadiusSM', 'Size/borderRadiusLG', 'Size/marginSM']);
    assert.deepEqual(plan.report.needsValue, []);
    assert.deepEqual(plan.report.unresolved, []);
    assert.equal(plan.report.renamed.length, 21);
});

test('the snapshot plan applies and a second run is a no-op', () => {
    const store = { collections: [], items: [] };
    let n = 0;
    const first = applyBasePlan(store, planFromSnapshot(BASE_SNAPSHOT), () => `id${++n}`);
    assert.deepEqual(first, { collections: 5, items: 281, modes: 8, aliases: 94 });
    assert.deepEqual(applyBasePlan(store, planFromSnapshot(BASE_SNAPSHOT), () => `id${++n}`), { collections: 0, items: 0, modes: 0, aliases: 0 });
});

test('planFromSnapshot rejects garbage with an explicit error', () => {
    for (const bad of [null, [], {}, { collections: [], items: [], report: null }, { collections: [{ name: 'X' }], items: [], report: {} }]) {
        assert.throws(() => planFromSnapshot(bad), /Base snapshot/, JSON.stringify(bad));
    }
});
