// A Radio Group's options slot takes the instances its own settings list (Only allow preferred instances, with Radio), seeded when the Design System is
// built. A List Item is refused by the same rule the picker uses, even though List names its slot `items` too.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '@midas/builder-core';
import { studioReplay } from './helpers/studioReplay.js';

const { BASE_SNAPSHOT, applyBasePlan, planFromSnapshot, DESIGN_SYSTEM_PAGE, slotAccepts } = core;

test('a Radio Group\'s options take the Radio its settings list, and refuse a List Item', () => {
    const replay = studioReplay();
    const { doc } = replay;
    const page = { id: 'ds', name: DESIGN_SYSTEM_PAGE, nodes: [], parentId: null };
    doc.data.pages.push(page);
    const counts = { variables: 0, icons: 0, iconsPresent: 0, created: 0, present: 0, problems: 0 };
    applyBasePlan(replay.varStore(), planFromSnapshot(BASE_SNAPSHOT), replay.stubs.uid);
    replay.onPage(page.id, () => replay.buildDesignSystemPage(counts));
    doc.data.pageId = page.id;
    doc.refresh();
    const groupMaster = page.nodes.find(n => n.component && n.behavior?.templateId === 'antd-radio-group');
    const radioMaster = page.nodes.find(n => n.component && n.behavior?.templateId === 'radio');
    const listMaster = page.nodes.find(n => n.component && n.behavior?.templateId === 'antd-list-item');
    const prop = groupMaster.cprops.find(p => p.id === 'items');
    assert.equal(prop.onlyPreferred, true);
    assert.ok(prop.preferred.includes(radioMaster.id), 'Radio is preferred');
    assert.equal(slotAccepts(prop, { ids: [radioMaster.id], templates: ['radio'] }), true);
    assert.equal(slotAccepts(prop, { ids: [listMaster.id], templates: ['antd-list-item'] }), false);
});
