// Diagnostics of content slots: a slot that holds fewer layers than its minimum, more than its maximum, or a layer it does not take. Warnings, not
// errors: the designer can still do it, and the file says so. One scan of the document, so every way content enters a slot (the picker, a paste,
// a drag, a duplicate, an import, a delete) ends in the same report. Content slots only; the icon slots of a template have their own checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseSlots } from '../src/behavior-engine/slot-diagnostics.js';
import { slotRestricts } from '../src/behavior-engine/slot-rules.js';

/**
 * A document with a main component `card` that holds one slot property (`prop`) on a frame, an instance `inst` of it, and `content` in the
 * instance's slot. `extra` adds nodes (components the content is an instance of).
 */
function documentWith(prop, content = [], extra = []) {
    return [
        { id: 'card', name: 'Card', type: 'frame', component: true, parentId: null, cprops: prop ? [{ id: 'p1', name: 'Content', type: 'slot', def: null, ...prop }] : [] },
        { id: 'frame', name: 'Content', type: 'frame', parentId: 'card', propBind: { slot: 'p1' } },
        { id: 'inst', name: 'Login card', type: 'frame', parentId: null, isInstance: true, sourceId: 'card' },
        { id: 'slot', name: 'Content', type: 'frame', parentId: 'inst', sourceId: 'frame', propBind: { slot: 'p1' } },
        { id: 'inputMain', name: 'Input', type: 'frame', component: true, parentId: null },
        { id: 'selectMain', name: 'Select', type: 'frame', component: true, parentId: null },
        ...extra,
        ...content.map((c, i) => ({ id: `c${i}`, name: c.name ?? `Item ${i}`, type: 'frame', parentId: 'slot', ...(c.of ? { isInstance: true, sourceId: c.of } : {}) })),
    ];
}
const codes = findings => findings.map(f => f.code);

test('a slot within its limits and its preferred instances has nothing to report', () => {
    assert.deepEqual(diagnoseSlots(documentWith({ min: 1, max: 2, onlyPreferred: true, preferred: ['inputMain'] }, [{ of: 'inputMain' }])), []);
    assert.deepEqual(diagnoseSlots(documentWith({}, [])), [], 'no limit, nothing preferred');
    assert.deepEqual(diagnoseSlots([]), []);
});

test('a slot below its minimum is reported on the instance that owns it, with what it holds and what it needs', () => {
    const [finding, ...rest] = diagnoseSlots(documentWith({ min: 2 }, [{ of: 'inputMain' }]));
    assert.equal(rest.length, 0);
    assert.equal(finding.severity, 'warning');
    assert.equal(finding.code, 'slot-below-min');
    assert.equal(finding.nodeId, 'inst');
    assert.equal(finding.node, 'Login card');
    assert.equal(finding.slot, 'slot');
    assert.equal(finding.message, 'Login card: slot "Content" holds 1 layer, at least 2 needed.');
    assert.equal(diagnoseSlots(documentWith({ min: 1 }, []))[0].message, 'Login card: slot "Content" holds 0 layers, at least 1 needed.');
});

test('a slot above its maximum is reported, and a full slot is not', () => {
    const three = [{ of: 'inputMain' }, { of: 'inputMain' }, { of: 'inputMain' }];
    const [finding, ...rest] = diagnoseSlots(documentWith({ max: 2 }, three));
    assert.equal(rest.length, 0);
    assert.equal(finding.code, 'slot-above-max');
    assert.equal(finding.message, 'Login card: slot "Content" holds 3 layers, at most 2 allowed.');
    assert.deepEqual(diagnoseSlots(documentWith({ max: 3 }, three)), [], 'at the maximum is fine');
    assert.equal(diagnoseSlots(documentWith({ max: 1 }, three.slice(0, 2)))[0].message, 'Login card: slot "Content" holds 2 layers, at most 1 allowed.');
});

test('a layer the slot does not take is reported by name, when the slot only allows its preferred instances', () => {
    const slot = { onlyPreferred: true, preferred: ['inputMain'] };
    const [finding, ...rest] = diagnoseSlots(documentWith(slot, [{ of: 'inputMain', name: 'Email' }, { of: 'selectMain', name: 'Country' }]));
    assert.equal(rest.length, 0);
    assert.equal(finding.code, 'slot-not-accepted');
    assert.equal(finding.nodeId, 'inst');
    assert.equal(finding.layer, 'c1');
    assert.equal(finding.message, 'Login card: "Country" is not one of the preferred instances of slot "Content".');
    assert.deepEqual(diagnoseSlots(documentWith({ onlyPreferred: false, preferred: ['inputMain'] }, [{ of: 'selectMain' }])), [], 'the option is off');
    assert.deepEqual(diagnoseSlots(documentWith({ onlyPreferred: true, preferred: [] }, [{ of: 'selectMain' }])), [], 'nothing preferred, nothing to restrict to');
});

test('a plain layer is not a preferred instance either', () => {
    const [finding] = diagnoseSlots(documentWith({ onlyPreferred: true, preferred: ['inputMain'] }, [{ name: 'Rectangle' }]));
    assert.equal(finding.code, 'slot-not-accepted');
    assert.match(finding.message, /"Rectangle" is not one of the preferred/);
});

test('another variant of a preferred component is a preferred instance: the preferred one names the set\'s default variant', () => {
    const set = [
        { id: 'set', name: 'Input', type: 'frame', component: true, componentSet: true, parentId: null },
        { id: 'varA', name: 'Default', type: 'frame', component: true, parentId: 'set' },
        { id: 'varB', name: 'Error', type: 'frame', component: true, parentId: 'set' },
    ];
    const slot = { onlyPreferred: true, preferred: ['varA'] };
    assert.deepEqual(diagnoseSlots(documentWith(slot, [{ of: 'varB' }], set)), [], 'a sibling variant');
    assert.deepEqual(diagnoseSlots(documentWith({ ...slot, preferred: ['set'] }, [{ of: 'varB' }], set)), [], 'the set itself preferred');
    assert.equal(diagnoseSlots(documentWith(slot, [{ of: 'selectMain' }], set))[0].code, 'slot-not-accepted');
});

test('every problem of a slot is reported, in document order', () => {
    const slot = { min: 3, max: 4, onlyPreferred: true, preferred: ['inputMain'] };
    assert.deepEqual(codes(diagnoseSlots(documentWith(slot, [{ of: 'selectMain' }]))), ['slot-below-min', 'slot-not-accepted']);
    assert.deepEqual(codes(diagnoseSlots(documentWith({ ...slot, min: 0, max: 1 }, [{ of: 'selectMain' }, { of: 'selectMain' }]))), ['slot-above-max', 'slot-not-accepted', 'slot-not-accepted']);
});

test('the frame in the main component is not checked, and a slot whose property is gone has nothing to check', () => {
    const nodes = documentWith({ min: 5 }, []).filter(n => n.id !== 'inst' && n.id !== 'slot');
    assert.deepEqual(diagnoseSlots(nodes), [], 'only an instance fills a slot');
    const orphan = documentWith(null, []);
    assert.deepEqual(diagnoseSlots(orphan), [], 'no property, no limits');
});

test('a slot of an instance inside an instance is reported on the nearest instance above it', () => {
    const nodes = [
        { id: 'card', name: 'Card', type: 'frame', component: true, parentId: null, cprops: [{ id: 'p1', name: 'Body', type: 'slot', min: 1 }] },
        { id: 'frame', name: 'Body', type: 'frame', parentId: 'card', propBind: { slot: 'p1' } },
        { id: 'page', name: 'Page', type: 'frame', parentId: null },
        { id: 'outer', name: 'Outer', type: 'frame', parentId: 'page', isInstance: true, sourceId: 'shell' },
        { id: 'wrap', name: 'Wrap', type: 'frame', parentId: 'outer' },
        { id: 'inner', name: 'Inner card', type: 'frame', parentId: 'wrap', isInstance: true, sourceId: 'card' },
        { id: 'slot', name: 'Body', type: 'frame', parentId: 'inner', sourceId: 'frame', propBind: { slot: 'p1' } },
    ];
    const [finding] = diagnoseSlots(nodes);
    assert.equal(finding.nodeId, 'inner');
    assert.equal(finding.node, 'Inner card');
});

test('slotRestricts says whether a slot takes only some components', () => {
    assert.equal(slotRestricts({ onlyPreferred: true, preferred: ['a'] }), true);
    assert.equal(slotRestricts({ onlyPreferred: true, preferred: [] }), false);
    assert.equal(slotRestricts({ onlyPreferred: true }), false);
    assert.equal(slotRestricts({ onlyPreferred: false, preferred: ['a'] }), false);
    assert.equal(slotRestricts(undefined), false);
});
