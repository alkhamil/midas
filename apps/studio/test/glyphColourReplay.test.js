// Round 3 glyph colour: a checked/indeterminate instance's glyph layer (inside the
// box container) carries a Color-collection variable binding for every fill, and
// the disabled state takes the disabled glyph colour. Replays the real midas.js
// sync path over a fake document (midas.js is not importable).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '@midas/builder-core';
import { studioReplay } from './helpers/studioReplay.js';

const { TEMPLATES, BASE_SNAPSHOT, planFromSnapshot, applyBasePlan, DESIGN_SYSTEM_PAGE } = core;

function setup() {
    const replay = studioReplay();
    const { doc } = replay;
    const page = { id: 'ds', name: DESIGN_SYSTEM_PAGE, nodes: [], parentId: null };
    doc.data.pages.push(page);
    doc.data.pageId = page.id;
    applyBasePlan(replay.varStore(), planFromSnapshot(BASE_SNAPSHOT), replay.stubs.uid);
    const counts = { variables: 0, icons: 0, iconsPresent: 0, created: 0, present: 0, problems: 0 };
    replay.onPage(page.id, () => replay.buildDesignSystemPage(counts));
    doc.refresh();
    return { replay, page };
}

const masterOf = (page, id) => page.nodes.find(n => n.component && n.behavior?.templateId === id);

function checkedInstance(replay, page, id, props) {
    const template = TEMPLATES.get(id);
    const master = masterOf(page, id);
    assert.ok(master, `${id} has a master`);
    const copies = core.instanceOf(template, master, replay.doc.descendants(master.id), props, { id: () => replay.stubs.uid(), varModes: {} });
    const row = page.nodes.find(n => n.type === 'frame' && !n.component);
    copies[0].parentId = (row ?? page).id;
    for (const n of copies) replay.doc.add(n);
    replay.doc.refresh();
    replay.syncInstance(copies[0]);
    return { template, master, root: copies[0], nodes: replay.doc.descendants(copies[0].id) };
}

test('managed layers include the glyph inside the box container', () => {
    const { replay, page } = setup();
    const { template, root } = checkedInstance(replay, page, 'checkbox', { checked: true });
    const slots = replay.managedTextLayersOf(root, template).map(n => n.behavior.slot);
    assert.ok(slots.includes('check'), 'check glyph is a managed layer');
});

test('every fill on a generated glyph node carries a Color-collection binding', () => {
    const { replay, page } = setup();
    for (const [id, slot, props] of [['checkbox', 'check', { checked: true }], ['checkbox', 'indeterminate', { indeterminate: true }], ['radio', 'dot', { checked: true }]]) {
        const { template, root, nodes } = checkedInstance(replay, page, id, props);
        const glyph = nodes.find(n => n.behavior?.slot === slot);
        assert.ok(glyph, `${id}.${slot} exists`);
        assert.ok(glyph.fills?.length > 0 || glyph.vars?.['fills.0'], `${id}.${slot} has a fill`);
        glyph.fills?.forEach((_, i) => assert.ok(glyph.vars?.[`fills.${i}`], `${id}.${slot} fill ${i} is bound`));
        if (template.display[slot]?.stroke) assert.ok(glyph.vars?.stroke, `${id}.${slot} stroke is bound`);
        const item = replay.doc.data.variables.items.find(i => i.id === glyph.vars?.['fills.0']);
        assert.ok(item, `${id}.${slot} binds a variable`);
        const coll = replay.doc.data.variables.collections.find(c => c.id === item.collectionId);
        assert.equal(coll.name, `${template.name} Color`, `${id}.${slot} binds the Color collection`);
    }
});

test('a disabled glyph takes the disabled glyph colour', () => {
    const { replay, page } = setup();
    const { nodes } = checkedInstance(replay, page, 'checkbox', { checked: true, disabled: true });
    const glyph = nodes.find(n => n.behavior?.slot === 'check');
    const item = replay.doc.data.variables.items.find(i => i.id === glyph.vars?.['fills.0']);
    assert.equal(item?.name, 'glyph-fg-disabled');
});
