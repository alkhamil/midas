// Base-mode backfill: a file whose Semantic collection predates the Light/Dark split (a single Base mode, like the
// fixture lineage) gains Light and Dark modes when Generate base runs — but the snapshot's named items arrive with
// Light/Dark values only. Nothing then reads Base: Play and the export report no-value-in-mode and drop every
// component whose chain reaches a named item, while the canvas (which falls back across modes) still draws it.
// Applying a base plan fills the collection modes the plan does not name from the plan's first mode, so the default
// reading mode always resolves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyBasePlan, planFromSnapshot, BASE_SNAPSHOT, planAutoFix, applyAutoFix } from '../src/index.js';
import { valueIn } from '../src/behavior-engine/tokens.js';

let n = 0;
const uid = () => `id${++n}`;

// A Semantic collection from the fixture lineage: one Base mode, literal aliases carrying base values.
const hybridStarter = () => ({
    collections: [{ id: 'sem', name: 'Semantic', modes: [{ id: 'base', name: 'Base' }] }],
    items: [{ id: 'lit', collectionId: 'sem', name: 'color/literal-1', type: 'color', values: { base: { alias: 'p1' } } }],
});

const plan = () => planFromSnapshot(BASE_SNAPSHOT);
const byName = (store, name) => store.items.find(i => i.name === name);
const semId = store => store.collections.find(c => c.name === 'Semantic').id;
const modeId = (store, name) => store.collections.find(c => c.name === 'Semantic').modes.find(m => m.name === name).id;

test('applyBasePlan fills a pre-existing Base mode from the plan first mode', () => {
    const store = hybridStarter();
    applyBasePlan(store, plan(), uid);
    const sem = semId(store);
    assert.deepEqual(store.collections.find(c => c.id === sem).modes.map(m => m.name), ['Base', 'Light', 'Dark']);
    const track = byName(store, 'switchTrackHeight');
    assert.ok(track, 'the snapshot item is created');
    const light = track.values[modeId(store, 'Light')];
    assert.ok(light?.alias, 'the plan value lands under Light');
    assert.deepEqual(track.values[modeId(store, 'Base')], light, 'Base reads the plan first-mode value');
    assert.ok(track.values[modeId(store, 'Dark')]?.alias, 'Dark keeps its own value');
    const lit = byName(store, 'color/literal-1');
    assert.deepEqual(Object.keys(lit.values), ['base'], 'a literal keeps only its own base value');
});

test('the backfill is idempotent: a second run writes nothing', () => {
    const store = hybridStarter();
    applyBasePlan(store, plan(), uid);
    const stats = applyBasePlan(store, plan(), uid);
    assert.deepEqual(stats, { collections: 0, items: 0, modes: 0, aliases: 0 });
});

test('after the backfill the token resolver reads Base instead of reporting no-value-in-mode', () => {
    const store = hybridStarter();
    applyBasePlan(store, plan(), uid);
    const baseOf = new Map(store.collections.map(c => [c.id, c.modes.find(m => m.name === 'Base')?.id ?? null]));
    const track = byName(store, 'switchTrackHeight');
    const out = valueIn(track, collectionId => baseOf.get(collectionId) ?? null, store.items);
    assert.ok(!out.reason, `expected a value, got ${out.reason}`);
});

test('applyAutoFixPlan fills Base on the base items it creates', () => {
    const template = {
        id: 'mini', name: 'Mini',
        props: { variant: { source: 'variable', collection: 'Variant', modes: ['a'] } },
        tokens: { fromVariant: ['bg'] },
        tokenKinds: { bg: 'color' },
        tokenRoles: { bg: 'bg' },
    };
    const store = hybridStarter();
    const binding = { version: 2, templateId: 'mini', variables: { variant: null } };
    const fix = planAutoFix({ template, binding, variables: store, layers: [] });
    assert.equal(fix.fixable, true);
    applyAutoFix(store, binding, fix, uid);
    const sem = store.collections.find(c => c.name === 'Semantic');
    assert.deepEqual(sem.modes.map(m => m.name), ['Base', 'Light', 'Dark']);
    const target = store.items.find(i => i.name === 'colorBgContainer');
    assert.ok(target, 'the base role item is created');
    const baseId = sem.modes.find(m => m.name === 'Base').id;
    const lightId = sem.modes.find(m => m.name === 'Light').id;
    assert.ok(target.values[lightId]?.alias, 'the plan value lands under Light');
    assert.deepEqual(target.values[baseId], target.values[lightId], 'Base reads the plan first-mode value');
});
