// Spin, Empty and Search Field on the canvas and in Play: a created instance measured at every Size mode and each state, the same comparison as
// strict-parity (every canvas node is a Play element within 0.5px, and Play draws nothing the canvas does not). Writes one pair per Size and state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { ARTIFACTS, ensureDevServers, openImportedFile, launchBrowser, settle } from './harness.mjs';
import { createFromPanel, isolatedStage, measurePair, setProp } from './parity-helpers.mjs';

const CASES = [
    {
        templateId: 'antd-spin',
        name: 'Spin',
        // A status with no border: no outline to measure.
        outline: false,
        states: [{ name: 'spinning', props: { spinning: true } }],
    },
    {
        templateId: 'antd-empty',
        name: 'Empty',
        outline: false,
        states: [
            { name: 'description', props: { hasImage: false, hasAction: false } },
            { name: 'image', props: { hasImage: true, hasAction: false } },
            { name: 'action', props: { hasImage: false, hasAction: true } },
        ],
    },
    {
        templateId: 'antd-search',
        name: 'Search Field',
        // Input's outline is transparent at rest and is skipped, as in strict-parity.
        outline: false,
        states: [
            { name: 'suffix', props: { hasSuffix: true } },
            { name: 'no-suffix', props: { hasSuffix: false } },
        ],
    },
];

for (const c of CASES) {
    test(`a created ${c.name} measures the same on the canvas and in Play at every Size and state, within 0.5px`, async t => {
        const stop = await ensureDevServers();
        t.after(stop);
        mkdirSync(ARTIFACTS, { recursive: true });
        const browser = await launchBrowser();
        t.after(() => browser.close());
        const { page, errors } = await openImportedFile(browser, isolatedStage({ name: `${c.templateId}.midas` }));

        const id = await createFromPanel(page, c.templateId);
        const master = await page.evaluate(id => window.midas.doc.get(window.midas.doc.get(id).sourceId), id);
        const sizeColl = master.behavior.variables.size;
        const modes = await page.evaluate(sizeColl => window.midas.doc.data.variables.collections.find(x => x.id === sizeColl).modes, sizeColl);

        const failures = [];
        for (const mode of modes) {
            await page.locator('[data-inspector-tab="design"]').click();
            await page.selectOption(`select[data-var-mode="${sizeColl}"]`, mode.id);
            await page.waitForTimeout(200);
            for (const state of c.states) {
                for (const [name, value] of Object.entries(state.props)) await setProp(page, name, value);
                const label = `${c.templateId} ${mode.name} ${state.name}`;
                const pair = `pair-${c.templateId}-${mode.name.toLowerCase()}-${state.name}`;
                const m = await measurePair(page, browser, id, label, pair, { outline: c.outline, matchBackdrop: true });
                failures.push(...m.failures);
            }
        }
        assert.deepEqual(errors, [], 'console errors while measuring');
        assert.deepEqual(failures, [], 'canvas and Play differ');
    });
}

test('an Empty with hasAction on and no Button in its Action slot shows Play a notice, and no Action', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage({ name: 'antd-empty-notice.midas' }));
    const id = await createFromPanel(page, 'antd-empty');
    await setProp(page, 'hasAction', true);
    // The seeded Button is the Action slot's only layer: remove it, so the slot is empty.
    const removed = await page.evaluate(id => {
        const action = window.midas.doc.children(id).find(n => n.propBind?.slot === 'action');
        const button = action && window.midas.doc.children(action.id)[0];
        if (!button) return false;
        window.midas.select([button.id]);
        return true;
    }, id);
    assert.ok(removed, 'the Action slot holds the seeded Button before it is removed');
    await page.keyboard.press('Delete');
    await settle(page, 6);
    await page.evaluate(id => window.midas.select([id]), id);
    await page.locator('#play').click();
    await page.waitForSelector('.play-overlay');
    await settle(page, 4);
    const notice = await page.locator('.play-overlay .midas-play-warning').textContent();
    await page.locator('[aria-label="Close (Esc)"]').click();
    assert.equal(notice, 'Empty: fill the Action slot');
    assert.deepEqual(errors, [], 'no console errors');
});
