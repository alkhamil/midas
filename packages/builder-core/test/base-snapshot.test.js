// The committed base snapshot: what the build script wrote from the token JSON plus the antd size scale, pinned so
// the studio can rely on the bundled data instead of the token file. Counts equal the importer's output (4 collections,
// 303 variables, 9 derived, 0 needs value, 0 unresolved, 21 renamed). The Size scale follows antd-ref, not the JSON:
// there is no Size collection and no JSON-based size mapping left.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_SNAPSHOT, planFromSnapshot, applyBasePlan } from '../src/index.js';

test('the snapshot holds four collections with their modes', () => {
    const plan = planFromSnapshot(BASE_SNAPSHOT);
    assert.deepEqual(plan.collections.map(c => [c.name, c.modes]), [
        ['Primitives', ['Base']],
        ['Semantic', ['Light', 'Dark']],
        ['Typography', ['Mode 1']],
        ['Icons', ['Base']],
    ]);
});

test('the snapshot equals the importer output: 303 variables with the known report', () => {
    const plan = planFromSnapshot(BASE_SNAPSHOT);
    const per = {};
    for (const i of plan.items) per[i.collection] = (per[i.collection] || 0) + 1;
    assert.deepEqual(per, { Primitives: 190, Typography: 31, Semantic: 50, Icons: 32 });
    assert.equal(plan.items.length, 303);
    assert.deepEqual(plan.report.derived.map(d => d.name), [
        'Semantic/controlHeightXL',
        'Semantic/fontSizeXS',
        'Primitives/size/1.8',
        'Semantic/lineHeightXS',
        'Primitives/size/1.6667',
        'Primitives/size/1.5714',
        'Primitives/size/1.5',
        'Primitives/size/1.4',
        'Semantic/borderRadiusXL',
    ]);
    assert.deepEqual(plan.report.needsValue, []);
    assert.deepEqual(plan.report.unresolved, []);
    assert.equal(plan.report.renamed.length, 21);
});

test('Semantic holds the antd size scale as aliases to Primitives steps, no literals', () => {
    const plan = planFromSnapshot(BASE_SNAPSHOT);
    assert.equal(plan.items.filter(i => i.collection === 'Semantic' && i.type === 'number').length, 35, 'the size scale is present');
    for (const item of plan.items.filter(i => i.collection === 'Semantic')) {
        for (const value of Object.values(item.values)) {
            assert.ok(value.alias && !value.needsValue, `${item.name} aliases a Primitives step`);
        }
    }
    const byName = Object.fromEntries(plan.items.filter(i => i.collection === 'Semantic').map(i => [i.name, i]));
    assert.equal(byName.controlHeight.values.Light.alias.name, 'size/32');
    assert.equal(byName.fontSize.values.Light.alias.name, 'size/14');
    assert.equal(byName.borderRadius.values.Light.alias.name, 'radius/6');
    assert.equal(byName.padding.values.Light.alias.name, 'size/16');
    const prim32 = plan.items.find(i => i.collection === 'Primitives' && i.name === 'size/32');
    assert.equal(prim32.values.Base.literal, 32);
});

test('the snapshot plan applies and a second run is a no-op', () => {
    const store = { collections: [], items: [] };
    let n = 0;
    const first = applyBasePlan(store, planFromSnapshot(BASE_SNAPSHOT), () => `id${++n}`);
    assert.deepEqual(first, { collections: 4, items: 303, modes: 5, aliases: 110 });
    assert.deepEqual(applyBasePlan(store, planFromSnapshot(BASE_SNAPSHOT), () => `id${++n}`), { collections: 0, items: 0, modes: 0, aliases: 0 });
});

test('planFromSnapshot rejects garbage with an explicit error', () => {
    for (const bad of [null, [], {}, { collections: [], items: [], report: null }, { collections: [{ name: 'X' }], items: [], report: {} }]) {
        assert.throws(() => planFromSnapshot(bad), /Base snapshot/, JSON.stringify(bad));
    }
});
