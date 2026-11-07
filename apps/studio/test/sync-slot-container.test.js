// A text inside a slot-marked box converges: a second sync over the synced tree changes nothing,
// so the backstop never sees a duplicate and the edit is never rolled back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as core from '@midas/builder-core';
import { studioReplay } from './helpers/studioReplay.js';

const { BASE_SNAPSHOT, planFromSnapshot, applyBasePlan, DESIGN_SYSTEM_PAGE } = core;

test('a second sync over a slot-marked box changes nothing', () => {
    const replay = studioReplay();
    const { doc } = replay;
    const page = { id: 'ds', name: DESIGN_SYSTEM_PAGE, nodes: [], parentId: null };
    doc.data.pages.push(page);
    doc.data.pageId = page.id;
    applyBasePlan(replay.varStore(), planFromSnapshot(BASE_SNAPSHOT), replay.stubs.uid);
    const counts = { variables: 0, icons: 0, iconsPresent: 0, created: 0, present: 0, problems: 0 };
    replay.onPage(page.id, () => replay.buildDesignSystemPage(counts));
    doc.refresh();
    const master = page.nodes.find(n => n.component && n.behavior?.templateId === 'switch');
    const copies = core.instanceOf(core.TEMPLATES.get('switch'), master, doc.descendants(master.id), {}, { id: () => replay.stubs.uid(), varModes: {} });
    copies[0].parentId = page.id;
    for (const n of copies) doc.add(n);
    doc.refresh();
    const inst = () => doc.get(copies[0].id);
    const edit = (prop, value) => {
        inst().behavior = core.setInstanceValue(inst(), master, prop, value);
        doc.touch(inst());
        assert.equal(replay.syncInstance(inst()), null);
        assert.equal(replay.syncInstance(inst()), null, 'a second sync changes nothing');
        const texts = doc.descendants(inst().id).filter(n => n.behavior?.slot === 'checkedChildren');
        assert.equal(texts.length, prop === 'checkedChildren' ? 1 : 0, 'exactly one text layer');
        return core.behaviorProblem(doc.data, {});
    };
    assert.equal(edit('checked', true), null);
    assert.equal(edit('checkedChildren', 'kai'), null);
});
