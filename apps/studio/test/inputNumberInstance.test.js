// Creating an InputNumber (or Input) instance from its master, as the editor's instantiate does: a clone of the master subtree whose binding stays on the master, then
// markManagedContainers, the sample props and syncInstance. Root cause of the old bugs: the clone dropped the marker of the master's managed container (the stepper), so the sync
// found an unmarked frame, made a second stepper, and put the new layers into it in reverse. instantiate itself needs a browser (cloneNodes, the selection), so its source is
// read and its clone replayed here with the real syncInstance.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as core from '@midas/builder-core';
import { studioReplay } from './helpers/studioReplay.js';

const midas = fs.readFileSync(new URL('../src/engine/midas.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const body = name => midas.slice(midas.indexOf(`function ${name}(`), midas.indexOf('\n}\n', midas.indexOf(`function ${name}(`)));

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
/** What instantiate does to a clone of the master: the sample props, the managed containers marked, the sync. */
function instantiate({ replay, doc, page }, id, props = {}) {
    const master = page.nodes.find(n => n.component && n.behavior?.templateId === id);
    const template = core.TEMPLATES.get(id);
    const all = [master, ...doc.descendants(master.id)].map(n => structuredClone(n));
    const ids = new Map(all.map(n => [n.id, replay.stubs.uid()]));
    const out = all.map(n => {
        const src = n.id;
        Object.assign(n, { id: ids.get(src), parentId: src === master.id ? page.id : ids.get(n.parentId), sourceId: src, component: false, isInstance: src === master.id || !!n.isInstance, overrides: {} });
        core.withInstanceBehavior(n, { behavior: n.behavior });
        return n;
    });
    out[0].behavior = { ...out[0].behavior, props: { ...template.sampleProps, ...props } };
    core.markManagedContainers(template, out);
    for (const n of out) doc.add(n);
    doc.refresh();
    assert.equal(replay.syncInstance(out[0]), null);
    return out[0];
}
const treeOf = (doc, root) => { const draw = n => (doc.children(n.id).length ? `${n.name}{${doc.children(n.id).map(draw).join(',')}}` : n.name); return doc.children(root.id).map(draw); };

test('an InputNumber instance from its master has one stepper, a placeholder, the stepper last, and the chevrons up then down', () => {
    const w = world();
    const inst = instantiate(w, 'inputnumber');
    assert.deepEqual(treeOf(w.doc, inst), ['placeholder', 'stepper{stepUpBox{stepUp},stepDownBox{stepDown}}']);
    assert.equal(w.doc.descendants(inst.id).filter(n => n.behavior?.slot === 'stepper').length, 1);
    assert.equal(w.doc.children(inst.id).at(-1).name, 'stepper', 'the stepper is the last child, at the right edge');
});

test('a second sync changes nothing, and toggling controls off removes the stepper and on makes exactly one', () => {
    const w = world();
    const inst = instantiate(w, 'inputnumber');
    const master = w.page.nodes.find(n => n.component && n.behavior?.templateId === 'inputnumber');
    const edit = (prop, value) => {
        inst.behavior = core.setInstanceValue(inst, master, prop, value);
        w.doc.touch(inst);
        assert.equal(w.replay.syncInstance(inst), null);
        assert.equal(w.replay.syncInstance(inst), null, 'a second sync changes nothing');
        return treeOf(w.doc, inst);
    };
    assert.deepEqual(edit('controls', false), ['placeholder']);
    assert.deepEqual(edit('controls', true), ['placeholder', 'stepper{stepUpBox{stepUp},stepDownBox{stepDown}}']);
    assert.deepEqual(edit('controlsPosition', 'none'), ['placeholder']);
    assert.deepEqual(edit('controlsPosition', 'right'), ['placeholder', 'stepper{stepUpBox{stepUp},stepDownBox{stepDown}}']);
    assert.equal(core.behaviorProblem(w.doc.data, {}), null);
});

test('an Input instance gets its placeholder from the sample props like the demo instance, and a suffix lands before the stepper of an InputNumber', () => {
    const w = world();
    assert.deepEqual(treeOf(w.doc, instantiate(w, 'input')), ['placeholder']);
    const withSuffix = instantiate(w, 'inputnumber', { hasSuffix: true, suffixText: 'kg' });
    assert.deepEqual(treeOf(w.doc, withSuffix), ['placeholder', 'suffixText', 'stepper{stepUpBox{stepUp},stepDownBox{stepDown}}']);
});

test('instantiate marks the managed containers of the clone and starts the instance with the sample props', () => {
    const fn = body('instantiate');
    assert.ok(fn.includes('markManagedContainers('), 'the clone\'s managed containers are marked before the sync');
    assert.ok(fn.indexOf('markManagedContainers(') < fn.indexOf('syncInstance(root)'));
    assert.ok(fn.includes('...tpl.sampleProps'), 'the sample props start the instance');
});
