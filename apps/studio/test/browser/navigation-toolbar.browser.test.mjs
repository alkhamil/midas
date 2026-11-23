// Pagination, Breadcrumb and Table Toolbar on the canvas and in Play: each created component measured at every Size mode and each state, the same
// comparison as list-item.browser.test.mjs (every canvas node is a Play element within 0.5px, and Play draws nothing the canvas does not).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { ARTIFACTS, ensureDevServers, openImportedFile, launchBrowser, settle } from './harness.mjs';
import { createFromPanel, isolatedStage, measurePair, setProp } from './parity-helpers.mjs';

const CASES = [
    {
        templateId: 'antd-pagination',
        name: 'Pagination',
        // Every state names all of its props: a set prop stays on for the next state.
        states: [
            { name: 'total', props: { showTotal: true, total: 'of 10' } },
            // The total's row is hidden while Show Total is off, so its text is set first.
            { name: 'no-total', props: { total: 'of 10', showTotal: false } },
        ],
    },
    {
        templateId: 'antd-breadcrumb',
        name: 'Breadcrumb',
        states: [
            { name: 'one', props: { item2: '', item3: '' } },
            { name: 'two', props: { item2: 'Application', item3: '' } },
            { name: 'three', props: { item2: 'Application', item3: 'Users' } },
        ],
    },
    {
        templateId: 'table-toolbar',
        name: 'Table Toolbar',
        // The Search Field and the Button are made first: the content slots start with them, seeded from the file's masters.
        before: ['antd-search', 'button'],
        states: [
            { name: 'title', props: { title: 'Users', selectedText: '', hasSearch: false, hasActions: false } },
            { name: 'selected', props: { title: 'Users', selectedText: '2 selected', hasSearch: false, hasActions: false } },
            { name: 'search-actions', props: { title: 'Users', selectedText: '', hasSearch: true, hasActions: true } },
        ],
    },
];

// Play clips the bottom of the frame at the component (the last thing in it), so the frame gets room below it, as Statistic and Search Field do.
async function frameWithRoom(page, id, room) {
    const frameId = await page.evaluate(id => {
        let n = window.midas.doc.get(id);
        while (n.parentId) n = window.midas.doc.get(n.parentId);
        return n.id;
    }, id);
    await page.evaluate(fid => window.midas.select([fid]), frameId);
    const h = await page.evaluate(fid => window.midas.doc.get(fid).h, frameId);
    await page.evaluate(v => window.midas.setProperty('h', v), h + room);
    await page.locator('[data-inspector-tab="prototype"]').click();
    await page.selectOption('[data-pt-overflow]', 'vertical');
    await settle(page, 4);
    await page.evaluate(id => window.midas.select([id]), id);
}

for (const c of CASES) {
    test(`a created ${c.name} measures the same on the canvas and in Play at every Size and state, within 0.5px`, async t => {
        const stop = await ensureDevServers();
        t.after(stop);
        mkdirSync(ARTIFACTS, { recursive: true });
        const browser = await launchBrowser();
        t.after(() => browser.close());
        const { page, errors } = await openImportedFile(browser, isolatedStage({ name: `${c.templateId}.midas` }));

        for (const other of c.before ?? []) await createFromPanel(page, other);
        const id = await createFromPanel(page, c.templateId);
        await frameWithRoom(page, id, 200);
        const master = await page.evaluate(id => window.midas.doc.get(window.midas.doc.get(id).sourceId), id);
        const sizeColl = master.behavior.variables.size;
        const modes = await page.evaluate(sizeColl => window.midas.doc.data.variables.collections.find(x => x.id === sizeColl).modes, sizeColl);

        const failures = [];
        for (const mode of modes) {
            await page.locator('[data-inspector-tab="design"]').click();
            await page.selectOption(`select[data-var-mode="${sizeColl}"]`, mode.id);
            await page.evaluate(() => document.fonts.ready);
            await settle(page, 6);
            for (const state of c.states) {
                for (const [name, value] of Object.entries(state.props)) await setProp(page, name, value);
                const label = `${c.templateId} ${mode.name} ${state.name}`;
                const pair = `pair-${c.templateId}-${mode.name.toLowerCase()}-${state.name}`;
                const m = await measurePair(page, browser, id, label, pair, { outline: false, matchBackdrop: true });
                failures.push(...m.failures);
            }
        }
        assert.deepEqual(errors, [], 'console errors while measuring');
        assert.deepEqual(failures, [], 'canvas and Play differ');
    });
}
