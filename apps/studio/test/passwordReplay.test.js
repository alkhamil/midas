// Password (Input's password kind) through the real studio path: Generate Design System makes the Input master and its demo, then the kind is set
// through the editor's edit path (setInstanceValueTo, which applies the role defaults). The canvas holds the eye box with the eye-off layer alone;
// the revealed eye is prop-only, remembered for Play and the export. A picker swap of the eye-off keeps one layer with its bindings, and a text
// kind has no eye.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '@midas/builder-core';
import { studioReplay } from './helpers/studioReplay.js';

const { TEMPLATES, BASE_SNAPSHOT, applyBasePlan, planFromSnapshot, DESIGN_SYSTEM_PAGE } = core;
const input = TEMPLATES.get('input');

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

/** The Input demo instance Generate Design System placed. */
function demoOf({ doc, page }) {
    const master = page.nodes.find(n => n.component && n.behavior?.templateId === input.id);
    const demo = page.nodes.find(n => n.isInstance && n.sourceId === master.id);
    assert.ok(demo, 'the Input demo instance exists');
    return { demo, layers: () => doc.descendants(demo.id) };
}

/** Writes one prop through the editor's edit path (defaults of the icon slots included), then runs the studio's sync. */
function setProp(replay, demo, prop, value) {
    replay.setInstanceValueTo(demo, prop, value);
}

/** The managed slots of an instance's layers, in tree order. */
const slotsOf = layers => layers.filter(n => n.behavior?.slot !== undefined).map(n => n.behavior.slot);

test('the password kind shows the eye box with the eye-off slot, whose icon is the file\'s eye-off glyph (its role)', () => {
    const replay = generate();
    const { demo, layers } = demoOf(replay);
    setProp(replay, demo, 'kind', 'password');
    assert.deepEqual(slotsOf(layers()).filter(s => s.startsWith('eye')), ['eyeBox', 'eyeOff']);
    const glyph = replay.doc.nodes.find(n => n.component === true && n.name === 'Icon/eyeOff');
    assert.ok(glyph, 'the Design System made the eye-off glyph');
    assert.equal(demo.behavior.props.eyeOffIcon, glyph.id, 'the eye-off slot holds the eye-off glyph');
});

test('choosing the revealed eye adds no canvas layer; the choice is remembered for Play and the export', () => {
    const replay = generate();
    const { demo, layers } = demoOf(replay);
    setProp(replay, demo, 'kind', 'password');
    const eye = replay.doc.nodes.find(n => n.component === true && n.name === 'Icon/eye');
    setProp(replay, demo, 'eyeOnIcon', eye.id);
    assert.deepEqual(slotsOf(layers()).filter(s => s.startsWith('eye')), ['eyeBox', 'eyeOff'], 'no eye-on layer');
    assert.equal(demo.behavior.props.eyeOnIcon, eye.id, 'the choice is kept in the prop');
});

test('a picker swap of one eye keeps exactly one eye layer, with its size and colour bound', () => {
    const replay = generate();
    const { demo, layers } = demoOf(replay);
    setProp(replay, demo, 'kind', 'password');
    const before = layers().find(n => n.behavior?.slot === 'eyeOff');
    const other = replay.doc.nodes.find(n => n.component === true && n.name === 'Icon/eye');
    setProp(replay, demo, 'eyeOffIcon', other.id);
    const after = layers().filter(n => n.behavior?.slot === 'eyeOff');
    assert.equal(after.length, 1, 'one eye-off layer after the swap');
    assert.ok(Object.keys(before.vars).length > 0, 'the eye is bound before the swap');
    assert.deepEqual(after[0].vars, before.vars, 'its colour and size bindings are kept');
});

test('a text kind has no eye layer; the password kind comes back with its eye', () => {
    const replay = generate();
    const { demo, layers } = demoOf(replay);
    setProp(replay, demo, 'kind', 'password');
    setProp(replay, demo, 'kind', 'text');
    assert.deepEqual(slotsOf(layers()).filter(s => s.startsWith('eye')), []);
    setProp(replay, demo, 'kind', 'password');
    assert.deepEqual(slotsOf(layers()).filter(s => s.startsWith('eye')), ['eyeBox', 'eyeOff'], 'the eye is made again');
});
