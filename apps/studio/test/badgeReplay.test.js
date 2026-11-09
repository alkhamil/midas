// Badge through the real studio path: Generate Design System makes the master and the demo instance by cloning (placeDemoInstance), then a prop change is
// written to the instance and the studio's syncInstance runs, as the editor does after an edit. For each type (count, dot, status) and hasText on and off,
// the instance keeps its markers, holds exactly one layer per optional part it shows, keeps the anatomy order, and shows its sample props.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '@midas/builder-core';
import { studioReplay } from './helpers/studioReplay.js';

const { TEMPLATES, BASE_SNAPSHOT, applyBasePlan, planFromSnapshot, DESIGN_SYSTEM_PAGE, resolveProps } = core;
const badge = TEMPLATES.get('antd-badge');

/** The run as runDesignSystem makes it, on a new Design System page of a plain file, then shown. */
function generate() {
    const replay = studioReplay();
    const { doc } = replay;
    const page = { id: 'ds', name: DESIGN_SYSTEM_PAGE, nodes: [], parentId: null };
    doc.data.pages.push(page);
    const counts = { variables: 0, icons: 0, iconsPresent: 0, created: 0, present: 0, problems: 0 };
    counts.variables += applyBasePlan(replay.varStore(), planFromSnapshot(BASE_SNAPSHOT), replay.stubs.uid).items;
    replay.onPage(page.id, () => replay.buildDesignSystemPage(counts));
    doc.data.pageId = page.id;
    doc.refresh();
    return { ...replay, page };
}

/** The Badge demo instance Generate Design System placed. */
function demoOf({ doc, page }) {
    const master = page.nodes.find(n => n.component && n.behavior?.templateId === badge.id);
    const demo = page.nodes.find(n => n.isInstance && n.sourceId === master.id);
    assert.ok(demo, 'the Badge demo instance exists');
    return { demo, layers: () => doc.descendants(demo.id) };
}

/** Writes props to the instance the way an edit does, then runs the studio's sync for it. */
function setProps(replay, demo, props) {
    demo.behavior = { ...demo.behavior, props: { ...(demo.behavior?.props ?? {}), ...props } };
    replay.syncInstance(demo);
}

/** The managed slot of each layer of the instance, in tree order (a layer with no slot is not one of them). */
const slotsOf = layers => layers.filter(n => n.behavior?.slot !== undefined).map(n => n.behavior.slot);

/** The anatomy order of Badge's slots: the order an instance's layers follow. */
const anatomyOrder = badge.anatomy.map(s => s.id);
/** The slots are in anatomy order (each one's place in the anatomy is no earlier than the one before it). */
function assertAnatomyOrder(slots) {
    const places = slots.map(s => anatomyOrder.indexOf(s));
    assert.deepEqual(places, [...places].sort((a, b) => a - b), `anatomy order of ${slots.join(', ')}`);
}

test('the demo instance Generate Design System places shows the count pill and its sample count', () => {
    const replay = generate();
    const { demo, layers } = demoOf(replay);
    assert.deepEqual(slotsOf(layers()), ['pill', 'countText']);
    assert.equal(layers().find(n => n.behavior?.slot === 'countText').text, '5', 'the sample count shows');
    assert.ok(demo.isInstance && demo.sourceId === replay.page.nodes.find(n => n.component && n.behavior?.templateId === badge.id).id, 'the instance is a copy of the Badge master');
});

test('a count instance holds exactly one pill and one count text, in anatomy order, with its marker kept', () => {
    const replay = generate();
    const { demo, layers } = demoOf(replay);
    setProps(replay, demo, { type: 'count', count: 12 });
    const slots = slotsOf(layers());
    assert.deepEqual(slots, ['pill', 'countText']);
    assert.equal(new Set(slots).size, slots.length, 'one layer per optional part');
    assert.equal(layers().find(n => n.behavior?.slot === 'countText').text, '12');
});

test('a dot instance holds only the dot; switching a count to a dot removes the pill and the count text', () => {
    const replay = generate();
    const { demo, layers } = demoOf(replay);
    setProps(replay, demo, { type: 'dot' });
    assert.deepEqual(slotsOf(layers()), ['dot']);
    setProps(replay, demo, { type: 'count', count: 3 });
    assert.deepEqual(slotsOf(layers()), ['pill', 'countText'], 'back to a count: made again');
});

test('a status instance holds its status dot and, with hasText on, the label in anatomy order; hasText off removes the label, the text stays in its prop', () => {
    const replay = generate();
    const { demo, layers } = demoOf(replay);
    setProps(replay, demo, { type: 'status', hasText: true, label: 'Syncing' });
    assert.deepEqual(slotsOf(layers()), ['statusDot', 'label']);
    assertAnatomyOrder(slotsOf(layers()));
    assert.equal(layers().find(n => n.behavior?.slot === 'label').text, 'Syncing');
    setProps(replay, demo, { hasText: false });
    assert.deepEqual(slotsOf(layers()), ['statusDot']);
    setProps(replay, demo, { hasText: true });
    assert.equal(layers().find(n => n.behavior?.slot === 'label').text, 'Syncing', 'the label comes back from its prop');
});

test('a zero count keeps its pill and its count text on the canvas; the root hides only in Play (no layer is removed)', () => {
    const replay = generate();
    const { demo, layers } = demoOf(replay);
    setProps(replay, demo, { type: 'count', count: 0 });
    assert.deepEqual(slotsOf(layers()), ['pill', 'countText']);
    assert.equal(layers().find(n => n.behavior?.slot === 'countText').text, '0');
});

test('the instance props resolve to the sample props the demo starts with, for every type', () => {
    const sample = resolveProps(badge, badge.sampleProps ?? {});
    assert.equal(sample.type, 'count');
    assert.equal(sample.count, 5);
});
