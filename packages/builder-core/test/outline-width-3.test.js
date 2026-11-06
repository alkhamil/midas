// Round 3 item 1: controlOutlineWidth is 3 (stroke/3). The generated base must set
// Semantic/controlOutlineWidth to 3, resolving the same for Checkbox, Radio and Switch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BASE_SNAPSHOT, planFromSnapshot, applyBasePlan, TEMPLATES } from '../src/index.js';
import { restOf } from '../src/behavior-engine/tokens.js';
import { modelFor } from './helpers/box-template.js';

const json = name => JSON.parse(readFileSync(new URL(`../src/base-tokens/${name}`, import.meta.url), 'utf8'));

test('antd-sizes declares controlOutlineWidth as 3 on stroke/3', () => {
    assert.deepEqual(json('antd-sizes.json').controlOutlineWidth, {
        collection: 'Semantic', value: 3, primitive: 'stroke/3', derived: false,
        source: 'components/theme/util/alias.ts: controlOutlineWidth (Midas keeps its own default of 3, independent of lineWidth)',
    });
});

test('Generate base resolves Semantic/controlOutlineWidth to 3', () => {
    const store = { collections: [], items: [] };
    applyBasePlan(store, planFromSnapshot(BASE_SNAPSHOT), (() => { let n = 0; return () => `o${++n}`; })());
    const semantic = store.collections.find(c => c.name === 'Semantic');
    const item = store.items.find(i => i.collectionId === semantic.id && i.name === 'controlOutlineWidth');
    assert.ok(item, 'Semantic/controlOutlineWidth generated');
    assert.equal(restOf(item, semantic.modes[0].name, store.items, store.collections).literal, 3);
});

for (const id of ['checkbox', 'radio', 'switch']) {
    test(`${id}: the shared outline base token resolves to 3`, () => {
        const model = modelFor(TEMPLATES.get(id));
        const semantic = model.variables.collections.find(c => c.name === 'Semantic');
        const item = model.variables.items.find(i => i.collectionId === semantic.id && i.name === 'controlOutlineWidth');
        assert.ok(item, `${id} base has controlOutlineWidth`);
        assert.equal(restOf(item, semantic.modes[0].name, model.variables.items, model.variables.collections).literal, 3);
    });
}
