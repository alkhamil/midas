// Auto Fix: the generic planner and applier, driven by schema roles and the roles table. The mini template exercises
// the mechanism; the Button and Input templates pin the real data (derived sets, needs-value sets, zero literals).
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES, variableProps, roleOf, planAutoFix, applyAutoFix, applyBasePlan, planFromSnapshot, BASE_SNAPSHOT, ROLES, diagnoseDocument } from '../src/index.js';

const MINI = {
    id: 'mini',
    name: 'Mini',
    props: {
        variant: { source: 'variable', collection: 'Variant', modes: ['a', 'b'] },
        size: { source: 'variable', collection: 'Size', modes: ['sm'] },
    },
    tokens: { fromVariant: ['bg', 'fg'], fromSize: ['height'] },
    tokenKinds: { bg: 'color', fg: 'color', height: 'length' },
    tokenRoles: { bg: { a: 'bg', b: './fg' }, fg: 'fg', height: 'height-sm' },
};

const emptyBinding = template => ({ version: 2, templateId: template.id, variables: Object.fromEntries(variableProps(template).map(([d]) => [d, null])) });
let n = 0;
const uid = () => `id${++n}`;

test('roleOf resolves plain roles, per-mode maps, defaults and token names', () => {
    assert.equal(roleOf(MINI, 'fg', 'a'), 'fg');
    assert.equal(roleOf(MINI, 'bg', 'a'), 'bg');
    assert.equal(roleOf(MINI, 'bg', 'B'), './fg');
    assert.equal(roleOf(MINI, 'height', 'sm'), 'height-sm');
    assert.equal(roleOf({ tokenRoles: { t: { x: 'r', default: 'd' } } }, 't', 'y'), 'd');
    assert.equal(roleOf({}, 'tok', 'm'), 'tok');
});

test('missing variables are created as aliases by role, following component chains', () => {
    const store = { collections: [], items: [] };
    const binding = emptyBinding(MINI);
    const plan = planAutoFix({ template: MINI, binding, variables: store, layers: [] });
    assert.equal(plan.fixable, true);
    assert.equal(plan.unfixable.length, 0);
    const stats = applyAutoFix(store, binding, plan, uid);
    assert.ok(stats.items > 0 && stats.aliases > 0 && stats.bindings === 2);
    const variant = store.collections.find(c => c.name === 'Mini Variant');
    assert.deepEqual(variant.modes.map(m => m.name), ['a', 'b']);
    const byName = Object.fromEntries(store.items.filter(i => i.collectionId === variant.id).map(i => [i.name, i]));
    const modeId = mode => variant.modes.find(m => m.name === mode).id;
    const targetOf = item => store.items.find(i => i.id === item.values[modeId('b')].alias);
    assert.equal(targetOf(byName['bg']).name, 'fg'); // component chain
    assert.equal(store.items.find(i => i.id === byName['fg'].values[modeId('a')].alias).name, 'colorText'); // base role
    const size = store.collections.find(c => c.name === 'Mini Size' && c.modes.some(m => m.name === 'sm'));
    const height = store.items.find(i => i.collectionId === size.id && i.name === 'height');
    assert.equal(store.items.find(i => i.id === height.values[size.modes[0].id].alias).name, 'controlHeightSM');
});

test('a literal in a template collection is rebound to its role; missing mode values are filled', () => {
    const store = { collections: [{ id: 'c', name: 'Mini Variant', modes: [{ id: 'm-a', name: 'a' }] }], items: [{ id: 'v', collectionId: 'c', name: 'bg', type: 'color', values: { 'm-a': '#123456' } }] };
    const binding = { version: 2, templateId: 'mini', variables: { variant: 'c', size: null } };
    const plan = planAutoFix({ template: MINI, binding, variables: store, layers: [] });
    applyAutoFix(store, binding, plan, uid);
    assert.ok(store.items[0].values['m-a'].alias, 'the literal is replaced by its role alias, never kept');
    assert.ok(store.items[0].values[store.collections[0].modes.find(m => m.name === 'b').id].alias);
});

test('a dangling binding is rebound; an ambiguous collection is unfixable', () => {
    const store = { collections: [{ id: 'c1', name: 'Mini Variant', modes: [] }, { id: 'c2', name: 'Mini Variant', modes: [] }], items: [] };
    const binding = { version: 2, templateId: 'mini', variables: { variant: 'gone', size: null } };
    const plan = planAutoFix({ template: MINI, binding, variables: store, layers: [] });
    assert.ok(plan.unfixable.some(u => u.name.includes('variant')));
    assert.ok(!plan.bindingUpdates.variant);
    assert.ok(plan.bindingUpdates.size);
});

test('an unknown role becomes needs value, never a literal', () => {
    const odd = { ...MINI, tokenRoles: { ...MINI.tokenRoles, fg: 'no-such-role' } };
    const plan = planAutoFix({ template: odd, binding: emptyBinding(odd), variables: { collections: [], items: [] }, layers: [] });
    assert.ok(plan.needsValue.some(v => v.name.endsWith('/fg.a') || v.name.endsWith('/fg.b')));
    const store = { collections: [], items: [] };
    applyAutoFix(store, emptyBinding(odd), plan, uid);
    for (const item of store.items.filter(i => i.name === 'fg')) {
        // A missing role is a failure, not a created literal: modes stay unset, the item is flagged.
        assert.equal(item.needsValue, true);
        assert.deepEqual(Object.keys(item.values), []);
    }
});

test('a self-referencing role is unfixable', () => {
    const loop = { ...MINI, tokenRoles: { ...MINI.tokenRoles, bg: './bg' } };
    const plan = planAutoFix({ template: loop, binding: emptyBinding(loop), variables: { collections: [], items: [] }, layers: [] });
    assert.ok(plan.unfixable.some(u => u.name === './bg'));
});

test('a type mismatch is kept and reported, never overwritten', () => {
    const store = { collections: [{ id: 'c', name: 'Mini Variant', modes: [{ id: 'm-a', name: 'a' }] }], items: [{ id: 'v', collectionId: 'c', name: 'bg', type: 'string', values: {} }] };
    const binding = { version: 2, templateId: 'mini', variables: { variant: 'c', size: null } };
    const before = structuredClone(store);
    const plan = planAutoFix({ template: MINI, binding, variables: store, layers: [] });
    applyAutoFix(store, binding, plan, uid);
    assert.equal(store.items.find(i => i.id === 'v').type, 'string');
    assert.ok(plan.unfixable.some(u => u.name === 'bg'));
    assert.deepEqual(store.items.find(i => i.id === 'v'), before.items[0]);
});

test('planning is pure; applying twice is a no-op', () => {
    const store = { collections: [], items: [] };
    const binding = emptyBinding(MINI);
    const before = structuredClone({ store, binding });
    const plan = planAutoFix({ template: MINI, binding, variables: store, layers: [] });
    assert.deepEqual({ store, binding }, before);
    applyAutoFix(store, binding, plan, uid);
    const second = planAutoFix({ template: MINI, binding, variables: store, layers: [] });
    assert.equal(second.fixable, false);
});

const SNAPSHOT_DERIVED = ["Primitives/transparent","Semantic/controlHeightXL","Semantic/fontSizeXS","Semantic/lineHeightXS","Semantic/lineHeightHeading1","Semantic/lineHeightHeading2","Semantic/borderRadiusXL","Semantic/paddingXxs","Primitives/size/15","Semantic/buttonPaddingXxl","Semantic/inputPaddingXxl","Semantic/paddingYxs","Semantic/buttonPaddingYxl","Primitives/size/9","Semantic/inputPaddingYxl","Semantic/clearIconSizeXS","Semantic/clearIconSizeSM","Semantic/clearIconSizeMD","Semantic/clearIconSizeLG","Semantic/clearIconSizeXL","Primitives/size/22"];
// The snapshot derived names, then the two heading line heights the text styles derive (see text-styles.json).
const TEXT_DERIVED = ['Primitives/heading/1', 'Primitives/heading/2'];
const EXPECTED_DERIVED = {
    button: [...SNAPSHOT_DERIVED, ...TEXT_DERIVED],
    input: [...SNAPSHOT_DERIVED, ...TEXT_DERIVED],
};

for (const tid of ['button', 'input']) {
    test(`${tid}: every token resolves to base or needs value, never a literal`, () => {
        const template = TEMPLATES.get(tid);
        const binding = emptyBinding(template);
        const store = { collections: [], items: [] };
        const plan = planAutoFix({ template, binding, variables: store, layers: [] });
        assert.equal(plan.fixable, true);
        assert.deepEqual(plan.unfixable, []);
        assert.deepEqual(plan.derived.map(d => d.name), EXPECTED_DERIVED[tid]);
        for (const item of plan.plan.items) {
            if (item.collection === 'Primitives' || item.collection === 'Typography' || item.collection === 'Icons') continue;
            for (const value of Object.values(item.values)) assert.ok(value.alias || value.needsValue, `${item.collection}/${item.name} is an alias or flagged`);
        }
        // Every alias target exists in the plan (a base or a component variable).
        const atName = (/** @type {any} */ alias) => `${plan.plan.collections[alias.collectionIndex]?.name}/${alias.name}`;
        const names = new Set(plan.plan.items.map(i => `${plan.plan.collections[i.collectionIndex]?.name}/${i.name}`));
        for (const item of plan.plan.items) {
            for (const value of Object.values(item.values)) {
                if (value.alias) assert.ok(names.has(atName(value.alias)), `target ${atName(value.alias)} exists`);
            }
        }
    });

    test(`${tid}: applied fix leaves zero errors and a second run is a no-op`, () => {
        const template = TEMPLATES.get(tid);
        const binding = emptyBinding(template);
        const store = { collections: [], items: [] };
        applyAutoFix(store, binding, planAutoFix({ template, binding, variables: store, layers: [] }), uid);
        const doc = { variables: store, pages: [{ name: 'p', nodes: [{ id: 'm', name: 'M', component: true, behavior: binding }] }] };
        assert.deepEqual(diagnoseDocument(doc).filter(f => f.severity === 'error'), []);
        const second = planAutoFix({ template, binding, variables: store, layers: [] });
        assert.equal(second.fixable, false);
        assert.deepEqual(second.unfixable, []);
    });
}

test('no token needs a value: every role resolves to the base', () => {
    for (const [tid, count] of [['button', 0], ['input', 0]]) {
        const template = TEMPLATES.get(tid);
        const plan = planAutoFix({ template, binding: emptyBinding(template), variables: { collections: [], items: [] }, layers: [] });
        assert.equal(plan.needsValue.length, count);
        for (const n of plan.needsValue) assert.ok(n.reason.length > 0);
    }
});

test('button Size md/sm/lg height resolves to antd controlHeight through Semantic and Primitives', () => {
    const template = TEMPLATES.get('button');
    const plan = planAutoFix({ template, binding: emptyBinding(template), variables: { collections: [], items: [] }, layers: [] });
    const atName = a => plan.plan.collections[a.collectionIndex].name + '/' + a.name;
    const findItem = (coll, name) => plan.plan.items.find(i => i.name === name && plan.plan.collections[i.collectionIndex].name === coll);
    const height = plan.plan.items.find(i => i.name === 'height');
    for (const [mode, semName, primName, primValue] of [['md', 'controlHeightMD', 'size/32', 32], ['sm', 'controlHeightSM', 'size/24', 24], ['lg', 'controlHeightLG', 'size/40', 40]]) {
        assert.equal(atName(height.values[mode].alias), 'Semantic/' + semName, mode);
        const sem = findItem('Semantic', semName);
        assert.equal(atName(sem.values.Light.alias), 'Primitives/' + primName, mode);
        assert.equal(findItem('Primitives', primName).values.Base.literal, primValue, mode);
    }
    const inputHeight = planAutoFix({ template: TEMPLATES.get('input'), binding: emptyBinding(TEMPLATES.get('input')), variables: { collections: [], items: [] }, layers: [] });
    const ih = inputHeight.plan.items.find(i => i.name === 'height');
    const iname = a => inputHeight.plan.collections[a.collectionIndex].name + '/' + a.name;
    assert.equal(iname(ih.values.md.alias), 'Semantic/controlHeightMD');
});

test('button Size gap follows the per-size ladder 4/6/8/8/10, input gap stays 4', () => {
    const want = {
        button: { xs: ['gapXS', 4], sm: ['gapSM', 6], md: ['gapMD', 8], lg: ['gapLG', 8], xl: ['gapXL', 10] },
        input: { xs: ['gapXS', 4], sm: ['gapXS', 4], md: ['gapXS', 4], lg: ['gapXS', 4], xl: ['gapXS', 4] },
    };
    for (const [tid, modes] of Object.entries(want)) {
        const template = TEMPLATES.get(tid);
        const plan = planAutoFix({ template, binding: emptyBinding(template), variables: { collections: [], items: [] }, layers: [] });
        const atName = a => plan.plan.collections[a.collectionIndex].name + '/' + a.name;
        const findItem = (coll, name) => plan.plan.items.find(i => i.name === name && plan.plan.collections[i.collectionIndex].name === coll);
        const gap = findItem(`${template.name} Size`, 'gap');
        assert.ok(gap, `${tid} Size gap exists`);
        for (const [mode, [semName, value]] of Object.entries(modes)) {
            assert.equal(atName(gap.values[mode].alias), `Semantic/${semName}`, `${tid} ${mode} aliases ${semName}`);
            const sem = findItem('Semantic', semName);
            assert.equal(findItem('Primitives', sem.values.Light.alias.name).values.Base.literal, value, `${tid} ${mode} is ${value}px`);
        }
    }
});

test('extrapolated antd sizes are flagged derived and still resolve', () => {
    const template = TEMPLATES.get('button');
    const plan = planAutoFix({ template, binding: emptyBinding(template), variables: { collections: [], items: [] }, layers: [] });
    for (const name of ['Semantic/controlHeightXL', 'Semantic/fontSizeXS', 'Semantic/lineHeightXS', 'Semantic/lineHeightHeading1', 'Semantic/lineHeightHeading2', 'Semantic/borderRadiusXL']) {
        assert.ok(plan.derived.some(d => d.name === name), name + ' flagged derived');
        const [coll, iname] = name.split('/');
        const item = plan.plan.items.find(i => i.name === iname && plan.plan.collections[i.collectionIndex].name === coll);
        assert.ok(item, name + ' created');
        for (const value of Object.values(item.values)) assert.ok(value.alias, name + ' is an alias, never a literal');
    }
    const xsh = plan.plan.items.find(i => i.name === 'controlHeightXL' && plan.plan.collections[i.collectionIndex].name === 'Semantic');
    assert.equal(xsh.values.Light.alias.name, 'size/48');
});

test('no JSON-based size mapping remains: aliases never point at Size collection metrics', () => {
    const template = TEMPLATES.get('input');
    const plan = planAutoFix({ template, binding: emptyBinding(template), variables: { collections: [], items: [] }, layers: [] });
    const atName = a => plan.plan.collections[a.collectionIndex].name + '/' + a.name;
    for (const item of plan.plan.items) {
        for (const value of Object.values(item.values)) {
            if (!value.alias) continue;
            const target = atName(value.alias);
            assert.ok(!target.startsWith('Size/'), target + ' must not come from the JSON Size collection');
        }
    }
    const sizeVars = plan.plan.items.filter(i => {
        const coll = plan.plan.collections[i.collectionIndex].name;
        return coll !== 'Primitives' && coll !== 'Typography' && coll !== 'Icons' && i.type === 'number';
    });
    for (const v of sizeVars) {
        for (const value of Object.values(v.values)) {
            if (!value.alias) continue;
            const t = atName(value.alias);
            assert.ok(t.startsWith('Semantic/') || t.startsWith('Primitives/') || t.startsWith('Typography/') || t.startsWith('Icons/') || t.startsWith('Size/'), t);
        }
    }
});
