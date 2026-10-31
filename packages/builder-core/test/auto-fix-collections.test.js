// Auto Fix across templates sharing a file: every template collection is always "<Template> <Name>",
// regardless of creation order. The second template's frames never touch the first template's collections,
// variables or bindings; a second frame of the same template reuses its collections.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    TEMPLATES, createBinding, planAutoFix, applyAutoFix, planFromSnapshot, applyBasePlan, BASE_SNAPSHOT,
    planBindTokens, applyBindTokens, masterLayersOf, diagnoseDocument,
} from '../src/index.js';

let n = 0;
const uid = () => `e${++n}`;
const button = TEMPLATES.get('button');
const input = TEMPLATES.get('input');

const emptyStore = () => ({ collections: [], items: [] });
const generateBase = store => applyBasePlan(store, planFromSnapshot(BASE_SNAPSHOT), uid);
const childrenOf = nodes => id => nodes.filter(x => x.parentId === id);
const docWith = (store, nodes) => ({ variables: store, pages: [{ name: 'p', nodes }] });
const errorsOf = doc => diagnoseDocument(doc).filter(f => f.severity === 'error');
const collectionName = (store, id) => store.collections.find(c => c.id === id)?.name ?? null;

function frame(id, name, labelText) {
    const root = {
        id, name, type: 'frame', component: true, layout: 'horizontal', x: 0, y: 0, w: 200, h: 40,
        stroke: '#000000', strokeWidth: 1, strokeAlign: 'inside', behavior: null, vars: {},
    };
    const label = { id: `${id}-label`, name: 'Label', type: 'text', parentId: id, text: labelText, vars: {} };
    return [root, label];
}

/** A bound master, auto-matched by namespaced name against the store (what binding a template does in the editor). */
function bindMaster(store, nodes, template, id, name, labelText) {
    const [root, label] = frame(id, name, labelText);
    root.behavior = createBinding(template, store.collections);
    nodes.push(root, label);
    return root;
}

/** One studio Auto Fix click: plan, apply, then bind tokens through the existing pipeline. */
function autoFix(store, nodes, master) {
    const template = TEMPLATES.get(master.behavior.templateId);
    const layers = () => masterLayersOf(master, childrenOf(nodes));
    const plan = planAutoFix({ template, binding: master.behavior, variables: store, layers: layers() });
    applyAutoFix(store, master.behavior, plan, uid);
    const bound = planBindTokens({ template, binding: master.behavior, layers: layers(), variables: store });
    applyBindTokens(layers(), bound.ops);
    return plan;
}

/** What must not change when another template is fixed: the binding and the bound collections with their items. */
const snapshotTemplate = (store, master) => {
    const ids = new Set(Object.values(master.behavior.variables).filter(Boolean));
    return {
        binding: structuredClone(master.behavior),
        collections: structuredClone(store.collections.filter(c => ids.has(c.id))),
        variables: structuredClone(store.items.filter(i => ids.has(i.collectionId)).sort((a, b) => (a.name < b.name ? -1 : 1))),
    };
};

test('button fixed first, then input: each template owns its namespaced collections, the button is untouched', () => {
    const store = emptyStore();
    generateBase(store);
    const nodes = [];
    const btn = bindMaster(store, nodes, button, 'btn', 'Button', 'Button');
    const btnPlan = autoFix(store, nodes, btn);
    assert.deepEqual(errorsOf(docWith(store, nodes)), [], 'the fixed button is clean');
    assert.deepEqual(btnPlan.summary.createdCollections.sort(), ['Button Color', 'Button Size', 'Button Variant']);
    assert.deepEqual(btnPlan.summary.reboundDims, [], 'nothing rebounds: the collections are created namespaced');
    const before = snapshotTemplate(store, btn);

    const inp = bindMaster(store, nodes, input, 'inp', 'Input', 'Search');
    assert.deepEqual(inp.behavior.variables, { variant: null, status: null, size: null }, 'nothing auto-matches across templates');
    const inpPlan = autoFix(store, nodes, inp);
    assert.deepEqual(errorsOf(docWith(store, nodes)), [], 'ZERO diagnostics after Auto Fix');
    assert.deepEqual(snapshotTemplate(store, btn), before, 'the button is untouched');
    assert.deepEqual(inpPlan.summary.createdCollections.sort(), ['Input Size', 'Input Status', 'Input Variant']);
    assert.equal(collectionName(store, inp.behavior.variables.variant), 'Input Variant');
    assert.equal(collectionName(store, inp.behavior.variables.status), 'Input Status');
    assert.equal(collectionName(store, inp.behavior.variables.size), 'Input Size');
    const second = planAutoFix({ template: input, binding: inp.behavior, variables: store, layers: [] });
    assert.equal(second.fixable, false, 'a second run is a no-op');
    assert.deepEqual(second.unfixable, []);
});

test('input fixed first, then button: identical names in the reverse order, the input is untouched', () => {
    const store = emptyStore();
    generateBase(store);
    const nodes = [];
    const inp = bindMaster(store, nodes, input, 'inp', 'Input', 'Search');
    autoFix(store, nodes, inp);
    assert.deepEqual(errorsOf(docWith(store, nodes)), [], 'the fixed input is clean');
    const before = snapshotTemplate(store, inp);

    const btn = bindMaster(store, nodes, button, 'btn', 'Button', 'Button');
    autoFix(store, nodes, btn);
    assert.deepEqual(errorsOf(docWith(store, nodes)), [], 'ZERO diagnostics after Auto Fix');
    assert.deepEqual(snapshotTemplate(store, inp), before, 'the input is untouched');
    assert.equal(collectionName(store, btn.behavior.variables.variant), 'Button Variant');
    assert.equal(collectionName(store, btn.behavior.variables.color), 'Button Color');
    assert.equal(collectionName(store, btn.behavior.variables.size), 'Button Size');
    for (const name of ['Button Variant', 'Button Color', 'Button Size', 'Input Variant', 'Input Status', 'Input Size']) {
        assert.equal(store.collections.filter(c => c.name === name).length, 1, `one ${name} collection`);
    }
    assert.ok(!store.collections.some(c => ['Variant', 'Color', 'Size', 'Status'].includes(c.name)), 'no plain names');
});

test('two buttons share Button Variant, Size and Color; a second fix is a no-op', () => {
    const store = emptyStore();
    generateBase(store);
    const nodes = [];
    const first = bindMaster(store, nodes, button, 'btn1', 'Button', 'One');
    autoFix(store, nodes, first);
    const secondMaster = bindMaster(store, nodes, button, 'btn2', 'Button', 'Two');
    autoFix(store, nodes, secondMaster);
    for (const name of ['Button Variant', 'Button Color', 'Button Size']) {
        assert.equal(store.collections.filter(c => c.name === name).length, 1, `one ${name} collection`);
    }
    assert.deepEqual(errorsOf(docWith(store, nodes)), [], 'ZERO diagnostics after Auto Fix');
    for (const master of [first, secondMaster]) {
        const second = planAutoFix({ template: button, binding: master.behavior, variables: store, layers: [] });
        assert.equal(second.fixable, false, 'a second run is a no-op');
    }
});
