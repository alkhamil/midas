// Base token importer: parser, resolver, plan builder and applier. The fixture is inline so the tests never touch
// the real token JSON on disk; behavior against the real file is covered by the generator smoke run in the report.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTokenJson, resolveTokenRefs, buildBasePlan, applyBasePlan, sanitizeTokenName, SOURCE_ORDER, ANT_MAP } from '../src/base-tokens/importer.js';
import { variableValue } from '../src/behavior-engine/variable-value.js';

const color = value => ({ $type: 'color', $value: value });
const num = value => ({ $type: 'float', $value: value });
const MINI = [
    { Primitives: { modes: { Base: {
        white: color('#ffffff'),
        neutral: { 900: color('#101828') },
        clay: { 500: color('#b0713c') },
        spacing: { 8: num(8), 16: num(16) },
        'odd-name': { '1,5': num(1.5), 'off-5%': num(0.05) },
    } } } },
    { Primitives: { modes: { Extra: { plus: num(1) } } } },
    { Semantic: { modes: {
        Light: {
            text: { primary: color('{neutral.900}'), chain: color('{text.primary}') },
            bg: { brand: color('{brand.500}') },
            brand: { 500: color('#00487a') },
        },
        Dark: {
            text: { primary: color('{white}') },
            bg: { brand: color('{brand.500}') },
            brand: { 500: color('#2b80af') },
        },
    } } },
    { Size: { modes: {
        sm: { gap: num('{spacing.8}') },
        md: { gap: num('{spacing.16}') },
    } } },
    { Typography: { modes: { 'Mode 1': { font: { 'line height': { 12: num(12) } } } } } },
    { 'Size icons': { modes: { Base: { 16: num(16) } } } },
];

const MINI_MAP = {
    Primitives: { source: 'Primitives', modes: ['Base'], naming: 'raw' },
    Semantic: {
        source: 'Semantic', modes: ['Light', 'Dark'],
        items: {
            colorText: { Light: 'text/primary', Dark: 'text/primary', role: 'text', derived: false },
            colorNear: { Light: 'clay/500', Dark: 'clay/500', role: 'nearest primitive', derived: true },
            colorMissing: { Light: 'text/gone', Dark: 'text/gone', role: 'nothing fits', derived: false, needsValue: true, reason: 'no fitting JSON value' },
        },
    },
    Size: {
        source: 'Size', modes: ['small', 'middle'], jsonModes: { small: 'sm', middle: 'md' },
        items: { gapBase: { small: 'gap', middle: 'gap', role: 'gap', derived: false } },
    },
    Typography: { source: 'Typography', modes: ['Mode 1'], naming: 'raw' },
    Icons: {
        modes: ['Base'],
        sizes: { source: 'Size icons', prefix: 'size/' },
        colors: { 'icons/primary': { target: 'colorText', role: 'text', derived: false } },
    },
};

test('sanitizeTokenName applies one deterministic rule', () => {
    assert.equal(sanitizeTokenName('stroke/1,5').name, 'stroke/1.5');
    assert.equal(sanitizeTokenName('neutral/disabled-5%').name, 'neutral/disabled-5pct');
    assert.equal(sanitizeTokenName('font/line height/12').name, 'font/line-height/12');
    assert.equal(sanitizeTokenName('font/size/14').renamed, false);
});

test('parseTokenJson merges same-named collections into modes and records renames', () => {
    const parsed = parseTokenJson(MINI);
    const prim = parsed.sources.find(s => s.name === 'Primitives');
    assert.deepEqual(Object.keys(prim.modes), ['Base', 'Extra']);
    assert.ok(prim.modes.Base.some(t => t.path === 'odd-name/1.5' && t.type === 'number' && t.raw === 1.5));
    assert.ok(prim.modes.Base.some(t => t.path === 'odd-name/off-5pct'));
    assert.deepEqual(parsed.renames, [['Primitives/odd-name/1,5', 'Primitives/odd-name/1.5'], ['Primitives/odd-name/off-5%', 'Primitives/odd-name/off-5pct'], ['Typography/font/line height/12', 'Typography/font/line-height/12']]);
    assert.deepEqual(parsed.unknownTypes, []);
});

test('resolveTokenRefs follows cross-collection and intra-collection chains', () => {
    const parsed = parseTokenJson(MINI);
    const { unresolved } = resolveTokenRefs(parsed.sources, ['Primitives', 'Semantic']);
    assert.deepEqual(unresolved, []);
    const sem = parsed.sources.find(s => s.name === 'Semantic');
    const byPath = Object.fromEntries(sem.modes.Light.map(t => [t.path, t.resolved]));
    assert.deepEqual(byPath['text/primary'], { kind: 'ref', collection: 'Primitives', path: 'neutral/900' });
    assert.deepEqual(byPath['text/chain'], { kind: 'ref', collection: 'Semantic', path: 'text/primary' });
});

test('resolveTokenRefs reports missing and ambiguous refs, never literals', () => {
    const parsed = parseTokenJson([
        { A: { modes: { M: { x: { $type: 'color', $value: '{gone}' }, y: { $type: 'color', $value: '{shared}' } } } } },
        { B: { modes: { M: { shared: { $type: 'color', $value: '#fff' } } } } },
        { C: { modes: { M: { shared: { $type: 'color', $value: '#000' } } } } },
    ]);
    const { unresolved } = resolveTokenRefs(parsed.sources, ['A', 'B', 'C']);
    assert.equal(unresolved.length, 2);
    assert.ok(unresolved.some(u => u.ref === 'gone'));
    assert.ok(unresolved.some(u => u.ref === 'shared'));
});

test('buildBasePlan keeps Light/Dark keys identical and aliases resolve through chains', () => {
    const plan = buildBasePlan(parseTokenJson(MINI), MINI_MAP);
    const sem = plan.items.filter(i => i.collection === 'Semantic');
    for (const item of sem) assert.deepEqual(Object.keys(item.values), ['Light', 'Dark']);
    const text = sem.find(i => i.name === 'colorText');
    assert.deepEqual(text.values.Light, { alias: { collection: 'Primitives', name: 'neutral/900' } });
    assert.deepEqual(text.values.Dark, { alias: { collection: 'Primitives', name: 'white' } });
});

test('buildBasePlan flags derived aliases and needs-value names, never literals', () => {
    const plan = buildBasePlan(parseTokenJson(MINI), MINI_MAP);
    assert.deepEqual(plan.report.derived, [{ name: 'Semantic/colorNear', reason: 'nearest primitive' }]);
    const near = plan.items.find(i => i.name === 'colorNear');
    assert.deepEqual(near.values.Light, { alias: { collection: 'Primitives', name: 'clay/500' } });
    assert.deepEqual(plan.report.needsValue, [{ name: 'Semantic/colorMissing', reason: 'no fitting JSON value' }]);
    const missing = plan.items.find(i => i.name === 'colorMissing');
    assert.equal(missing.values.Light.needsValue, true);
});

test('buildBasePlan throws on a map ref with no JSON behind it', () => {
    const bad = structuredClone(MINI_MAP);
    bad.Size.items.gapBase.small = 'nope/nothing';
    assert.throws(() => buildBasePlan(parseTokenJson(MINI), bad), /points at missing Size\/sm\/nope\/nothing/);
});

test('buildBasePlan is deterministic', () => {
    const a = buildBasePlan(parseTokenJson(MINI), MINI_MAP);
    const b = buildBasePlan(parseTokenJson(MINI), MINI_MAP);
    assert.deepEqual(a, b);
});

test('the bundled ant-map is well-formed', () => {
    for (const [section, map] of Object.entries(ANT_MAP)) {
        assert.ok(Array.isArray(map.modes) && map.modes.length, section + ' modes');
        for (const [name, entry] of Object.entries(map.items ?? map.colors ?? {})) {
            assert.equal(typeof entry.role, 'string', `${section}/${name} role`);
            assert.equal(typeof entry.derived, 'boolean', `${section}/${name} derived`);
        }
    }
});

test('applyBasePlan assigns ids, links aliases and resolves through variableValue', () => {
    const store = { collections: [], items: [] };
    let n = 0;
    const stats = applyBasePlan(store, buildBasePlan(parseTokenJson(MINI), MINI_MAP), () => `id${++n}`);
    assert.ok(stats.items > 0 && stats.aliases > 0);
    const sem = store.collections.find(c => c.name === 'Semantic');
    const text = store.items.find(i => i.collectionId === sem.id && i.name === 'colorText');
    const firstMode = coll => coll.modes[0].id;
    assert.equal(variableValue(store, text, firstMode), '#101828'); // Light: text/primary -> neutral/900
    const darkMode = coll => (coll.name === 'Semantic' ? sem.modes.find(m => m.name === 'Dark').id : coll.modes[0].id);
    assert.equal(variableValue(store, text, darkMode), '#ffffff'); // Dark: text/primary -> white
});

test('applyBasePlan is idempotent and never overwrites or renames', () => {
    const store = { collections: [], items: [] };
    let n = 0;
    const uid = () => `id${++n}`;
    const plan = buildBasePlan(parseTokenJson(MINI), MINI_MAP);
    applyBasePlan(store, plan, uid);
    const before = structuredClone(store);
    const second = applyBasePlan(store, plan, uid);
    assert.deepEqual(second, { collections: 0, items: 0, modes: 0, aliases: 0 });
    assert.deepEqual(store, before);
    // A pre-existing user variable with the same name but another type is left alone.
    const sem = store.collections.find(c => c.name === 'Semantic');
    store.items.push({ id: 'user1', collectionId: sem.id, name: 'colorText', type: 'string', values: {} });
    const again = applyBasePlan(store, plan, uid);
    assert.equal(store.items.filter(i => i.name === 'colorText').length, 2);
    assert.deepEqual(again, { collections: 0, items: 0, modes: 0, aliases: 0 });
});
