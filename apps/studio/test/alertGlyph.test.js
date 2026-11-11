// Alert's type glyph through the studio's mode path: a Design-panel change of the Type mode (writeVarMode) makes the icon slot take the glyph of the new
// type while it holds the default glyph of the old one, and keeps a glyph the designer picked. The demo instance Generate Design System places is the subject.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '@midas/builder-core';
import { studioReplay } from './helpers/studioReplay.js';

const { TEMPLATES, BASE_SNAPSHOT, applyBasePlan, planFromSnapshot, DESIGN_SYSTEM_PAGE } = core;
const alert = TEMPLATES.get('antd-alert');

/** The run as runDesignSystem makes it, on a new Design System page of a plain file. */
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

test('a Type change makes the default glyph follow the type, and a glyph the designer picked stays', () => {
    const replay = generate();
    const { doc, page } = replay;
    const master = page.nodes.find(n => n.component && n.behavior?.templateId === alert.id);
    const demo = page.nodes.find(n => n.isInstance && n.sourceId === master.id);
    assert.ok(demo, 'the Alert demo instance exists');
    const typeColl = master.behavior.variables.type;
    const modeId = name => replay.varStore().collections.find(c => c.id === typeColl).modes.find(m => m.name === name).id;
    const glyph = name => doc.nodes.find(n => n.component === true && n.name === `Icon/${name}`)?.id;
    assert.ok(glyph('alert-info') && glyph('alert-error'), 'the Design System made the type glyphs');

    assert.equal(demo.behavior.props.icon, glyph('alert-info'), 'the demo starts with the info glyph');
    // The mode path (writeVarMode) sets the node's mode, then runs applyTypeGlyph on the instance: the same two steps here.
    demo.varModes = { ...(demo.varModes ?? {}), [typeColl]: modeId('error') };
    replay.applyTypeGlyph(demo);
    assert.equal(demo.behavior.props.icon, glyph('alert-error'), 'a mode change to error takes the error glyph');

    demo.behavior = { ...demo.behavior, props: { ...demo.behavior.props, icon: 'designer-glyph' } };
    demo.varModes = { ...demo.varModes, [typeColl]: modeId('warning') };
    replay.applyTypeGlyph(demo);
    assert.equal(demo.behavior.props.icon, 'designer-glyph', 'a glyph the designer picked is kept across a mode change');
});
