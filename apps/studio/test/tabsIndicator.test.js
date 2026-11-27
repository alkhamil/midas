// Tabs' indicator props reach every tab in its box: a change on the Tabs writes the same width, Fixed and align to each tab's own props and layers,
// replayed with the real midas.js functions over a plain document (helpers/studioReplay.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '@midas/builder-core';
import { studioReplay } from './helpers/studioReplay.js';

const { BASE_SNAPSHOT, applyBasePlan, planFromSnapshot, DESIGN_SYSTEM_PAGE } = core;

/** The Design System run, then the demo Tabs instance and its tabs. */
function tabsDemo() {
    const replay = studioReplay();
    const { doc } = replay;
    const page = { id: 'ds', name: DESIGN_SYSTEM_PAGE, nodes: [], parentId: null };
    doc.data.pages.push(page);
    const counts = { variables: 0, icons: 0, iconsPresent: 0, created: 0, present: 0, problems: 0 };
    applyBasePlan(replay.varStore(), planFromSnapshot(BASE_SNAPSHOT), replay.stubs.uid);
    replay.onPage(page.id, () => replay.buildDesignSystemPage(counts));
    doc.data.pageId = page.id;
    doc.refresh();
    const master = page.nodes.find(n => n.component && n.behavior?.templateId === 'antd-tabs');
    const tabsInst = page.nodes.find(n => n.isInstance && n.sourceId === master.id);
    const tabMaster = page.nodes.find(n => n.component && n.behavior?.templateId === 'antd-tab');
    const tabs = () => doc.children(doc.descendants(tabsInst.id).find(n => n.propBind?.slot === 'items').id).filter(c => c.sourceId === tabMaster.id);
    /** The indicator node of one tab, and the box's align node. */
    const layersOf = tab => ({
        indicator: doc.descendants(tab.id).find(n => n.behavior?.group === 'indicator' || n.behavior?.slot === 'indicator'),
        box: doc.descendants(tab.id).find(n => n.behavior?.group === 'indicatorBox' || n.behavior?.slot === 'indicatorBox'),
    });
    return { replay, tabsInst, tabs, layersOf };
}

test('a Tabs width, Fixed and align reach every tab and its indicator layers', () => {
    const { replay, tabsInst, tabs, layersOf } = tabsDemo();
    assert.ok(tabs().length >= 1, 'the demo Tabs holds tabs');
    replay.setInstanceValueTo(tabsInst, 'indicatorFixed', true);
    replay.setInstanceValueTo(tabsInst, 'indicatorWidth', 40);
    replay.setInstanceValueTo(tabsInst, 'indicatorAlign', 'end');
    for (const tab of tabs()) {
        assert.equal(tab.behavior.props.indicatorFixed, true, 'Fixed is on in the tab');
        assert.equal(tab.behavior.props.indicatorWidth, 40, 'the width is 40 in the tab');
        assert.equal(tab.behavior.props.indicatorAlign, 'end', 'the align is end in the tab');
        const { indicator, box } = layersOf(tab);
        assert.equal(indicator.w, 40, 'the indicator is 40 wide');
        assert.equal(indicator.layoutSizingH, 'fixed', 'the indicator is fixed');
        assert.equal(box.primaryAlign, 'end', 'the box places it at the end');
    }
});

test('turning Fixed off makes the indicator fill its tab again', () => {
    const { replay, tabsInst, tabs, layersOf } = tabsDemo();
    replay.setInstanceValueTo(tabsInst, 'indicatorFixed', true);
    replay.setInstanceValueTo(tabsInst, 'indicatorFixed', false);
    for (const tab of tabs()) assert.equal(layersOf(tab).indicator.layoutSizingH, 'fill');
});
