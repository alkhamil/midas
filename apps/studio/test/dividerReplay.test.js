// Divider through the real studio path: Generate Design System makes the master and the demo instance, then a prop change is written to the instance and the
// studio's syncInstance runs, as the editor does after an edit. The text and the rules come and go with their props (one layer per rule, in anatomy order, none
// hidden), and the Style mode writes its dash on every line layer, the ones the sync makes later included.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '@midas/builder-core';
import { studioReplay } from './helpers/studioReplay.js';

const { TEMPLATES, BASE_SNAPSHOT, applyBasePlan, planFromSnapshot, DESIGN_SYSTEM_PAGE, strokeDashArray } = core;
const divider = TEMPLATES.get('antd-divider');

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

/** The Divider demo instance Generate Design System placed, and its master. */
function demoOf({ doc, page }) {
    const master = page.nodes.find(n => n.component && n.behavior?.templateId === divider.id);
    const demo = page.nodes.find(n => n.isInstance && n.sourceId === master.id);
    assert.ok(demo, 'the Divider demo instance exists');
    return { demo, master, layers: () => doc.descendants(demo.id) };
}

/** Writes props to the instance the way an edit does, then runs the studio's sync for it. */
function setProps(replay, demo, props) {
    demo.behavior = { ...demo.behavior, props: { ...(demo.behavior?.props ?? {}), ...props } };
    replay.syncInstance(demo);
}
const slotsOf = layers => layers.filter(n => n.behavior?.slot !== undefined).map(n => n.behavior.slot);
const anatomyOrder = divider.anatomy.map(s => s.id);
function assertAnatomyOrder(slots) {
    const places = slots.map(s => anatomyOrder.indexOf(s));
    assert.deepEqual(places, [...places].sort((a, b) => a - b), `anatomy order of ${slots.join(', ')}`);
}
/** Selects a mode of the instance's Style collection by its name, then runs what a mode change runs. */
function setStyle(replay, demo, master, name) {
    const collection = replay.varStore().collections.find(c => c.id === master.behavior.variables.lineStyle);
    demo.varModes = { ...(demo.varModes ?? {}), [collection.id]: collection.modes.find(m => m.name === name).id };
    replay.applyVariantStroke(demo);
}

test('the demo instance is a single horizontal line, bound to its tokens, with no hidden layer', () => {
    const replay = generate();
    const { demo, layers } = demoOf(replay);
    assert.deepEqual(slotsOf(layers()), ['lineBefore']);
    const line = layers()[0];
    assert.equal(line.type, 'line');
    assert.ok(line.vars?.stroke && line.vars?.strokeWidth, 'the stroke colour and width are bound to tokens');
    assert.ok(layers().every(n => n.visible !== false));
    assert.equal(demo.w, 343, 'a Divider is made 343 wide');
});

test('Text on adds the text and the second line in anatomy order; off removes both; the text stays in its prop', () => {
    const replay = generate();
    const { demo, layers } = demoOf(replay);
    setProps(replay, demo, { hasText: true, label: 'Heading' });
    assert.deepEqual(slotsOf(layers()), ['lineBefore', 'label', 'lineAfter']);
    assertAnatomyOrder(slotsOf(layers()));
    assert.equal(layers().find(n => n.behavior.slot === 'label').text, 'Heading');
    setProps(replay, demo, { hasText: false });
    assert.deepEqual(slotsOf(layers()), ['lineBefore']);
    setProps(replay, demo, { hasText: true });
    assert.equal(layers().find(n => n.behavior.slot === 'label').text, 'Heading', 'the text came back with the toggle');
});

test('placement swaps which side is the short one: layers change, none is left over', () => {
    const replay = generate();
    const { demo, layers } = demoOf(replay);
    setProps(replay, demo, { hasText: true, placement: 'start' });
    assert.deepEqual(slotsOf(layers()), ['lineBeforeShort', 'label', 'lineAfter']);
    setProps(replay, demo, { placement: 'end' });
    assert.deepEqual(slotsOf(layers()), ['lineBefore', 'label', 'lineAfterShort']);
    setProps(replay, demo, { placement: 'center' });
    assert.deepEqual(slotsOf(layers()), ['lineBefore', 'label', 'lineAfter']);
    for (const slot of ['lineBeforeShort', 'lineAfterShort']) assert.equal(layers().filter(n => n.behavior?.slot === slot).length, 0);
});

test('vertical removes the text and its lines and leaves one vertical line; horizontal brings the line back', () => {
    const replay = generate();
    const { demo, layers } = demoOf(replay);
    setProps(replay, demo, { hasText: true, placement: 'start' });
    setProps(replay, demo, { orientation: 'vertical' });
    assert.deepEqual(slotsOf(layers()), ['lineVertical']);
    assert.ok(layers().every(n => n.type === 'line'), 'nothing but the line is left');
    setProps(replay, demo, { orientation: 'horizontal' });
    assert.deepEqual(slotsOf(layers()), ['lineBeforeShort', 'label', 'lineAfter'], 'the text props were kept in the instance and apply again');
});

test('the Style mode writes its dash on every line, and a line the sync makes later draws it from the start', () => {
    const replay = generate();
    const { demo, master, layers } = demoOf(replay);
    const dashes = () => layers().filter(n => n.type === 'line').map(n => strokeDashArray(n));
    setProps(replay, demo, { hasText: true });
    setStyle(replay, demo, master, 'dashed');
    assert.deepEqual(dashes(), [[4, 4], [4, 4]]);
    setStyle(replay, demo, master, 'dotted');
    assert.deepEqual(dashes(), [[0, 3], [0, 3]]);
    setProps(replay, demo, { hasText: false });
    assert.deepEqual(dashes(), [[0, 3]]);
    setProps(replay, demo, { hasText: true, placement: 'start' });
    assert.deepEqual(dashes(), [[0, 3], [0, 3]], 'the new short line is dotted too');
    setStyle(replay, demo, master, 'solid');
    assert.deepEqual(dashes(), [[], []]);
    assert.equal(demo.strokeStyle, undefined, 'the root draws no stroke: the Style never reaches it');
});

test('plain swaps the text to the plain typography on the layer through the sync, and back', () => {
    const replay = generate();
    const { demo, layers } = demoOf(replay);
    const items = replay.varStore().items;
    const typographyOf = () => items.find(i => i.id === layers().find(n => n.behavior?.slot === 'label').vars.typography).name;
    setProps(replay, demo, { hasText: true });
    assert.equal(typographyOf(), 'labelTypography');
    setProps(replay, demo, { plain: true });
    assert.equal(typographyOf(), 'plainTypography');
    setProps(replay, demo, { plain: false });
    assert.equal(typographyOf(), 'labelTypography');
});
