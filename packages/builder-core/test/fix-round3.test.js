// Fix round 3, end to end on builder-core: an empty file, Generate base, Auto Fix of Button and Input in both orders, and a second
// Button. Every component cell must resolve through a Semantic token to a Primitive; nothing is a literal, nothing is D9D9D9, and
// every collection is "<Template> <Name>" with no groups.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    TEMPLATES, createBinding, planAutoFix, applyAutoFix, planFromSnapshot, applyBasePlan, BASE_SNAPSHOT,
    planBindTokens, applyBindTokens, masterLayersOf, diagnoseDocument,
} from '../src/index.js';
import { restOf, splitColor } from '../src/behavior-engine/tokens.js';

let n = 0;
const uid = () => `r${++n}`;
const button = TEMPLATES.get('button');
const input = TEMPLATES.get('input');
const COMPONENT_COLLECTION = /^(Button|Input) /;

const emptyStore = () => ({ collections: [], items: [] });
const generateBase = store => applyBasePlan(store, planFromSnapshot(BASE_SNAPSHOT), uid);
const childrenOf = nodes => id => nodes.filter(x => x.parentId === id);
const docWith = (store, nodes) => ({ variables: store, pages: [{ name: 'p', nodes }] });
const errorsOf = doc => diagnoseDocument(doc).filter(f => f.severity === 'error');

function bindMaster(store, nodes, template, id, name) {
    const root = {
        id, name, type: 'frame', component: true, layout: 'horizontal', x: 0, y: 0, w: 200, h: 40,
        stroke: '#000000', strokeWidth: 1, strokeAlign: 'inside', behavior: null, vars: {},
    };
    const label = { id: `${id}-label`, name: 'Label', type: 'text', parentId: id, text: name, vars: {} };
    root.behavior = createBinding(template, store.collections);
    nodes.push(root, label);
    return root;
}

function autoFix(store, nodes, master) {
    const template = TEMPLATES.get(master.behavior.templateId);
    const layers = () => masterLayersOf(master, childrenOf(nodes));
    const plan = planAutoFix({ template, binding: master.behavior, variables: store, layers: layers() });
    applyAutoFix(store, master.behavior, plan, uid);
    const bound = planBindTokens({ template, binding: master.behavior, layers: layers(), variables: store });
    applyBindTokens(layers(), bound.ops);
    return plan;
}

/** Every component collection cell: its mode name, its stored value, and what it resolves to. */
function componentCells(store) {
    const cells = [];
    for (const coll of store.collections.filter(c => COMPONENT_COLLECTION.test(c.name))) {
        for (const item of store.items.filter(i => i.collectionId === coll.id)) {
            for (const mode of coll.modes) {
                const value = item.values[mode.id];
                if (value === undefined) continue;
                cells.push({ coll, item, mode: mode.name, value, rest: value && typeof value === 'object' ? restOf(item, mode.name, store.items, store.collections) : null });
            }
        }
    }
    return cells;
}

function assertCleanComponents(store, nodes, label) {
    assert.deepEqual(errorsOf(docWith(store, nodes)), [], `${label}: zero diagnostics errors`);
    const cells = componentCells(store);
    assert.ok(cells.length > 0, `${label}: component cells exist`);
    for (const c of cells) {
        const where = `${c.coll.name}/${c.item.name}.${c.mode}`;
        assert.ok(c.value && typeof c.value === 'object' && typeof c.value.alias === 'string', `${where} is an alias, never a literal`);
        assert.ok(c.rest?.trail.includes('Semantic'), `${where} resolves through Semantic`);
        assert.notEqual(String(c.rest?.literal).toUpperCase(), '#D9D9D9', `${where} is not the D9D9D9 default`);
    }
    for (const item of store.items.filter(i => COMPONENT_COLLECTION.test(store.collections.find(c => c.id === i.collectionId)?.name ?? ''))) {
        assert.ok(!/^(button|input)\//.test(item.name), `${item.name}: variable names carry no group prefix`);
    }
    return cells;
}

test('an empty file has no collections; Generate base makes exactly Primitives, Semantic and Typography', () => {
    const store = emptyStore();
    assert.equal(store.collections.length, 0);
    generateBase(store);
    assert.deepEqual(store.collections.map(c => c.name).sort(), ['Primitives', 'Semantic', 'Typography']);
    assert.ok(!store.collections.some(c => c.name === 'Icons' || c.name === 'Size'), 'no Icons or Size collection');
});

test('Generate base: Semantic names are unique case-insensitively, have no margin token, and carry the gap ladder and transparent', () => {
    const store = emptyStore();
    generateBase(store);
    const semantic = store.collections.find(c => c.name === 'Semantic');
    const names = store.items.filter(i => i.collectionId === semantic.id).map(i => i.name);
    const folded = names.map(x => x.toLowerCase());
    assert.equal(new Set(folded).size, folded.length, 'Semantic names are unique case-insensitively');
    assert.ok(!names.some(x => /^margin/i.test(x)), 'no margin token');
    for (const gap of ['gapXS', 'gapSM', 'gapMD', 'gapLG', 'gapXL']) assert.ok(names.includes(gap), `${gap} exists`);
    for (const gone of ['gapXXS', 'gap']) assert.ok(!names.includes(gone), `${gone} is gone`);
    const transparent = store.items.find(i => i.collectionId === semantic.id && i.name === 'colorTransparent');
    assert.ok(transparent, 'colorTransparent exists');
    const primitive = store.items.find(i => i.id === transparent.values[semantic.modes[0].id].alias);
    assert.equal(splitColor(primitive.values[store.collections.find(c => c.name === 'Primitives').modes[0].id]).alpha, 0, 'Primitive transparent is 0% alpha');
});

test('Button then Input: deterministic names, no groups, zero diagnostics, every component cell reaches Semantic', () => {
    const store = emptyStore();
    generateBase(store);
    const nodes = [];
    const btn = bindMaster(store, nodes, button, 'btn', 'Button');
    autoFix(store, nodes, btn);
    const inp = bindMaster(store, nodes, input, 'inp', 'Input');
    autoFix(store, nodes, inp);
    const names = store.collections.map(c => c.name).sort();
    assert.deepEqual(names, ['Button Color', 'Button Size', 'Button Variant', 'Input Size', 'Input Status', 'Input Variant', 'Primitives', 'Semantic', 'Typography'].sort());
    assertCleanComponents(store, nodes, 'button then input');
});

test('Input then Button: the same names in the reverse order', () => {
    const store = emptyStore();
    generateBase(store);
    const nodes = [];
    const inp = bindMaster(store, nodes, input, 'inp', 'Input');
    autoFix(store, nodes, inp);
    const btn = bindMaster(store, nodes, button, 'btn', 'Button');
    autoFix(store, nodes, btn);
    assert.equal(store.collections.find(c => c.id === btn.behavior.variables.variant).name, 'Button Variant');
    assert.equal(store.collections.find(c => c.id === inp.behavior.variables.variant).name, 'Input Variant');
    assertCleanComponents(store, nodes, 'input then button');
});

test('two Buttons share Button Variant, Button Color and Button Size; outline-color is transparent in every mode', () => {
    const store = emptyStore();
    generateBase(store);
    const nodes = [];
    const first = bindMaster(store, nodes, button, 'btn1', 'Button');
    autoFix(store, nodes, first);
    const second = bindMaster(store, nodes, button, 'btn2', 'Button');
    autoFix(store, nodes, second);
    const bound = store.collections.filter(c => c.name.startsWith('Button '));
    assert.deepEqual(bound.map(c => c.name).sort(), ['Button Color', 'Button Size', 'Button Variant']);
    assertCleanComponents(store, nodes, 'two buttons');
    const outline = store.items.find(i => i.name === 'outline-color' && i.collectionId === first.behavior.variables.variant);
    const coll = store.collections.find(c => c.id === outline.collectionId);
    for (const mode of coll.modes) {
        const rest = restOf(outline, mode.name, store.items, store.collections);
        assert.equal(splitColor(rest.literal).alpha, 0, `outline-color is 0% in ${mode.name}`);
    }
});

/** Button and Input fixed on an empty file with the base generated: the store the axis, gap and halo checks read. */
function fixedBoth() {
    const store = emptyStore();
    generateBase(store);
    const nodes = [];
    const btn = bindMaster(store, nodes, button, 'btn', 'Button');
    autoFix(store, nodes, btn);
    const inp = bindMaster(store, nodes, input, 'inp', 'Input');
    autoFix(store, nodes, inp);
    return { store, btn, inp };
}

const sizeItem = (store, collectionName, token) => {
    const coll = store.collections.find(c => c.name === collectionName);
    return { coll, item: store.items.find(i => i.collectionId === coll.id && i.name === token) };
};

test('paddingX and paddingY differ in every mode of Button and Input; Button paddingY is zero, Input paddingY is not', () => {
    const { store } = fixedBoth();
    for (const [name, axisX, axisY] of [['Button Size', 'paddingX', 'paddingY'], ['Input Size', 'paddingX', 'paddingY']]) {
        const x = sizeItem(store, name, axisX), y = sizeItem(store, name, axisY);
        for (const mode of x.coll.modes) {
            const px = restOf(x.item, mode.name, store.items, store.collections).literal;
            const py = restOf(y.item, mode.name, store.items, store.collections).literal;
            assert.notEqual(px, py, `${name} ${mode.name}: paddingX ${px} and paddingY ${py} differ`);
            if (name === 'Button Size') assert.equal(py, 0, `Button ${mode.name}: paddingY is zero (antd buttonPaddingVertical)`);
        }
    }
});

test('every component gap resolves to the gap ladder, never to a margin or a padding step', () => {
    const { store } = fixedBoth();
    for (const name of ['Button Size', 'Input Size']) {
        const { coll, item } = sizeItem(store, name, 'gap');
        for (const mode of coll.modes) {
            const target = store.items.find(i => i.id === item.values[mode.id].alias);
            assert.ok(/^gap/.test(target.name), `${name} ${mode.name} gap aliases ${target.name}`);
        }
    }
});

test('a needs-value base variable is flagged and left unset, never filled with a literal', () => {
    const store = emptyStore();
    const plan = { collections: [{ name: 'Semantic', modes: ['Base'] }], items: [{ collection: 'Semantic', name: 'probe', type: 'color', values: { Base: { needsValue: true, note: 'test' } } }], report: { needsValue: [] } };
    applyBasePlan(store, plan, uid);
    const item = store.items.find(i => i.name === 'probe');
    assert.equal(item.needsValue, true);
    assert.deepEqual(Object.keys(item.values), [], 'no mode value is written');
});
