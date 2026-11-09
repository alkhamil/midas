// Tag through the real studio path: Generate Design System makes the master and the demo instance by cloning (placeDemoInstance), then a prop change is
// written to the instance and the studio's syncInstance runs, as the editor does after an edit. For the leading icon (hasIcon) and the close (closable),
// each on and off and both together, the instance keeps its markers, holds exactly one layer per optional part it shows, keeps the anatomy order, and
// shows its sample label.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '@midas/builder-core';
import { studioReplay } from './helpers/studioReplay.js';

const { TEMPLATES, BASE_SNAPSHOT, applyBasePlan, planFromSnapshot, DESIGN_SYSTEM_PAGE, resolveProps } = core;
const tag = TEMPLATES.get('antd-tag');

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

/** The Tag demo instance Generate Design System placed, and its master. */
function demoOf({ doc, page }) {
    const master = page.nodes.find(n => n.component && n.behavior?.templateId === tag.id);
    const demo = page.nodes.find(n => n.isInstance && n.sourceId === master.id);
    assert.ok(demo, 'the Tag demo instance exists');
    return { demo, master, layers: () => doc.descendants(demo.id) };
}

/** Writes props to the instance the way an edit does, then runs the studio's sync for it. */
function setProps(replay, demo, props) {
    demo.behavior = { ...demo.behavior, props: { ...(demo.behavior?.props ?? {}), ...props } };
    replay.syncInstance(demo);
}

/** The managed slot of each layer of the instance, in tree order. */
const slotsOf = layers => layers.filter(n => n.behavior?.slot !== undefined).map(n => n.behavior.slot);

/** The anatomy order of Tag's slots: the order an instance's layers follow. */
const anatomyOrder = tag.anatomy.map(s => s.id);
function assertAnatomyOrder(slots) {
    const places = slots.map(s => anatomyOrder.indexOf(s));
    assert.deepEqual(places, [...places].sort((a, b) => a - b), `anatomy order of ${slots.join(', ')}`);
}

test('the demo instance shows its sample label and no icon and no close', () => {
    const replay = generate();
    const { demo, master, layers } = demoOf(replay);
    assert.ok(demo.isInstance && demo.sourceId === master.id, 'the instance is a copy of the Tag master');
    assert.deepEqual(slotsOf(layers()), ['label']);
    assert.equal(layers().find(n => n.behavior?.slot === 'label').text, 'Tag', 'the sample label shows');
});

test('hasIcon on adds one icon layer before the label; off removes it', () => {
    const replay = generate();
    const { demo, layers } = demoOf(replay);
    setProps(replay, demo, { hasIcon: true });
    assert.deepEqual(slotsOf(layers()), ['icon', 'label']);
    assert.equal(slotsOf(layers()).filter(s => s === 'icon').length, 1, 'exactly one icon layer');
    assertAnatomyOrder(slotsOf(layers()));
    setProps(replay, demo, { hasIcon: false });
    assert.deepEqual(slotsOf(layers()), ['label']);
});

test('closable on adds the closer and its close icon after the label; off removes both', () => {
    const replay = generate();
    const { demo, layers } = demoOf(replay);
    setProps(replay, demo, { closable: true });
    assert.deepEqual(slotsOf(layers()), ['label', 'closer', 'close']);
    assert.equal(slotsOf(layers()).filter(s => s === 'closer').length, 1, 'exactly one closer layer');
    assertAnatomyOrder(slotsOf(layers()));
    setProps(replay, demo, { closable: false });
    assert.deepEqual(slotsOf(layers()), ['label']);
});

test('both on give icon, label, closer and close in anatomy order; each toggles back off cleanly', () => {
    const replay = generate();
    const { demo, layers } = demoOf(replay);
    setProps(replay, demo, { hasIcon: true, closable: true });
    assert.deepEqual(slotsOf(layers()), ['icon', 'label', 'closer', 'close']);
    assertAnatomyOrder(slotsOf(layers()));
    setProps(replay, demo, { hasIcon: false });
    assert.deepEqual(slotsOf(layers()), ['label', 'closer', 'close']);
    setProps(replay, demo, { hasIcon: true });
    assert.deepEqual(slotsOf(layers()), ['icon', 'label', 'closer', 'close'], 'the icon comes back in its place');
});

test('the label text stays in its prop across toggles; the instance props resolve to the sample props', () => {
    const replay = generate();
    const { demo, layers } = demoOf(replay);
    setProps(replay, demo, { label: 'Beta', closable: true });
    assert.equal(layers().find(n => n.behavior?.slot === 'label').text, 'Beta');
    setProps(replay, demo, { closable: false });
    setProps(replay, demo, { closable: true });
    assert.equal(layers().find(n => n.behavior?.slot === 'label').text, 'Beta', 'the label survives the toggles');
    const sample = resolveProps(tag, tag.sampleProps ?? {});
    assert.equal(sample.label, 'Tag');
    assert.equal(sample.closable, false);
});

test('turning closable on gives the close slot the file\'s close glyph (role close), not the default circle', () => {
    const replay = generate();
    const { demo, layers } = demoOf(replay);
    const closeGlyph = replay.doc.nodes.find(n => n.component === true && n.name === 'Icon/close');
    assert.ok(closeGlyph, 'the Design System made the close glyph');
    replay.setInstanceValueTo(demo, 'closable', true);
    assert.equal(demo.behavior.props.closeIcon, closeGlyph.id, 'the close slot holds the close glyph');
    assert.ok(layers().some(n => n.behavior?.slot === 'close'), 'and the close layer is there');
});

test('a picker swap of the close icon keeps the close layer and its icon size bound (one close layer, the new glyph)', () => {
    const replay = generate();
    const { demo, layers } = demoOf(replay);
    setProps(replay, demo, { closable: true });
    const before = layers().find(n => n.behavior?.slot === 'close');
    const other = replay.doc.nodes.find(n => n.component === true && n.name === 'Icon/circle');
    setProps(replay, demo, { closeIcon: other.id });
    const after = layers().filter(n => n.behavior?.slot === 'close');
    assert.equal(after.length, 1, 'exactly one close layer after the swap');
    assert.deepEqual(after[0].vars, before.vars, 'its colour and size bindings are kept');
});
