// The spinner is an add/remove layer, replayed through the REAL editor sync: turning loading
// on creates it bound and placed, turning it off removes it again. No hidden layer ever lives
// on a master or an instance. (midas.js is not importable: the replay cuts its real functions.)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '@midas/builder-core';
import { studioReplay } from './helpers/studioReplay.js';

const { TEMPLATES, BASE_SNAPSHOT, planFromSnapshot, applyBasePlan, DESIGN_SYSTEM_PAGE } = core;

function generate() {
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

const CASES = [
    ['button', null, 'label'],
    ['icon-button', null, null],
    ['switch', 'handle', null],
];

for (const [id, holder, before] of CASES) {
    test(`${id}: loading on creates the spinner, loading off removes it, never hidden`, () => {
        const { replay, page } = generate();
        const { doc } = replay;
        const template = TEMPLATES.get(id);
        const master = page.nodes.find(n => n.component && n.behavior?.templateId === id);
        assert.ok(master, `${id} master exists`);
        assert.equal(doc.descendants(master.id).find(n => n.behavior?.part === 'spinner'), undefined, 'master holds no spinner while loading is off');
        const frame = { id: `top-${id}`, name: 'Top', type: 'frame', parentId: null, layout: 'vertical', x: 0, y: 0, w: 400, h: 400, fills: [], layoutSizingH: 'hug', layoutSizingV: 'hug' };
        doc.add(frame);
        const copies = core.instanceOf(template, master, doc.descendants(master.id), {}, { id: () => replay.stubs.uid(), varModes: {}, variables: doc.data.variables });
        copies[0].parentId = frame.id;
        for (const n of copies) doc.add(n);
        doc.refresh();
        const spinOf = root => doc.descendants(root.id).find(n => n.behavior?.part === 'spinner');
        assert.equal(spinOf(copies[0]), undefined, 'instance holds no spinner while loading is off');
        // Turning loading on makes the layer, bound and placed.
        copies[0].behavior.props = { ...copies[0].behavior.props, loading: true };
        replay.syncInstance(copies[0]);
        const spin = spinOf(copies[0]);
        assert.ok(spin, 'the spinner is created');
        assert.ok(spin.visible !== false, 'the spinner is shown, not hidden');
        const ids = new Set(doc.data.variables.items.map(i => i.id));
        for (const key of Object.values(spin.vars ?? {})) assert.ok(ids.has(key), `spinner binding ${key} is a variable`);
        const size = template.parts.find(p => p.id === 'spinner').arc.size;
        assert.deepEqual([spin.w, spin.h], [size, size], 'spinner size comes from the Size token');
        if (holder === null) assert.equal(spin.parentId, copies[0].id, 'the spinner hangs directly under the root');
        else assert.equal(spin.parentId, doc.descendants(copies[0].id).find(n => n.behavior?.group === holder)?.id, `the spinner hangs under the ${holder}`);
        if (before !== null) {
            const order = doc.children(copies[0].id).map(n => n.behavior?.part ?? n.name);
            assert.ok(order.indexOf('spinner') < order.indexOf(before), `the spinner sits before the ${before}`);
        }
        assert.equal(core.behaviorProblem(doc.data, {}), null, 'the backstop converges');
        // Turning loading off removes the layer again; nothing hidden stays behind.
        copies[0].behavior.props = { ...copies[0].behavior.props, loading: false };
        replay.syncInstance(copies[0]);
        assert.equal(spinOf(copies[0]), undefined, 'the spinner is removed');
        assert.ok(doc.descendants(copies[0].id).every(n => n.visible !== false), 'no hidden layer on the instance');
        assert.equal(core.behaviorProblem(doc.data, {}), null, 'the backstop still converges');
        assert.deepEqual(replay.toasts.filter(t => /not applied/i.test(t)), [], 'no rollback toast');
    });
}
