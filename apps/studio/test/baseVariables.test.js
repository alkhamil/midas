// Studio wiring for base variable generation: the snapshot plan the Variables window handler applies, plus source
// checks that the button needs no file input and runs in one undo step.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BASE_SNAPSHOT, planFromSnapshot, applyBasePlan } from '@midas/builder-core';

test('the bundled snapshot generates the base collections', () => {
    const store = { collections: [], items: [] };
    let n = 0;
    const plan = planFromSnapshot(BASE_SNAPSHOT);
    const stats = applyBasePlan(store, plan, () => `id${++n}`);
    assert.equal(stats.collections, 5);
    assert.equal(stats.items, 281);
    assert.deepEqual(store.collections.map(c => c.name), ['Primitives', 'Semantic', 'Size', 'Typography', 'Icons']);
    const sem = store.collections.find(c => c.name === 'Semantic');
    assert.deepEqual(sem.modes.map(m => m.name), ['Light', 'Dark']);
});

test('running generation twice creates nothing the second time', () => {
    const store = { collections: [], items: [] };
    let n = 0;
    const uid = () => `id${++n}`;
    applyBasePlan(store, planFromSnapshot(BASE_SNAPSHOT), uid);
    assert.deepEqual(applyBasePlan(store, planFromSnapshot(BASE_SNAPSHOT), uid), { collections: 0, items: 0, modes: 0, aliases: 0 });
});

test('midas.js generates base from the snapshot with no file input in one undo step', () => {
    const src = fs.readFileSync(new URL('../src/engine/midas.js', import.meta.url), 'utf8');
    assert.equal(src.split('data-vw-generate-base').length - 1, 2); // the title-bar button and its click handler
    assert.ok(!src.includes('pickBaseTokenFile'), 'no file-picker flow remains');
    assert.ok(!src.includes('parseTokenJson') && !src.includes('buildBasePlan('), 'the importer stays the build script engine');
    assert.ok(src.includes('generateBaseVariables'), 'snapshot handler exists');
    assert.ok(src.includes('planFromSnapshot(BASE_SNAPSHOT)'), 'the plan comes from the bundled snapshot');
    assert.equal(src.split("vwTx('Generate base variables'").length - 1, 1); // a single transaction is a single undo step
});
