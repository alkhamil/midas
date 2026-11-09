// The InputNumber on the canvas, master and instance, at every Size: the editor places the handler column (and the text area's grip) from the box's size and their own tokens
// (placePinned -> pinnedFrame), so the column is fixed at the inside of the right border and the full height inside it, not at 0,0 with a width the document has not applied yet.
// Replayed with the real studio functions; the layout engine itself (halves of 50%, centring) needs a browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '@midas/builder-core';
import { studioReplay } from './helpers/studioReplay.js';

const SIZES = ['xs', 'sm', 'md', 'lg', 'xl'];

function world() {
    const replay = studioReplay();
    const { doc } = replay;
    const page = { id: 'ds', name: core.DESIGN_SYSTEM_PAGE, nodes: [], parentId: null };
    doc.data.pages.push(page);
    doc.data.pageId = page.id;
    core.applyBasePlan(replay.varStore(), core.planFromSnapshot(core.BASE_SNAPSHOT), replay.stubs.uid);
    replay.onPage(page.id, () => replay.buildDesignSystemPage({ variables: 0, icons: 0, iconsPresent: 0, created: 0, present: 0, problems: 0 }));
    doc.refresh();
    return { replay, doc, page };
}
const number = core.TEMPLATES.get('inputnumber');
const slot = number.anatomy.find(s => s.id === 'stepper');

/** The tokens of a host at one Size, as the editor resolves them. */
function varsOf({ replay, doc }, host, size) {
    const binding = doc.get(host.sourceId ?? host.id)?.behavior ?? host.behavior;
    const master = doc.get(host.sourceId ?? host.id);
    const modes = Object.fromEntries(Object.entries(master.behavior.variables).map(([prop, cid]) => {
        const coll = doc.data.variables.collections.find(c => c.id === cid);
        const want = prop === 'size' ? size : number.props[prop].defaultMode ?? coll.modes[0].name;
        return [prop, (coll.modes.find(m => m.name === want) ?? coll.modes[0]).id];
    }));
    return core.previewOf(number, binding.variables ? binding : master.behavior, modes, replay.varStore(), core.resolveProps(number, number.sampleProps), 'default').vars;
}

test('the master holds the column fixed in both axes, placed against the inside of its right border at the full height inside it', () => {
    const w = world();
    const master = w.page.nodes.find(n => n.component && n.behavior?.templateId === 'inputnumber');
    const column = w.doc.descendants(master.id).find(n => n.behavior?.group === 'stepper');
    assert.deepEqual([column.layoutSizingH, column.layoutSizingV, column.layoutPositioning], ['fixed', 'fixed', 'absolute']);
    const at = core.pinnedFrame(number, slot, master, varsOf(w, master, 'md'));
    assert.deepEqual([column.x, column.y, column.w, column.h], [at.x, at.y, at.w, at.h]);
    assert.ok(column.w > 0 && column.h > 0, 'a column with a size');
    assert.equal(column.x + column.w, master.w - 1, 'it ends on the inside of the right border');
    assert.equal(column.y + column.h, master.h - 1);
});

test('the demo instance and an instance at every Size hold the column where pinnedFrame puts it for that Size', () => {
    const w = world();
    const master = w.page.nodes.find(n => n.component && n.behavior?.templateId === 'inputnumber');
    const demo = w.page.nodes.find(n => n.isInstance && n.sourceId === master.id);
    const check = (inst, size) => {
        const column = w.doc.descendants(inst.id).find(n => n.behavior?.slot === 'stepper');
        const at = core.pinnedFrame(number, slot, inst, varsOf(w, inst, size));
        assert.deepEqual([column.x, column.y, column.w, column.h], [at.x, at.y, at.w, at.h], `${size}`);
        assert.equal(column.x + column.w, inst.w - 1, `${size}: against the inside of the right border`);
        assert.ok(column.x > 0 && column.w > 0 && column.h > 0, `${size}: not at the top left, not empty`);
        assert.deepEqual([column.layoutSizingH, column.layoutSizingV], ['fixed', 'fixed']);
    };
    check(demo, 'md');
    for (const size of SIZES) {
        const sizeColl = master.behavior.variables.size;
        const mode = w.doc.data.variables.collections.find(c => c.id === sizeColl).modes.find(m => m.name === size);
        const copies = core.instanceOf(number, master, w.doc.descendants(master.id), { ...number.sampleProps }, { id: () => w.replay.stubs.uid(), varModes: { [sizeColl]: mode.id } });
        copies[0].parentId = w.page.id;
        for (const n of copies) w.doc.add(n);
        w.doc.refresh();
        assert.equal(w.replay.syncInstance(copies[0]), null);
        check(copies[0], size);
    }
});

test('a text area grip is placed the same way: the inset from the right and the bottom, from its own size token', () => {
    const w = world();
    const input = core.TEMPLATES.get('input');
    const master = w.page.nodes.find(n => n.component && n.behavior?.templateId === 'input');
    const copies = core.instanceOf(input, master, w.doc.descendants(master.id), { placeholder: 'x', kind: 'textarea', resize: 'vertical' }, { id: () => w.replay.stubs.uid(), varModes: {} });
    copies[0].parentId = w.page.id;
    for (const n of copies) w.doc.add(n);
    w.doc.refresh();
    assert.equal(w.replay.syncInstance(copies[0]), null);
    const grip = w.doc.descendants(copies[0].id).find(n => n.behavior?.slot === 'resizeHandle');
    assert.ok(grip, 'the grip layer exists');
    assert.deepEqual([copies[0].w - (grip.x + grip.w), copies[0].h - (grip.y + grip.h)], [2, 2], '2px from the right and the bottom');
    assert.ok(grip.w > 0);
});
