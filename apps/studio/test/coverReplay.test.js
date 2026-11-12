// The Card cover's picture through the real studio path: turning Cover on starts the placeholder (an image fill on the cover frame), a mode and tile scale set in the Fill
// section stay through every sync, and choosing an image from the Fill section writes the shared prop, which the Behavior tab shows.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '@midas/builder-core';
import { studioReplay } from './helpers/studioReplay.js';

const { TEMPLATES, BASE_SNAPSHOT, applyBasePlan, planFromSnapshot, DESIGN_SYSTEM_PAGE, instancePanel, PLACEHOLDER_IMAGE_ID } = core;
const card = TEMPLATES.get('antd-card');

function generate() {
    const replay = studioReplay({ activeImages: new Map([['p2', { width: 80, height: 40 }]]) });
    const { doc } = replay;
    const page = { id: 'ds', name: DESIGN_SYSTEM_PAGE, nodes: [], parentId: null };
    doc.data.assets ??= {};
    doc.data.pages.push(page);
    const counts = { variables: 0, icons: 0, iconsPresent: 0, created: 0, present: 0, problems: 0 };
    counts.variables += applyBasePlan(replay.varStore(), planFromSnapshot(BASE_SNAPSHOT), replay.stubs.uid).items;
    replay.onPage(page.id, () => replay.buildDesignSystemPage(counts));
    doc.data.pageId = page.id;
    doc.refresh();
    const master = page.nodes.find(n => n.component && n.behavior?.templateId === card.id);
    const demo = page.nodes.find(n => n.isInstance && n.sourceId === master.id);
    const cover = () => replay.doc.descendants(demo.id).find(n => (n.behavior?.group ?? n.behavior?.slot) === 'belowBox');
    return { ...replay, master, demo, cover };
}
const imageFill = layer => layer.fills.find(f => f.type === 'image');

test('Cover on starts the placeholder: the Fill list of the cover layer is exactly one row, the picture; its colour is the fallback, read from the bound variable, in no fill', () => {
    const { doc, demo, cover, setInstanceValueTo, writeBound } = generate();
    setInstanceValueTo(demo, 'cover', true);
    assert.equal(demo.behavior.props.coverImage, PLACEHOLDER_IMAGE_ID);
    assert.ok(doc.data.assets[PLACEHOLDER_IMAGE_ID].startsWith('data:image/svg+xml'));
    const layer = cover();
    assert.equal(layer.fills.length, 1, 'one row in the Fill list');
    assert.deepEqual([layer.fills[0].type, layer.fills[0].image, layer.fills[0].mode, layer.fills[0].visible], ['image', PLACEHOLDER_IMAGE_ID, 'fill', true]);
    assert.ok(layer.fills.every(f => f.visible !== false), 'no hidden fill');
    // The variable's value reaches the layer's fallback field (not a fill) through the one writer of bound values.
    assert.equal(writeBound(layer, 'fallbackFill', '#eeeeee', 'color'), true);
    assert.equal(layer.fallbackFill, '#eeeeee');
    assert.equal(layer.fills.length, 1, 'writing the fallback adds no fill');
    assert.ok(layer.vars.fallbackFill, 'bound to the variable, not to a fill');
    assert.equal(layer.vars['fills.0'], undefined);
});

test('the mode and the tile scale set on the cover\'s fill are the designer\'s: they stay through the syncs of other edits and of a new picture', () => {
    const { demo, cover, setInstanceValueTo, syncInstance, doc } = generate();
    setInstanceValueTo(demo, 'cover', true);
    const fill = imageFill(cover());
    Object.assign(fill, { mode: 'tile', scale: 0.5, iw: 80, ih: 40 });
    setInstanceValueTo(demo, 'actions', true);
    setInstanceValueTo(demo, 'title', 'Another');
    syncInstance(demo);
    assert.deepEqual([imageFill(cover()).mode, imageFill(cover()).scale], ['tile', 0.5]);
    // A new picture from the prop (the Behavior path) keeps the mode and scale and gets its own natural size on the fill.
    doc.data.assets.p2 = 'data:image/png;base64,AAAA';
    setInstanceValueTo(demo, 'coverImage', 'p2');
    assert.deepEqual([imageFill(cover()).image, imageFill(cover()).mode, imageFill(cover()).scale, imageFill(cover()).iw], ['p2', 'tile', 0.5, 80]);
});

test('choosing an image from the Fill section writes the shared prop, and the Behavior tab shows it', () => {
    const { demo, cover, master, doc, setInstanceValueTo, chooseFillImage } = generate();
    setInstanceValueTo(demo, 'cover', true);
    doc.data.assets.p2 = 'data:image/png;base64,AAAA';
    const idx = cover().fills.findIndex(f => f.type === 'image');
    chooseFillImage([cover()], idx, 'p2');
    assert.equal(demo.behavior.props.coverImage, 'p2');
    assert.equal(imageFill(cover()).image, 'p2', 'the fill holds it');
    const row = instancePanel(demo, master, doc.data.variables.collections, {}).rows.find(r => r.prop === 'coverImage');
    assert.deepEqual([row.kind, row.slot, row.value], ['image', true, 'p2']);
});

test('tile at a scale keeps the natural size of the picture on the fill, for Play and the export', () => {
    const { demo, cover, doc, setInstanceValueTo, noteNaturalSize } = generate();
    setInstanceValueTo(demo, 'cover', true);
    doc.data.assets.p2 = 'data:image/png;base64,AAAA';
    setInstanceValueTo(demo, 'coverImage', 'p2');
    const fill = imageFill(cover());
    fill.mode = 'tile';
    noteNaturalSize(fill);
    assert.deepEqual([fill.iw, fill.ih], [80, 40]);
    assert.equal(core.imageFillCss({ ...fill, scale: 0.5 }, doc.data.assets).backgroundSize, '40px 20px');
});
