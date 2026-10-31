// Studio wiring for base variable generation: the same core imports the Variables window handler uses, run against a
// mini token JSON, plus source checks that the window exposes one Generate base button wired through one undo step.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseTokenJson, buildBasePlan, applyBasePlan } from '@midas/builder-core';

const MINI_TEXT = JSON.stringify([
    { Primitives: { modes: { Base: { white: { $type: 'color', $value: '#ffffff' } } } } },
    { Semantic: { modes: {
        Light: { bg: { brand: { $type: 'color', $value: '{white}' } } },
        Dark: { bg: { brand: { $type: 'color', $value: '{white}' } } },
    } } },
    { Typography: { modes: { 'Mode 1': {} } } },
    { 'Size icons': { modes: { Base: { 16: { $type: 'float', $value: 16 } } } } },
    { Size: { modes: { sm: {}, md: {}, lg: {} } } },
]);

const MINI_MAP = {
    Primitives: { source: 'Primitives', modes: ['Base'], naming: 'raw' },
    Semantic: { source: 'Semantic', modes: ['Light', 'Dark'], items: { colorBrand: { Light: 'bg/brand', Dark: 'bg/brand', role: 'brand', derived: false } } },
    Size: { source: 'Size', modes: ['small'], jsonModes: { small: 'sm' }, items: {} },
    Typography: { source: 'Typography', modes: ['Mode 1'], naming: 'raw' },
    Icons: { modes: ['Base'], sizes: { source: 'Size icons', prefix: 'size/' }, colors: {} },
};

test('the studio pipeline (parse, build, apply) generates linked collections from token JSON text', () => {
    const store = { collections: [], items: [] };
    let n = 0;
    const plan = buildBasePlan(parseTokenJson(JSON.parse(MINI_TEXT)), MINI_MAP);
    const stats = applyBasePlan(store, plan, () => `id${++n}`);
    assert.equal(stats.collections, 5);
    assert.ok(stats.items > 0 && stats.aliases > 0);
    const sem = store.collections.find(c => c.name === 'Semantic');
    assert.deepEqual(sem.modes.map(m => m.name), ['Light', 'Dark']);
    const brand = store.items.find(i => i.collectionId === sem.id && i.name === 'colorBrand');
    const light = sem.modes.find(m => m.name === 'Light').id;
    const target = store.items.find(i => i.id === brand.values[light].alias);
    assert.equal(target.name, 'white');
});

test('running the pipeline twice creates nothing the second time', () => {
    const store = { collections: [], items: [] };
    let n = 0;
    const uid = () => `id${++n}`;
    const plan = buildBasePlan(parseTokenJson(JSON.parse(MINI_TEXT)), MINI_MAP);
    applyBasePlan(store, plan, uid);
    assert.deepEqual(applyBasePlan(store, plan, uid), { collections: 0, items: 0, modes: 0, aliases: 0 });
});

test('an existing template Size collection keeps its modes and items', () => {
    const store = { collections: [{ id: 'c-size', name: 'Size', modes: [{ id: 'm-sm', name: 'Small' }] }], items: [{ id: 's-h', collectionId: 'c-size', name: 'button/height', type: 'number', values: { 'm-sm': 32 } }] };
    let n = 0;
    applyBasePlan(store, buildBasePlan(parseTokenJson(JSON.parse(MINI_TEXT)), MINI_MAP), () => `id${++n}`);
    const size = store.collections.find(c => c.name === 'Size');
    assert.equal(size.id, 'c-size');
    assert.ok(size.modes.some(m => m.name === 'Small'));
    assert.ok(size.modes.some(m => m.name === 'small'));
    assert.equal(store.items.find(i => i.id === 's-h').values['m-sm'], 32);
});

test('midas.js wires one Generate base button through one undo step', () => {
    const src = fs.readFileSync(new URL('../src/engine/midas.js', import.meta.url), 'utf8');
    assert.equal(src.split('data-vw-generate-base').length - 1, 2); // the title-bar button and its click handler
    assert.equal(src.split("vwTx('Generate base variables'").length - 1, 1); // a single transaction is a single undo step
    for (const name of ['parseTokenJson', 'buildBasePlan', 'applyBasePlan']) assert.ok(src.includes(name), name + ' used by the handler');
});
