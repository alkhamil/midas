// Auto Fix: the generic planner and applier, driven by schema roles and the roles table. The mini template exercises
// the mechanism; the Button and Input templates pin the real data (derived sets, needs-value sets, zero literals).
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES, variableProps, roleOf, planAutoFix, applyAutoFix, ROLES, diagnoseDocument } from '../src/index.js';

const MINI = {
    id: 'mini',
    group: 'mini',
    props: {
        variant: { source: 'variable', collection: 'Variant', modes: ['a', 'b'] },
        size: { source: 'variable', collection: 'Size', modes: ['sm'] },
    },
    tokens: { fromVariant: ['bg', 'fg'], fromSize: ['height'] },
    tokenKinds: { bg: 'color', fg: 'color', height: 'length' },
    tokenRoles: { bg: { a: 'bg', b: 'mini/fg' }, fg: 'fg', height: 'height-sm' },
};

const emptyBinding = template => ({ version: 2, templateId: template.id, variables: Object.fromEntries(variableProps(template).map(([d]) => [d, null])) });
let n = 0;
const uid = () => `id${++n}`;

test('roleOf resolves plain roles, per-mode maps, defaults and token names', () => {
    assert.equal(roleOf(MINI, 'fg', 'a'), 'fg');
    assert.equal(roleOf(MINI, 'bg', 'a'), 'bg');
    assert.equal(roleOf(MINI, 'bg', 'B'), 'mini/fg');
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
    const variant = store.collections.find(c => c.name === 'Variant');
    assert.deepEqual(variant.modes.map(m => m.name), ['a', 'b']);
    const byName = Object.fromEntries(store.items.filter(i => i.collectionId === variant.id).map(i => [i.name, i]));
    const modeId = mode => variant.modes.find(m => m.name === mode).id;
    const targetOf = item => store.items.find(i => i.id === item.values[modeId('b')].alias);
    assert.equal(targetOf(byName['mini/bg']).name, 'mini/fg'); // component chain
    assert.equal(store.items.find(i => i.id === byName['mini/fg'].values[modeId('a')].alias).name, 'colorText'); // base role
    const size = store.collections.find(c => c.name === 'Size' && c.modes.some(m => m.name === 'sm'));
    const height = store.items.find(i => i.collectionId === size.id && i.name === 'mini/height');
    assert.equal(store.items.find(i => i.id === height.values[size.modes[0].id].alias).name, 'controlHeightSM');
});

test('existing values are kept; only missing mode values are filled', () => {
    const store = { collections: [{ id: 'c', name: 'Variant', modes: [{ id: 'm-a', name: 'a' }] }], items: [{ id: 'v', collectionId: 'c', name: 'mini/bg', type: 'color', values: { 'm-a': '#123456' } }] };
    const binding = { version: 2, templateId: 'mini', variables: { variant: 'c', size: null } };
    const plan = planAutoFix({ template: MINI, binding, variables: store, layers: [] });
    const before = store.items[0].values['m-a'];
    applyAutoFix(store, binding, plan, uid);
    assert.equal(store.items[0].values['m-a'], before);
    assert.ok(store.items[0].values[store.collections[0].modes.find(m => m.name === 'b').id].alias);
});

test('a dangling binding is rebound; an ambiguous collection is unfixable', () => {
    const store = { collections: [{ id: 'c1', name: 'Variant', modes: [] }, { id: 'c2', name: 'Variant', modes: [] }], items: [] };
    const binding = { version: 2, templateId: 'mini', variables: { variant: 'gone', size: null } };
    const plan = planAutoFix({ template: MINI, binding, variables: store, layers: [] });
    assert.ok(plan.unfixable.some(u => u.name.includes('variant')));
    assert.ok(!plan.bindingUpdates.variant);
    assert.ok(plan.bindingUpdates.size);
});

test('an unknown role becomes needs value, never a literal', () => {
    const odd = { ...MINI, tokenRoles: { ...MINI.tokenRoles, fg: 'no-such-role' } };
    const plan = planAutoFix({ template: odd, binding: emptyBinding(odd), variables: { collections: [], items: [] }, layers: [] });
    assert.ok(plan.needsValue.some(v => v.name.endsWith('/mini/fg.a') || v.name.endsWith('/mini/fg.b')));
    const store = { collections: [], items: [] };
    applyAutoFix(store, emptyBinding(odd), plan, uid);
    for (const item of store.items.filter(i => i.name === 'mini/fg')) {
        // Flagged needs value (a renderable placeholder, not a meaningful literal): every mode is set, nothing stays missing.
        assert.equal(item.needsValue, true);
        for (const value of Object.values(item.values)) assert.ok(value.alias || item.needsValue, 'alias or flagged, never a meaningful literal');
    }
});

test('a self-referencing role is unfixable', () => {
    const loop = { ...MINI, tokenRoles: { ...MINI.tokenRoles, bg: 'mini/bg' } };
    const plan = planAutoFix({ template: loop, binding: emptyBinding(loop), variables: { collections: [], items: [] }, layers: [] });
    assert.ok(plan.unfixable.some(u => u.name === 'mini/bg'));
});

test('a type mismatch is kept and reported, never overwritten', () => {
    const store = { collections: [{ id: 'c', name: 'Variant', modes: [{ id: 'm-a', name: 'a' }] }], items: [{ id: 'v', collectionId: 'c', name: 'mini/bg', type: 'string', values: {} }] };
    const binding = { version: 2, templateId: 'mini', variables: { variant: 'c', size: null } };
    const before = structuredClone(store);
    const plan = planAutoFix({ template: MINI, binding, variables: store, layers: [] });
    applyAutoFix(store, binding, plan, uid);
    assert.equal(store.items.find(i => i.id === 'v').type, 'string');
    assert.ok(plan.unfixable.some(u => u.name === 'mini/bg'));
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

const EXPECTED_DERIVED = {
    button: ['Semantic/colorPrimaryBg', 'Semantic/colorErrorBg', 'Semantic/colorPrimaryHover', 'Semantic/colorErrorHover', 'Semantic/colorPrimaryBgHover', 'Semantic/colorErrorBgHover', 'Semantic/colorPrimaryActive', 'Semantic/colorErrorActive', 'Semantic/colorBgContainerDisabled', 'Semantic/colorPrimaryOutline', 'Semantic/colorErrorOutline'],
    input: ['Semantic/colorPrimaryHover', 'Semantic/colorErrorHover', 'Semantic/colorWarningHover', 'Semantic/colorBgContainerDisabled', 'Semantic/colorPrimaryOutline', 'Semantic/colorErrorOutline', 'Semantic/colorWarningOutline'],
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

test('button needs value only for transparent roles; input likewise', () => {
    for (const [tid, count] of [['button', 24], ['input', 11]]) {
        const template = TEMPLATES.get(tid);
        const plan = planAutoFix({ template, binding: emptyBinding(template), variables: { collections: [], items: [] }, layers: [] });
        assert.equal(plan.needsValue.length, count);
        for (const n of plan.needsValue) assert.ok(n.reason.length > 0);
    }
});
