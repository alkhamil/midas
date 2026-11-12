// A template's `slots` become layers of its master: a frame with auto layout marked `propBind.slot`, and the slot property on the master, the same
// shape Convert to slot writes. The generator adds only what is missing (so part-missing reports a deleted slot frame and Auto Fix restores it),
// never touches what a designer put inside, and keeps the content slot apart from the template's icon slots.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { BUTTON } from '../src/templates/button.js';
import { applyTemplateToFrame, childOrderAfterBind, instanceOf, layerSpecsOf } from '../src/behavior-engine/template-master.js';
import { diagnoseDocument } from '../src/behavior-engine/diagnostics.js';
import { hasSlotProperty } from '../src/behavior-engine/content-slots.js';
import { newSlotProp } from '../src/behavior-engine/slot-property.js';
import { buttonModel } from '../../../scripts/button-model.mjs';

const HEADER = { id: 'header', name: 'Header', description: 'The top row', min: 1, max: 2, showEmpty: true, fillCounter: true, accepts: ['button', 'input'], onlyAccepts: true, layout: 'horizontal' };
const BODY = { id: 'body', name: 'Body', layout: 'vertical' };
const card = { ...structuredClone(BUTTON), id: 'cardtest', name: 'CardTest', slots: [HEADER, BODY] };
TEMPLATES.set(card.id, card);
after(() => TEMPLATES.delete(card.id));

const model = buttonModel({ colors: ['primary'], variantModes: ['solid'] });
const variables = { collections: model.collections, items: model.items };
const binding = { variables: { variant: model.ids.variant, color: model.ids.color, size: model.ids.size } };
let seq = 0;
const idOf = key => `c-${key}-${++seq}`;
const frame = () => ({ id: 'master', name: 'Card', type: 'frame', parentId: null, fills: [] });
const build = (f, children = []) => applyTemplateToFrame(card, { frame: f, children, binding, variables, idOf });
const docOf = (f, nodes) => ({ variables, pages: [{ name: 'p', nodes: [f, ...nodes] }] });
const missing = (f, nodes) => diagnoseDocument(docOf(f, nodes)).filter(finding => finding.code === 'part-missing').map(finding => finding.layer);

test('a template with slots has one content layer per slot, after its parts and in schema order; a template without slots has none', () => {
    const specs = layerSpecsOf(card);
    assert.deepEqual(specs.map(s => s.key), ['root', 'iconStart', 'spinner', 'label', 'iconEnd', 'header', 'body']);
    assert.deepEqual(specs.filter(s => s.role === 'content').map(s => s.key), ['header', 'body']);
    assert.equal(layerSpecsOf(BUTTON).some(s => s.role === 'content'), false);
});

test('the generator makes each slot a frame with the schema layout, marked as the slot property, and no behavior marker of an icon slot', () => {
    const f = frame();
    const out = build(f);
    const header = out.created.find(n => n.propBind?.slot === 'header');
    const body = out.created.find(n => n.propBind?.slot === 'body');
    assert.equal(header.type, 'frame');
    assert.equal(header.layout, 'horizontal');
    assert.equal(body.layout, 'vertical');
    assert.equal(header.name, 'Header');
    assert.equal(header.parentId, f.id);
    assert.ok(hasSlotProperty(header));
    assert.equal(header.behavior?.slot, undefined, 'a content slot is not a managed icon slot');
    assert.deepEqual(out.problems, []);
});

test('the slot property is the one Convert to slot writes, with the schema name, description, limits, options and accepted templates', () => {
    const f = frame();
    build(f);
    assert.deepEqual(f.cprops.map(p => p.id), ['header', 'body']);
    assert.deepEqual(f.cprops[0], { ...newSlotProp('header', 'Header'), desc: 'The top row', min: 1, max: 2, showEmpty: true, fillCounter: true, accepts: ['button', 'input'], onlyAccepts: true, holds: 'instance' });
    assert.deepEqual(f.cprops[1], { ...newSlotProp('body', 'Body'), holds: 'content' }, 'a slot that declares only its layout has the bare property and what it holds');
});

test('applying again creates nothing and leaves the property as it is, however a designer edited it', () => {
    const f = frame();
    const first = build(f);
    f.cprops[0].max = 9;
    f.cprops.push(newSlotProp('mine', 'Mine'));
    const second = build(f, first.created);
    assert.deepEqual(second.created, []);
    assert.equal(f.cprops.length, 3);
    assert.equal(f.cprops[0].max, 9);
});

test('a slot frame a designer already marked is matched, not duplicated, and what is inside it is not touched', () => {
    const f = frame();
    const mine = { id: 'mine', name: 'Top', type: 'frame', parentId: f.id, layout: 'horizontal', propBind: { slot: 'header' } };
    const inside = { id: 'inside', name: 'x', type: 'text', parentId: 'mine', text: 'hello' };
    const out = build(f, [mine]);
    assert.equal(out.created.filter(n => n.propBind?.slot === 'header').length, 0);
    assert.ok(out.matched.some(m => m.key === 'header' && m.nodeId === 'mine'));
    assert.equal(inside.text, 'hello');
    assert.equal(mine.name, 'Top');
});

test('a master that lacks a slot frame is reported by part-missing; the generator restores the frame and not the content of the others', () => {
    const f = frame();
    const first = build(f);
    const body = first.created.find(n => n.propBind?.slot === 'body');
    const kept = { id: 'kept', name: 'k', type: 'text', parentId: body.id, text: 'stay' };
    const header = first.created.find(n => n.propBind?.slot === 'header');
    const rest = first.created.filter(n => n !== header);
    assert.deepEqual(missing(f, [...rest, kept]), ['header']);
    const again = build(f, rest);
    assert.deepEqual(again.created.map(n => n.propBind?.slot), ['header']);
    assert.equal(kept.parentId, body.id);
    assert.deepEqual(missing(f, [...rest, ...again.created, kept]), []);
});

test('a complete master has no part-missing, and a template with no slots reports no content layer', () => {
    const f = frame();
    const out = build(f);
    assert.deepEqual(missing(f, out.created), []);
});

test('the content layers sit after the parts when the generator orders the new layers, and an instance copies the frame with its slot marker', () => {
    const f = frame();
    const out = build(f);
    const order = childOrderAfterBind(card, out.created, out.created);
    const names = order.map(id => out.created.find(n => n.id === id).name);
    assert.deepEqual(names.slice(-2), ['Header', 'Body']);
    const copies = instanceOf(card, f, out.created, {}, { id: src => `i-${src}` });
    const copy = copies.find(n => n.sourceId === out.created.find(c => c.propBind?.slot === 'header').id);
    assert.equal(copy.propBind.slot, 'header');
    assert.equal(copy.layout, 'horizontal');
});
