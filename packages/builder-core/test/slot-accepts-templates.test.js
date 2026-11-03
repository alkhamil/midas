// A slot's `accepts` names template ids: a candidate qualifies when it is an instance of a master bound to one of them. The template is read from the
// master (`behavior.templateId`), never from the component's id or name, so a copy, a rename and a library component (a snapshot, and the copy a file
// imports from it) all resolve the same. The slot's `preferred` set (component ids) stays as it is; when a slot restricts by both, either list admits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { templateIdsOf } from '../src/behavior-engine/component-templates.js';
import { slotAccepts, slotRestricts } from '../src/behavior-engine/slot-rules.js';
import { diagnoseSlots } from '../src/behavior-engine/slot-diagnostics.js';

const master = (id, templateId, extra = {}) => ({ id, name: id, type: 'frame', component: true, parentId: null, ...(templateId ? { behavior: { version: 1, templateId } } : {}), ...extra });
const candidate = (ids, templates = []) => ({ ids, templates });

test('the templates of a component: its master binding; a set takes those of its variants; a plain component has none', () => {
    const nodes = [master('btn', 'button'), master('plain'), master('set', null, { component: false, componentSet: true }), master('v1', 'input', { parentId: 'set' }), master('v2', 'input', { parentId: 'set' }), master('v3', 'button', { parentId: 'set' })];
    assert.deepEqual(templateIdsOf(nodes, 'btn'), ['button']);
    assert.deepEqual(templateIdsOf(nodes, 'plain'), []);
    assert.deepEqual(templateIdsOf(nodes, 'set'), ['input', 'button'], 'once each, in variant order');
    assert.deepEqual(templateIdsOf(nodes, 'missing'), []);
});

test('a copy of a component, and a renamed one, resolve to the same template: the id and the name are not read', () => {
    const original = master('btn', 'button');
    const copy = { ...structuredClone(original), id: 'btn-copy', name: 'Button copy' };
    const renamed = { ...structuredClone(original), id: 'btn-2', name: 'Primary action' };
    assert.deepEqual(templateIdsOf([original, copy, renamed], 'btn-copy'), ['button']);
    assert.deepEqual(templateIdsOf([original, copy, renamed], 'btn-2'), ['button']);
    assert.deepEqual(templateIdsOf([{ ...original, name: 'Anything' }], 'btn'), ['button']);
});

test('a library snapshot component resolves from its own nodes, and so does the copy a file imports with new ids', () => {
    const snapshotComponent = { id: 'c1', name: 'Field', set: false, nodes: [{ ...master('c1', 'input'), parentId: null }, { id: 'c1-label', name: 'label', type: 'text', parentId: 'c1' }] };
    assert.deepEqual(templateIdsOf(snapshotComponent.nodes, snapshotComponent.id), ['input']);
    const imported = snapshotComponent.nodes.map(n => ({ ...structuredClone(n), id: `file-${n.id}`, parentId: n.parentId ? `file-${n.parentId}` : null, libRef: `lib:${n.id}` }));
    assert.deepEqual(templateIdsOf(imported, 'file-c1'), ['input']);
});

test('a slot that only accepts templates takes a candidate bound to one of them, and refuses any other', () => {
    const slot = { onlyAccepts: true, accepts: ['input', 'select'] };
    assert.equal(slotAccepts(slot, candidate(['x'], ['input'])), true);
    assert.equal(slotAccepts(slot, candidate(['x'], ['button', 'select'])), true);
    assert.equal(slotAccepts(slot, candidate(['x'], ['button'])), false);
    assert.equal(slotAccepts(slot, candidate(['x'], [])), false, 'a plain component is bound to no template');
});

test('accepts restricts only with onlyAccepts and a non-empty list, as preferred does with onlyPreferred', () => {
    assert.equal(slotRestricts({ onlyAccepts: true, accepts: ['input'] }), true);
    assert.equal(slotRestricts({ onlyAccepts: true, accepts: [] }), false);
    assert.equal(slotRestricts({ onlyAccepts: true }), false);
    assert.equal(slotRestricts({ onlyAccepts: false, accepts: ['input'] }), false);
    assert.equal(slotAccepts({ onlyAccepts: false, accepts: ['input'] }, candidate(['x'], ['button'])), true, 'a list the slot does not enforce admits everything');
});

test('precedence: each list that restricts is an allow list and either admits; a list that does not restrict does not count', () => {
    const both = { onlyAccepts: true, accepts: ['input'], onlyPreferred: true, preferred: ['mine'] };
    assert.equal(slotAccepts(both, candidate(['x'], ['input'])), true, 'by template');
    assert.equal(slotAccepts(both, candidate(['mine'], ['button'])), true, 'by preferred id, whatever its template');
    assert.equal(slotAccepts(both, candidate(['x'], ['button'])), false, 'neither');
    const templateOnly = { onlyAccepts: true, accepts: ['input'], onlyPreferred: false, preferred: ['mine'] };
    assert.equal(slotAccepts(templateOnly, candidate(['mine'], ['button'])), false, 'preferred is not enforced, so it does not admit');
    const preferredOnly = { onlyAccepts: false, accepts: ['input'], onlyPreferred: true, preferred: ['mine'] };
    assert.equal(slotAccepts(preferredOnly, candidate(['x'], ['input'])), false, 'accepts is not enforced, so it does not admit');
    assert.equal(slotAccepts({ onlyPreferred: true, preferred: ['a'] }, candidate(['a'])), true);
    assert.equal(slotAccepts({ onlyPreferred: true, preferred: ['a'] }, candidate(['b'], ['input'])), false);
    assert.equal(slotAccepts(undefined, candidate(['b'])), true);
});

/** A document: a card master with one slot, an instance of it, and content in the instance's slot (instances of `of`). */
function documentWith(prop, components, content) {
    return [
        { id: 'card', name: 'Card', type: 'frame', component: true, parentId: null, cprops: [{ id: 'p1', name: 'Content', type: 'slot', def: null, ...prop }] },
        { id: 'frame', name: 'Content', type: 'frame', parentId: 'card', propBind: { slot: 'p1' } },
        { id: 'inst', name: 'Login card', type: 'frame', parentId: null, isInstance: true, sourceId: 'card' },
        { id: 'slot', name: 'Content', type: 'frame', parentId: 'inst', sourceId: 'frame', propBind: { slot: 'p1' } },
        ...components,
        ...content.map((c, i) => ({ id: `c${i}`, name: c.name, type: 'frame', parentId: 'slot', isInstance: true, sourceId: c.of })),
    ];
}
const notAccepted = nodes => diagnoseSlots(nodes).filter(f => f.code === 'slot-not-accepted').map(f => f.layer);
const FIELDS = { onlyAccepts: true, accepts: ['input', 'select'] };

test('Diagnostics: an instance of a master bound to an accepted template is taken, any other is reported by name', () => {
    const nodes = documentWith(FIELDS, [master('inputMain', 'input'), master('btnMain', 'button'), master('plain')], [{ of: 'inputMain', name: 'Email' }, { of: 'btnMain', name: 'Go' }, { of: 'plain', name: 'Mine' }]);
    assert.deepEqual(notAccepted(nodes), ['c1', 'c2']);
    assert.match(diagnoseSlots(nodes).find(f => f.layer === 'c1').message, /^Login card: "Go" is not one of the templates slot "Content" accepts \(input, select\)\.$/);
});

test('Diagnostics: a copy of the component and a renamed component are still taken', () => {
    const copy = { ...master('inputCopy', 'input'), name: 'Input copy' };
    const renamed = { ...master('inputMain', 'input'), name: 'Email field' };
    assert.deepEqual(notAccepted(documentWith(FIELDS, [renamed, copy], [{ of: 'inputMain', name: 'A' }, { of: 'inputCopy', name: 'B' }])), []);
});

test('Diagnostics: an instance of a component imported from a library is taken; the imported copy keeps its template binding', () => {
    const snapshot = [{ ...master('c1', 'input'), parentId: null }];
    const imported = snapshot.map(n => ({ ...structuredClone(n), id: `file-${n.id}`, libRef: `lib:${n.id}`, libVersion: 3 }));
    assert.deepEqual(notAccepted(documentWith(FIELDS, imported, [{ of: 'file-c1', name: 'From library' }])), []);
    assert.deepEqual(notAccepted(documentWith({ onlyAccepts: true, accepts: ['select'] }, imported, [{ of: 'file-c1', name: 'From library' }])), ['c0']);
});

test('Diagnostics: an instance of a variant of a set is taken when the set holds an accepted template; and either list admits', () => {
    const set = [master('set', null, { component: false, componentSet: true }), master('v1', 'input', { parentId: 'set' })];
    assert.deepEqual(notAccepted(documentWith(FIELDS, set, [{ of: 'v1', name: 'A' }])), []);
    const both = { ...FIELDS, onlyPreferred: true, preferred: ['btnMain'] };
    assert.deepEqual(notAccepted(documentWith(both, [master('btnMain', 'button'), master('inputMain', 'input'), master('other', 'icon')], [{ of: 'btnMain', name: 'A' }, { of: 'inputMain', name: 'B' }, { of: 'other', name: 'C' }])), ['c2']);
});
