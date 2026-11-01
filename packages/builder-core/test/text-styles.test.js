// The Semantic text styles: typography Primitives with literal members, Semantic styles that alias them whole, and what a style
// resolves to once the base is applied (Light and Dark read the same Primitive).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_SNAPSHOT, applyBasePlan, planFromSnapshot } from '../src/index.js';
import { typographyOf } from '../src/behavior-engine/typography.js';

const plan = planFromSnapshot(BASE_SNAPSHOT);
const typographyItems = plan.items.filter(i => i.type === 'typography');

test('the text styles are 15 typography Primitives and 15 Semantic aliases of them', () => {
    const prims = typographyItems.filter(i => i.collection === 'Primitives');
    const sem = typographyItems.filter(i => i.collection === 'Semantic');
    assert.equal(prims.length, 15);
    assert.equal(sem.length, 15);
    for (const s of sem) {
        for (const mode of ['Light', 'Dark']) assert.equal(s.values[mode].alias.collection, 'Primitives', `${s.name} ${mode}`);
    }
});

test('every text Primitive is literal px, with a named weight and no ratio line height', () => {
    for (const p of typographyItems.filter(i => i.collection === 'Primitives')) {
        const v = p.values.Base.literal;
        assert.equal(v.fontFamily, 'Inter', p.name);
        assert.ok(['Regular', 'SemiBold'].includes(v.fontWeight), `${p.name} weight ${v.fontWeight}`);
        assert.ok(v.lineHeight >= 4, `${p.name} line height ${v.lineHeight} is a ratio`);
    }
});

test('applied, textBase resolves to Inter 14/20 Regular in Light and Dark, and textBaseStrong to SemiBold', () => {
    const store = { collections: [], items: [] };
    let n = 0;
    applyBasePlan(store, plan, () => `id${++n}`);
    const modeOf = name => collection => collection.modes.find(m => m.name === name)?.id;
    const item = name => store.items.find(i => i.name === name && i.type === 'typography' && store.collections.find(c => c.id === i.collectionId).name === 'Semantic');
    for (const mode of ['Light', 'Dark']) {
        const out = typographyOf(store, item('textBase'), modeOf(mode));
        assert.deepEqual(out, { style: { fontFamily: 'Inter', fontSize: 14, fontWeight: 'Regular', lineHeight: 20, letterSpacing: 0 }, problems: [] }, mode);
        assert.equal(typographyOf(store, item('textBaseStrong'), modeOf(mode)).style.fontWeight, 'SemiBold');
    }
});

test('heading1 resolves to 38/40 SemiBold: the nearest lower Typography step, flagged derived in the report', () => {
    const store = { collections: [], items: [] };
    let n = 0;
    applyBasePlan(store, plan, () => `id${++n}`);
    const modeOf = name => collection => collection.modes.find(m => m.name === name)?.id;
    const h1 = store.items.find(i => i.name === 'heading1');
    assert.equal(typographyOf(store, h1, modeOf('Light')).style.lineHeight, 40);
    assert.ok(plan.report.derived.some(d => d.name === 'Primitives/heading/1'));
});
