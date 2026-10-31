// Auto Fix across templates sharing a file: the second template's frames auto-match by name to the first
// template's collections. A same-named collection is shared only when its modes match the schema exactly;
// otherwise Auto Fix creates a namespaced "<Template> <Name>" collection, rebinds the frame to it, and leaves
// the first template's collections, variables and bindings untouched.
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

/** A bound master, auto-matched by name against the store (what binding a template does in the editor). */
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

/** What must not change when another template is fixed: the binding, the collections, the group's variables. */
const snapshotGroup = (store, master, group) => ({
    binding: structuredClone(master.behavior),
    collections: structuredClone(store.collections.filter(c => Object.values(master.behavior.variables).includes(c.id))),
    variables: structuredClone(store.items.filter(i => i.name.toLowerCase().startsWith(`${group}/`)).sort((a, b) => (a.name < b.name ? -1 : 1))),
});

test('button fixed first, then input: Size is shared, Variant is namespaced, the button is untouched', () => {
    const store = emptyStore();
    generateBase(store);
    const nodes = [];
    const btn = bindMaster(store, nodes, button, 'btn', 'Button', 'Button');
    autoFix(store, nodes, btn);
    assert.deepEqual(errorsOf(docWith(store, nodes)), [], 'the fixed button is clean');
    const before = snapshotGroup(store, btn, 'button');

    const inp = bindMaster(store, nodes, input, 'inp', 'Input', 'Search');
    assert.equal(collectionName(store, inp.behavior.variables.variant), 'Variant', 'variant auto-matches by name');
    assert.equal(collectionName(store, inp.behavior.variables.size), 'Size', 'size auto-matches by name');
    assert.equal(inp.behavior.variables.status, null, 'status has no collection yet');

    const stuck = errorsOf(docWith(store, nodes));
    assert.ok(stuck.some(f => f.code === 'mode-mismatch' && f.collection === 'Variant'), 'the mismatch names the bound collection');
    assert.ok(!stuck.some(f => f.variable?.startsWith('input/') && f.collection === 'Variant'), 'no consequent variable errors for the mismatched dimension');
    assert.ok(stuck.some(f => f.code === 'variable-missing' && f.collection === 'Size'), 'the shared collection is named as bound');

    const plan = autoFix(store, nodes, inp);
    assert.deepEqual(errorsOf(docWith(store, nodes)), [], 'ZERO diagnostics after Auto Fix');
    assert.deepEqual(snapshotGroup(store, btn, 'button'), before, 'the button is untouched');
    assert.equal(collectionName(store, inp.behavior.variables.variant), 'Input Variant', 'variant rebounds to the namespaced collection');
    assert.equal(collectionName(store, inp.behavior.variables.size), 'Size', 'size shares the button collection');
    assert.equal(collectionName(store, inp.behavior.variables.status), 'Status', 'status binds the created collection');
    assert.ok(plan.summary.createdCollections.includes('Input Variant'), 'the report lists the created collection');
    assert.ok(plan.summary.reboundDims.some(r => r.dim === 'variant' && r.from === 'Variant' && r.to === 'Input Variant'), 'the report lists the rebound dimension');
    const second = planAutoFix({ template: input, binding: inp.behavior, variables: store, layers: [] });
    assert.equal(second.fixable, false, 'a second run is a no-op');
    assert.deepEqual(second.unfixable, []);
});

test('input fixed first, then button: the button namespaces its Variant, the input is untouched', () => {
    const store = emptyStore();
    generateBase(store);
    const nodes = [];
    const inp = bindMaster(store, nodes, input, 'inp', 'Input', 'Search');
    autoFix(store, nodes, inp);
    assert.deepEqual(errorsOf(docWith(store, nodes)), [], 'the fixed input is clean');
    const before = snapshotGroup(store, inp, 'input');

    const btn = bindMaster(store, nodes, button, 'btn', 'Button', 'Button');
    assert.equal(collectionName(store, btn.behavior.variables.variant), 'Variant', 'variant auto-matches by name');
    autoFix(store, nodes, btn);
    assert.deepEqual(errorsOf(docWith(store, nodes)), [], 'ZERO diagnostics after Auto Fix');
    assert.deepEqual(snapshotGroup(store, inp, 'input'), before, 'the input is untouched');
    assert.equal(collectionName(store, btn.behavior.variables.variant), 'Button Variant', 'variant rebounds to the namespaced collection');
    assert.equal(collectionName(store, btn.behavior.variables.size), 'Size', 'size shares the input collection');
});

test('two buttons share one Variant, Size and Color collection; a second fix is a no-op', () => {
    const store = emptyStore();
    generateBase(store);
    const nodes = [];
    const first = bindMaster(store, nodes, button, 'btn1', 'Button', 'One');
    autoFix(store, nodes, first);
    const secondMaster = bindMaster(store, nodes, button, 'btn2', 'Button', 'Two');
    autoFix(store, nodes, secondMaster);
    for (const name of ['Variant', 'Size', 'Color']) {
        assert.equal(store.collections.filter(c => c.name === name).length, 1, `one ${name} collection`);
    }
    assert.deepEqual(errorsOf(docWith(store, nodes)), [], 'ZERO diagnostics after Auto Fix');
    for (const master of [first, secondMaster]) {
        const second = planAutoFix({ template: button, binding: master.behavior, variables: store, layers: [] });
        assert.equal(second.fixable, false, 'a second run is a no-op');
    }
});
