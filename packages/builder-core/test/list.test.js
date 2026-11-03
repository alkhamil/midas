// List: a template made of one content slot, `item`, that is repeated `itemCount` times in Play and in the export (the canvas draws it once). The slot is
// min 1 and max 1 on purpose: one item template, repeated. This file covers the template as data and the master and instance the generator makes from it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { applyTemplateToFrame, instanceOf, layerSpecsOf } from '../src/behavior-engine/template-master.js';
import { diagnoseDocument } from '../src/behavior-engine/diagnostics.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';

const list = TEMPLATES.get('list');
const variables = { collections: [], items: [] };
const binding = { variables: {} };
const frame = () => ({ id: 'master', name: 'List', type: 'frame', parentId: null, fills: [] });
const build = f => applyTemplateToFrame(list, { frame: f, children: [], binding, variables, idOf: key => `l-${key}` });

test('List is a registered template, valid on its own: no anatomy, no variable props, one repeated item slot of exactly one layer', () => {
    assert.ok(list, 'registered');
    assert.deepEqual(validateTemplateSchema(list, { templateIds: new Set(TEMPLATES.keys()) }), []);
    assert.deepEqual(list.anatomy, []);
    assert.deepEqual(Object.values(list.props).filter(p => p.source === 'variable'), []);
    assert.deepEqual(list.slots.map(s => [s.id, s.min, s.max, s.repeat, s.layout, s.showEmpty]), [['item', 1, 1, 'itemCount', 'vertical', true]]);
    assert.equal(list.props.itemCount.default, 3);
    assert.deepEqual(layerSpecsOf(list).map(s => [s.key, s.role]), [['root', 'root'], ['item', 'content']]);
});

test('the generator builds a vertical master with the item slot frame and its property, and builds nothing the second time', () => {
    const f = frame();
    const out = build(f);
    assert.equal(f.layout, 'vertical');
    assert.deepEqual(out.problems, []);
    assert.deepEqual(out.created.map(n => n.propBind?.slot), ['item']);
    assert.deepEqual(f.cprops.map(p => [p.id, p.min, p.max, p.showEmpty, p.fillCounter]), [['item', 1, 1, true, true]]);
    assert.deepEqual(applyTemplateToFrame(list, { frame: f, children: out.created, binding, variables, idOf: key => key }).created, []);
});

test('an instance holds itemCount as a prop, 3 until it is set, and the canvas copy has the item once', () => {
    const f = frame();
    const created = build(f).created;
    assert.equal(resolveProps(list, {}).itemCount, 3);
    assert.equal(resolveProps(list, { itemCount: 5 }).itemCount, 5);
    const copies = instanceOf(list, f, created, { itemCount: 5 }, { id: src => `i-${src}` });
    assert.equal(copies.filter(n => n.propBind?.slot === 'item').length, 1, 'the canvas never repeats');
});

test('a List with one component in its item slot has nothing to report, with none it is below its minimum, with two above its maximum', () => {
    const f = frame();
    const created = build(f).created;
    const plain = { id: 'plain', name: 'Row', type: 'frame', component: true, parentId: null };
    const docOf = (...held) => {
        const [root, ...copies] = instanceOf(list, f, created, {}, { id: src => `i-${src}` });
        const slot = copies.find(n => n.propBind?.slot === 'item');
        return { variables, pages: [{ name: 'p', nodes: [f, ...created, plain, { ...root, id: 'inst', name: 'My list' }, ...copies.map(n => (n.parentId === root.id ? { ...n, parentId: 'inst' } : n)), ...held.map((of, i) => ({ id: `h${i}`, name: `Row ${i}`, type: 'frame', parentId: slot.id, isInstance: true, sourceId: of }))] }] };
    };
    const codes = doc => diagnoseDocument(doc).filter(x => x.code.startsWith('slot-')).map(x => x.code);
    assert.deepEqual(codes(docOf('plain')), []);
    assert.deepEqual(codes(docOf()), ['slot-below-min']);
    assert.deepEqual(codes(docOf('plain', 'plain')), ['slot-above-max']);
});
