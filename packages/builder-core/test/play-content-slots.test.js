// Play draws the content slots of a template instance (the codegen's slot element, class <template>-<slot>, around the layers the instance holds) and, for a
// slot that repeats, as many copies of them as the repeat prop says; the canvas keeps the content once. Play follows the rule of the export: copies are the
// prop clamped to a whole number of 0 or more (a value that is not a number: the schema default), none while the slot holds nothing, and with no copies
// the slot element is there, empty, only for a slot with showEmpty. No element gets an id: data-node-id names the design node and is the same on every copy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { applyTemplateToFrame, instanceOf } from '../src/behavior-engine/template-master.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { repeatCount } from '../src/behavior-engine/slot-rules.js';

const list = TEMPLATES.get('list');
const plain = { ...structuredClone(list), id: 'plainlist', name: 'PlainList', slots: [{ ...list.slots[0], repeat: undefined }] };
delete plain.slots[0].repeat;
const quiet = { ...structuredClone(list), id: 'quietlist', name: 'QuietList', slots: [{ ...list.slots[0], showEmpty: false }] };
TEMPLATES.set(plain.id, plain);
TEMPLATES.set(quiet.id, quiet);

const solid = [{ type: 'solid', color: '#ffffff', opacity: 1, visible: true }];
let seq = 0;

/** A document with a master of `template`, and an instance of it (the frame to draw) holding `held` text layers in its slot, with `props`. */
function documentOf(template, props, held) {
    const master = { id: `master-${++seq}`, name: template.name, type: 'frame', parentId: null, fills: [] };
    const created = applyTemplateToFrame(template, { frame: master, children: [], binding: { variables: {} }, variables: { collections: [], items: [] }, idOf: key => `${master.id}-${key}` }).created;
    const [root, ...copies] = instanceOf(template, master, created, props, { id: src => `i${seq}-${src}` });
    const nodes = copies.map(n => (n.propBind?.slot ? { ...n, visible: true } : n));
    const slot = nodes.find(n => n.propBind?.slot);
    const instance = { ...root, id: `inst-${seq}`, name: 'My list', x: 0, y: 0, w: 200, h: 100, fills: solid };
    const inner = nodes.map(n => (n.parentId === root.id ? { ...n, parentId: instance.id } : n));
    const content = Array.from({ length: held }, (_, i) => ({ id: `c${i}`, name: `Item ${i}`, type: 'text', parentId: slot.id, x: 0, y: 0, w: 60, h: 20, text: `Item ${i}`, fills: solid, fontSize: 14, autoW: true }));
    return { frameId: instance.id, doc: { variables: { collections: [], items: [] }, pages: [{ id: 'p', name: 'Screens', nodes: [master, ...created, instance, ...inner, ...content] }] } };
}
const rootOf = ({ doc, frameId }) => toDomTree(doc, frameId).root;
const slotEl = (el, template) => el.children.find(c => c.attrs?.class === `${template.id}-${template.slots[0].id}`);
const idsOf = el => (el ? el.children.map(c => c.nodeId) : null);

test('a slot of a template instance is drawn: one element of the slot\'s class, holding the layers the instance holds, after the other layers', () => {
    const el = slotEl(rootOf(documentOf(plain, {}, 2)), plain);
    assert.deepEqual(idsOf(el), ['c0', 'c1']);
    assert.equal(el.tag, 'div');
});

test('a slot that repeats draws itemCount copies of its layers, in order, in one slot element: 3 by default', () => {
    assert.deepEqual(idsOf(slotEl(rootOf(documentOf(list, {}, 2)), list)), ['c0', 'c1', 'c0', 'c1', 'c0', 'c1']);
    assert.deepEqual(idsOf(slotEl(rootOf(documentOf(list, { itemCount: 1 }, 2)), list)), ['c0', 'c1']);
    assert.deepEqual(idsOf(slotEl(rootOf(documentOf(list, { itemCount: 4 }, 1)), list)), ['c0', 'c0', 'c0', 'c0']);
    assert.equal(rootOf(documentOf(list, { itemCount: 4 }, 1)).children.filter(c => c.attrs?.class === 'list-item').length, 1);
});

test('itemCount is clamped to a whole number of 0 or more; null is the schema default', () => {
    const count = itemCount => idsOf(slotEl(rootOf(documentOf(list, { itemCount }, 1)), list)).length;
    assert.equal(count(2.9), 2);
    assert.equal(count(-5), 0);
    assert.equal(count(null), 3);
});

test('itemCount 0, or no layers: no copies; the slot element stays, empty, because the slot has showEmpty, and goes without it', () => {
    assert.deepEqual(idsOf(slotEl(rootOf(documentOf(list, { itemCount: 0 }, 2)), list)), []);
    assert.deepEqual(idsOf(slotEl(rootOf(documentOf(list, {}, 0)), list)), []);
    assert.equal(slotEl(rootOf(documentOf(quiet, { itemCount: 0 }, 2)), quiet), undefined);
    assert.equal(slotEl(rootOf(documentOf(quiet, {}, 0)), quiet), undefined);
    assert.deepEqual(idsOf(slotEl(rootOf(documentOf(quiet, { itemCount: 2 }, 1)), quiet)), ['c0', 'c0']);
});

test('copies share no id: no element has an id attribute, and every copy keeps the same data-node-id, the design node\'s', () => {
    const tree = rootOf(documentOf(list, { itemCount: 3 }, 1));
    const all = [];
    const walk = el => { all.push(el); (el.children ?? []).forEach(walk); };
    walk(tree);
    assert.equal(all.some(el => el.attrs && 'id' in el.attrs), false);
    assert.deepEqual(idsOf(slotEl(tree, list)), ['c0', 'c0', 'c0']);
});

test('Play and the export count alike: repeatCount is the clamp the generated copies() function writes', () => {
    const { files } = generateComponent(list, { variables: {} }, { collections: [], items: [] }, 'List', { id: 'm', type: 'frame', layout: 'vertical' }, () => []);
    const body = files['List.tsx'].slice(files['List.tsx'].indexOf('function copies'));
    const copies = new Function(`${body.replace(/count: number \| null \| undefined, fallback: number\): number/, 'count, fallback)')}; return copies;`)();
    for (const value of [0, 1, 2.9, -4, 7, NaN, Infinity, -Infinity, null, undefined]) for (const fallback of [0, 3]) assert.equal(repeatCount(value, fallback), copies(value, fallback), `${value} / ${fallback}`);
});
