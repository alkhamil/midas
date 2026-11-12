// Card content on the canvas: the size ladder of the head at the five Size modes, the actions and the extra starting with instances of Icon Button and Link (the
// Card's Size step followed, the icons of their roles), and the hover preview drawing its shadow on the canvas overlay only while Hoverable holds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ensureDevServers, openImportedFile } from './harness.mjs';
import { createFromPanel, isolatedStage, setProp } from './parity-helpers.mjs';

const HEAD = { xs: 32, sm: 40, md: 56, lg: 64, xl: 72 };

test('the head follows the Size ladder, the actions and the extra start with instances, and Hover draws the shadow on the canvas', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    const browser = await chromium.launch();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage({ name: 'card-content.midas' }));
    const id = await createFromPanel(page, 'antd-card');
    const master = await page.evaluate(id => window.midas.doc.get(window.midas.doc.get(id).sourceId), id);
    const sizeColl = master.behavior.variables.size;
    const modes = await page.evaluate(sizeColl => window.midas.doc.data.variables.collections.find(c => c.id === sizeColl).modes, sizeColl);

    // The head height at every step.
    for (const mode of modes) {
        await page.locator('[data-inspector-tab="design"]').click();
        await page.selectOption(`select[data-var-mode="${sizeColl}"]`, mode.id);
        await page.waitForTimeout(200);
        const head = await page.evaluate(id => window.midas.doc.descendants(id).find(n => n.behavior?.slot === 'header' || n.behavior?.group === 'header')?.h, id);
        assert.ok(head >= HEAD[mode.name] - 0.5 && head <= HEAD[mode.name] + 0.5, `${mode.name} head is ${HEAD[mode.name]}, got ${head}`);
    }

    // The actions: three Icon Button instances of the Card's size step, with the icons of their roles.
    const lg = modes.find(m => m.name === 'lg');
    await page.locator('[data-inspector-tab="design"]').click();
    await page.selectOption(`select[data-var-mode="${sizeColl}"]`, lg.id);
    await setProp(page, 'actions', true);
    await setProp(page, 'extra', true);
    await page.waitForTimeout(500);
    const seeded = await page.evaluate(id => {
        const doc = window.midas.doc;
        const iconButtons = doc.descendants(id).filter(n => n.isInstance && doc.get(n.sourceId)?.behavior?.templateId === 'icon-button');
        const links = doc.descendants(id).filter(n => n.isInstance && doc.get(n.sourceId)?.behavior?.templateId === 'antd-link');
        const collections = doc.data.variables.collections;
        const modeOf = (n, prop) => { const master = doc.get(n.sourceId); const coll = collections.find(c => c.id === master.behavior.variables[prop]); return coll.modes.find(m => m.id === n.varModes?.[coll.id])?.name; };
        return {
            buttons: iconButtons.map(n => ({ icon: doc.get(n.behavior.props.icon)?.name, size: modeOf(n, 'size'), variant: modeOf(n, 'variant') })),
            links: links.map(n => ({ label: n.behavior.props.label, size: modeOf(n, 'size') })),
        };
    }, id);
    assert.deepEqual(seeded.buttons, [
        { icon: 'Icon/setting', size: 'lg', variant: 'text' },
        { icon: 'Icon/edit', size: 'lg', variant: 'text' },
        { icon: 'Icon/ellipsis', size: 'lg', variant: 'text' },
    ]);
    assert.deepEqual(seeded.links, [{ label: 'More', size: 'lg' }]);

    // Hover: no shadow on the overlay without Hoverable, the lift with it.
    const overlayPixels = () => page.evaluate(() => {
        const c = document.getElementById('overlay');
        const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 0) n++;
        return n;
    });
    await page.locator('#inspector-tab-behavior').click();
    await page.selectOption('[data-bp="preview"]', 'hover');
    await page.waitForTimeout(300);
    const without = await overlayPixels();
    await setProp(page, 'hoverable', true);
    await page.locator('#inspector-tab-behavior').click();
    await page.selectOption('[data-bp="preview"]', 'hover');
    await page.waitForTimeout(300);
    const withHover = await overlayPixels();
    assert.ok(withHover > without + 1000, `the hover shadow is drawn (${without} -> ${withHover} overlay pixels)`);
    assert.deepEqual(errors, [], 'console errors');
});
