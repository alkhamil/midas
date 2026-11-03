// The committed base snapshot: what the build script wrote from the token JSON plus the antd size scale, pinned so
// the studio can rely on the bundled data instead of the token file. Counts equal the importer's output (3 collections,
// 304 variables, 15 derived, 0 needs value, 0 unresolved, 0 renamed: the rebuild starts from sanitary names, so the
// rename provenance of the first import is not carried). The Size scale follows antd-ref, not the JSON: there is no
// Size collection and no JSON-based size mapping left. Line heights are px paired to the JSON Typography table; antd
// supplies the names only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_SNAPSHOT, planFromSnapshot, applyBasePlan } from '../src/index.js';

test('the snapshot holds three collections with their modes', () => {
    const plan = planFromSnapshot(BASE_SNAPSHOT);
    assert.deepEqual(plan.collections.map(c => [c.name, c.modes]), [
        ['Primitives', ['Base']],
        ['Semantic', ['Light', 'Dark']],
        ['Typography', ['Mode 1']],
    ]);
});

test('the snapshot plus the text styles: 336 variables with the known report', () => {
    const plan = planFromSnapshot(BASE_SNAPSHOT);
    const per = {};
    for (const i of plan.items) per[i.collection] = (per[i.collection] || 0) + 1;
    assert.deepEqual(per, { Primitives: 203, Typography: 31, Semantic: 102 });
    assert.equal(plan.items.length, 336);
    assert.deepEqual(plan.report.derived.map(d => d.name), [
        'Primitives/transparent',
        'Semantic/controlHeightXL',
        'Semantic/fontSizeXS',
        'Semantic/lineHeightXS',
        'Semantic/lineHeightHeading1',
        'Semantic/lineHeightHeading2',
        'Semantic/borderRadiusXL',
        'Semantic/paddingXxs',
        'Primitives/size/15',
        'Semantic/buttonPaddingXxl',
        'Semantic/inputPaddingXxl',
        'Semantic/paddingYxs',
        'Semantic/buttonPaddingYxl',
        'Primitives/size/9',
        'Semantic/inputPaddingYxl',
        'Semantic/clearIconSizeXS',
        'Semantic/clearIconSizeSM',
        'Semantic/clearIconSizeMD',
        'Semantic/clearIconSizeLG',
        'Semantic/clearIconSizeXL',
        'Primitives/heading/1',
        'Primitives/heading/2',
    ]);
    assert.deepEqual(plan.report.needsValue, []);
    assert.deepEqual(plan.report.unresolved, []);
    assert.deepEqual(plan.report.renamed, []);
});

test('single-step size tokens carry the MD suffix, with no unsuffixed leftover', () => {
    const plan = planFromSnapshot(BASE_SNAPSHOT);
    const names = new Set(plan.items.filter(i => i.collection === 'Semantic').map(i => i.name));
    for (const name of ['controlHeightMD', 'fontSizeMD', 'lineHeightMD', 'borderRadiusMD', 'clearIconSizeMD']) {
        assert.ok(names.has(name), `Semantic/${name} exists`);
    }
    for (const name of ['controlHeight', 'fontSize', 'lineHeight', 'borderRadius', 'clearIconSize']) {
        assert.ok(!names.has(name), `Semantic/${name} is gone`);
    }
    const byName = Object.fromEntries(plan.items.filter(i => i.collection === 'Semantic').map(i => [i.name, i]));
    assert.equal(byName.controlHeightMD.values.Light.alias.name, 'size/32');
    assert.equal(byName.fontSizeMD.values.Light.alias.name, 'size/14');
    assert.equal(byName.borderRadiusMD.values.Light.alias.name, 'radius/6');
});

test('the gap and padding scales have five suffixed steps each', () => {
    const plan = planFromSnapshot(BASE_SNAPSHOT);
    const names = new Set(plan.items.filter(i => i.collection === 'Semantic').map(i => i.name));
    const byName = Object.fromEntries(plan.items.filter(i => i.collection === 'Semantic').map(i => [i.name, i]));
    for (const name of ['gapXS', 'gapSM', 'gapMD', 'gapLG', 'gapXL', 'paddingXS', 'paddingSM', 'paddingMD', 'paddingLG', 'paddingXL']) {
        assert.ok(names.has(name), `Semantic/${name} exists`);
    }
    for (const name of ['gap', 'padding', 'gapXXS']) {
        assert.ok(!names.has(name), `Semantic/${name} is gone`);
    }
    assert.deepEqual([byName.gapXS, byName.gapSM, byName.gapMD, byName.gapLG, byName.gapXL].map(i => i.values.Light.alias.name),
        ['size/4', 'size/6', 'size/8', 'size/8', 'size/10']);
    assert.deepEqual([byName.paddingXS, byName.paddingSM, byName.paddingMD, byName.paddingLG, byName.paddingXL].map(i => i.values.Light.alias.name),
        ['size/8', 'size/12', 'size/16', 'size/20', 'size/24']);
    const prim6 = plan.items.find(i => i.collection === 'Primitives' && i.name === 'size/6');
    assert.equal(prim6.values.Base.literal, 6);
});

test('Semantic holds the antd size scale as aliases, no literals', () => {
    const plan = planFromSnapshot(BASE_SNAPSHOT);
    assert.equal(plan.items.filter(i => i.collection === 'Semantic' && i.type === 'number').length, 57, 'the size scale is present');
    for (const item of plan.items.filter(i => i.collection === 'Semantic')) {
        for (const value of Object.values(item.values)) {
            assert.ok(value.alias && !value.needsValue, `${item.name} aliases a base step`);
        }
    }
    const byName = Object.fromEntries(plan.items.filter(i => i.collection === 'Semantic').map(i => [i.name, i]));
    assert.equal(byName.controlHeightMD.values.Light.alias.name, 'size/32');
    assert.equal(byName.fontSizeMD.values.Light.alias.name, 'size/14');
    assert.equal(byName.borderRadiusMD.values.Light.alias.name, 'radius/6');
    assert.equal(byName.paddingMD.values.Light.alias.name, 'size/16');
    const prim32 = plan.items.find(i => i.collection === 'Primitives' && i.name === 'size/32');
    assert.equal(prim32.values.Base.literal, 32);
});

test('Semantic line heights alias the paired JSON Typography step in px', () => {
    const plan = planFromSnapshot(BASE_SNAPSHOT);
    const ty = Object.fromEntries(plan.items.filter(i => i.collection === 'Typography').map(i => [i.name, i.values['Mode 1'].literal]));
    const pairs = {
        lineHeightXS: ['font/line-height/10', 12],
        lineHeightSM: ['font/line-height/12', 16],
        lineHeightMD: ['font/line-height/14', 20],
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
    assert.deepEqual(first, { collections: 3, items: 336, modes: 4, aliases: 204 });
    assert.deepEqual(applyBasePlan(store, planFromSnapshot(BASE_SNAPSHOT), () => `id${++n}`), { collections: 0, items: 0, modes: 0, aliases: 0 });
});

test('planFromSnapshot rejects garbage with an explicit error', () => {
    for (const bad of [null, [], {}, { collections: [], items: [], report: null }, { collections: [{ name: 'X' }], items: [], report: {} }]) {
        assert.throws(() => planFromSnapshot(bad), /Base snapshot/, JSON.stringify(bad));
    }
});

test('Generate base on an empty file yields the new tokens', () => {
    const store = { collections: [], items: [] };
    let n = 0;
    applyBasePlan(store, planFromSnapshot(BASE_SNAPSHOT), () => `id${++n}`);
    assert.deepEqual(store.collections.map(c => c.name), ['Primitives', 'Semantic', 'Typography']);
    const has = (coll, name) => {
        const c = store.collections.find(x => x.name === coll);
        return store.items.some(i => i.collectionId === c.id && i.name === name);
    };
    for (const name of ['paddingXxs', 'paddingXsm', 'buttonPaddingXmd', 'buttonPaddingXlg', 'buttonPaddingXxl',
        'inputPaddingXmd', 'inputPaddingXlg', 'inputPaddingXxl', 'paddingYxs', 'paddingYsm',
        'buttonPaddingYmd', 'buttonPaddingYlg', 'buttonPaddingYxl', 'inputPaddingYmd', 'inputPaddingYlg', 'inputPaddingYxl',
        'gapXS', 'gapSM', 'gapMD', 'gapLG', 'gapXL',
        'paddingXS', 'paddingSM', 'paddingMD', 'paddingLG', 'paddingXL',
        'colorTransparent', 'colorTextLightSolid', 'colorPrimaryHover', 'colorPrimaryActive',
        'colorErrorHover', 'colorErrorActive', 'colorWarningHover',
        'colorPrimaryOutline', 'colorErrorOutline', 'colorWarningOutline',
        'colorBgContainerDisabled', 'colorPrimaryBg', 'colorPrimaryBgHover', 'colorErrorBg', 'colorErrorBgHover']) {
        assert.ok(has('Semantic', name), `Semantic/${name} exists`);
    }
    assert.ok(has('Primitives', 'transparent'), 'Primitives/transparent exists');
    assert.ok(!store.collections.some(c => c.name === 'Icons' || c.name === 'Size'), 'no Icons or Size collection');
});

test('Semantic names are unique case-insensitively', () => {
    const plan = planFromSnapshot(BASE_SNAPSHOT);
    const names = plan.items.filter(i => i.collection === 'Semantic').map(i => i.name.toLowerCase());
    assert.equal(names.length, new Set(names).size, 'no two Semantic names differ by case only');
    assert.equal(names.filter(n => n === 'paddingxxs').length, 1, 'only paddingXxs remains: generic paddingXXS is dropped as a case-only collision');
});

test('every colour literal is hex, with its opacity in the hex (#rrggbbaa): the studio reads no rgba text', () => {
    const colours = BASE_SNAPSHOT.items.filter(i => i.type === 'color');
    const literals = colours.flatMap(i => Object.values(i.values).map(v => v.literal)).filter(l => l !== undefined);
    assert.ok(literals.length > 0);
    for (const l of literals) assert.match(l, /^#[\da-f]{6}([\da-f]{2})?$/i, `${l} is not a hex colour`);
    const disabled = colours.find(i => i.name === 'primary/disabled-10pct');
    assert.equal(disabled.values.Base.literal, '#1254821a');
});
