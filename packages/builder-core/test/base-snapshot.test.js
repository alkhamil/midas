// The committed base snapshot: what the build script wrote from the token JSON plus the antd size scale, pinned so
// the studio can rely on the bundled data instead of the token file. Counts equal the importer's output (4 collections,
// 303 variables, 6 derived, 0 needs value, 0 unresolved, 21 renamed). The Size scale follows antd-ref, not the JSON:
// there is no Size collection and no JSON-based size mapping left. Line heights are px paired to the JSON Typography
// table; antd supplies the names only.
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
    assert.deepEqual(per, { Primitives: 185, Typography: 31, Semantic: 55, Icons: 32 });
    assert.equal(plan.items.length, 303);
    assert.deepEqual(plan.report.derived.map(d => d.name), [
        'Semantic/controlHeightXL',
        'Semantic/fontSizeXS',
        'Semantic/lineHeightXS',
        'Semantic/lineHeightHeading1',
        'Semantic/lineHeightHeading2',
        'Semantic/borderRadiusXL',
    ]);
    assert.deepEqual(plan.report.needsValue, []);
    assert.deepEqual(plan.report.unresolved, []);
    assert.equal(plan.report.renamed.length, 21);
});

test('Semantic holds the antd size scale as aliases, no literals', () => {
    const plan = planFromSnapshot(BASE_SNAPSHOT);
    assert.equal(plan.items.filter(i => i.collection === 'Semantic' && i.type === 'number').length, 40, 'the size scale is present');
    for (const item of plan.items.filter(i => i.collection === 'Semantic')) {
        for (const value of Object.values(item.values)) {
            assert.ok(value.alias && !value.needsValue, `${item.name} aliases a base step`);
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

test('Semantic line heights alias the paired JSON Typography step in px', () => {
    const plan = planFromSnapshot(BASE_SNAPSHOT);
    const ty = Object.fromEntries(plan.items.filter(i => i.collection === 'Typography').map(i => [i.name, i.values['Mode 1'].literal]));
    const pairs = {
        lineHeightXS: ['font/line-height/10', 12],
        lineHeightSM: ['font/line-height/12', 16],
        lineHeight: ['font/line-height/14', 20],
        lineHeightLG: ['font/line-height/16', 24],
        lineHeightXL: ['font/line-height/20', 28],
        lineHeightHeading1: ['font/line-height/32', 40],
        lineHeightHeading2: ['font/line-height/24', 32],
        lineHeightHeading3: ['font/line-height/24', 32],
        lineHeightHeading4: ['font/line-height/20', 28],
        lineHeightHeading5: ['font/line-height/16', 24],
    };
    for (const [name, [step, px]] of Object.entries(pairs)) {
        const item = plan.items.find(i => i.collection === 'Semantic' && i.name === name);
        assert.ok(item, `${name} exists`);
        for (const mode of ['Light', 'Dark']) assert.deepEqual(item.values[mode], { alias: { collection: 'Typography', name: step } }, `${name}.${mode}`);
        assert.equal(ty[step], px, `${step} is ${px}px`);
    }
});

test('no ratio leftover survives, and legitimate small JSON values stay', () => {
    const plan = planFromSnapshot(BASE_SNAPSHOT);
    assert.deepEqual(plan.items.filter(i => i.collection === 'Primitives' && /^size\/1\./.test(i.name)), [], 'no size/1.x primitives');
    for (const item of plan.items.filter(i => i.collection === 'Typography' && i.name.startsWith('font/line-height/'))) {
        assert.ok(item.values['Mode 1'].literal >= 10, `${item.name} is a px value`);
    }
    for (const name of ['stroke/1.5', 'stroke/1.25', 'size/5.5']) {
        assert.ok(plan.items.some(i => i.collection === 'Primitives' && i.name === name), `${name} kept`);
    }
});

test('the snapshot plan applies and a second run is a no-op', () => {
    const store = { collections: [], items: [] };
    let n = 0;
    const first = applyBasePlan(store, planFromSnapshot(BASE_SNAPSHOT), () => `id${++n}`);
    assert.deepEqual(first, { collections: 4, items: 303, modes: 5, aliases: 120 });
    assert.deepEqual(applyBasePlan(store, planFromSnapshot(BASE_SNAPSHOT), () => `id${++n}`), { collections: 0, items: 0, modes: 0, aliases: 0 });
});

test('planFromSnapshot rejects garbage with an explicit error', () => {
    for (const bad of [null, [], {}, { collections: [], items: [], report: null }, { collections: [{ name: 'X' }], items: [], report: {} }]) {
        assert.throws(() => planFromSnapshot(bad), /Base snapshot/, JSON.stringify(bad));
    }
});
