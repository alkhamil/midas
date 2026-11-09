// The border and the focus ring are controlled by variables, not by a literal strokeWidth on a master: the root stroke
// binds to the border token (the existing Semantic lineWidth, 1px, from the antd seed), and the focus ring derives from
// the outline token (Semantic controlOutlineWidth, 3px, as its own independent token). Both are single-step tokens:
// one role, the same value in every Size mode, no size suffix.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BASE_SNAPSHOT, planFromSnapshot, applyBasePlan } from '../src/index.js';
import { variableValue } from '../src/behavior-engine/variable-value.js';

const json = name => JSON.parse(readFileSync(new URL(`../src/base-tokens/${name}`, import.meta.url), 'utf8'));
const roles = json('roles.json');
const sizes = json('antd-sizes.json');

test('the border width reuses the antd seed lineWidth, 1px, on a stroke primitive', () => {
    assert.deepEqual(sizes.lineWidth, {
        collection: 'Semantic', value: 1, primitive: 'stroke/1', derived: false,
        source: 'components/theme/themes/seed.ts: lineWidth',
    });
});

test('the outline width is its own Semantic token, 3px, as an independent default', () => {
    assert.deepEqual(sizes.controlOutlineWidth, {
        collection: 'Semantic', value: 3, primitive: 'stroke/3', derived: false,
        source: 'components/theme/util/alias.ts: controlOutlineWidth (Midas keeps its own default of 3, independent of lineWidth)',
    });
});

test('the width roles point at the Semantic tokens', () => {
    assert.equal(roles['border-width']?.base, 'Semantic/lineWidth');
    assert.equal(roles['outline-width']?.base, 'Semantic/controlOutlineWidth');
});

test('the snapshot holds both Semantic widths, aliasing the stroke primitives in both modes', () => {
    const plan = planFromSnapshot(BASE_SNAPSHOT);
    const names = new Set(plan.items.filter(i => i.collection === 'Semantic').map(i => i.name));
    assert.ok(names.has('lineWidth'), 'Semantic/lineWidth exists');
    assert.ok(names.has('controlOutlineWidth'), 'Semantic/controlOutlineWidth exists');
    const store = { collections: [], items: [] };
    applyBasePlan(store, plan, (() => { let n = 0; return () => `w${++n}`; })());
    const semantic = store.collections.find(c => c.name === 'Semantic');
    const valueOf = name => {
        const item = store.items.find(i => i.collectionId === semantic.id && i.name === name);
        assert.ok(item, `Semantic/${name} generated`);
        return variableValue(store, item, c => c.modes[0].id);
    };
    assert.equal(valueOf('lineWidth'), 1);
    assert.equal(valueOf('controlOutlineWidth'), 3);
});

test('the snapshot holds the Semantic items the templates read: 120', () => {
    const plan = planFromSnapshot(BASE_SNAPSHOT);
    const per = {};
    for (const i of plan.items) per[i.collection] = (per[i.collection] || 0) + 1;
    assert.deepEqual(per, { Primitives: 207, Typography: 31, Semantic: 120 });
    assert.equal(plan.items.length, 358);
});
