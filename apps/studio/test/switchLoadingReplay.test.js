// Switch loading on the canvas (replay): a loading instance draws the spinner part
// inside its handle copy and dims the root to the loading opacity. Replays the real
// midas.js sync path over a fake document (midas.js is not importable).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '@midas/builder-core';
import { LOADING_OPACITY } from '@midas/builder-core';
import { studioReplay } from './helpers/studioReplay.js';

const { TEMPLATES, BASE_SNAPSHOT, planFromSnapshot, applyBasePlan, DESIGN_SYSTEM_PAGE } = core;
const sw = TEMPLATES.get('switch');

test('a loading instance draws the spinner and dims on the canvas', () => {
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
    assert.ok(master, 'switch master exists');
    assert.equal(doc.descendants(master.id).find(n => n.behavior?.part === 'spinner'), undefined, 'master holds no spinner while loading is off');
    const copies = core.instanceOf(sw, master, doc.descendants(master.id), { loading: true }, { id: () => replay.stubs.uid(), varModes: {}, variables: doc.data.variables });
    assert.equal(copies.find(n => n.behavior?.part === 'spinner')?.parentId, copies.find(n => n.behavior?.group === 'handle')?.id, 'the instance spinner hangs under the handle copy');
    copies[0].parentId = page.id;
    for (const n of copies) doc.add(n);
    doc.refresh();
    replay.syncInstance(copies[0]);
    const spinner = doc.descendants(copies[0].id).find(n => n.behavior?.part === 'spinner');
    assert.ok(spinner && spinner.visible !== false, 'spinner layer visible while loading');
    assert.ok(spinner.vars?.stroke && spinner.vars?.w && spinner.vars?.h, 'spinner carries its colour and size bindings');
    assert.equal(doc.descendants(page.id).find(n => n.id === copies[0].id).opacity, LOADING_OPACITY, 'root dimmed to the loading opacity');
});
