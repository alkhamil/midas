// Spin, Empty, Search Field, Statistic, Switch and List on the canvas and in Play: a created instance measured at every Size mode and each state, the same comparison as
// strict-parity (every canvas node is a Play element within 0.5px, and Play draws nothing the canvas does not). Writes one pair per Size and state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { ARTIFACTS, ensureDevServers, openImportedFile, launchBrowser, settle } from './harness.mjs';
import { createFromPanel, isolatedStage, measurePair, setProp } from './parity-helpers.mjs';

const CASES = [
    {
        templateId: 'switch',
        name: 'Switch',
        // The track is the root: no outline is drawn (the focus ring is not drawn), so there is nothing to measure beyond the boxes.
        outline: false,
        states: [
            { name: 'off', props: { checked: false } },
            { name: 'on', props: { checked: true } },
        ],
    },
    {
        templateId: 'list',
        name: 'List',
        // The canvas draws the item once and Play repeats it itemCount times: one copy is the case the two draw alike.
        outline: false,
        states: [{ name: 'one-copy', props: { itemCount: 1 } }],
    },
    {
        templateId: 'antd-statistic',
        name: 'Statistic',
        // The title and value are text, no outline: nothing to measure beyond the boxes.
        outline: false,
        // Statistic is the last thing in its frame, so Play's viewport clips its shot at the bottom: the frame gets room below, as Search Field does.
        room: 200,
        states: [
            { name: 'plain', props: { hasPrefix: false, hasSuffix: false } },
            { name: 'prefix', props: { hasPrefix: true, hasSuffix: false } },
            { name: 'suffix', props: { hasPrefix: false, hasSuffix: true } },
        ],
    },
    {
        templateId: 'antd-spin',
        name: 'Spin',
        // A status with no border: no outline to measure.
        outline: false,
        // The dot ring's dot is lifted above the holder: the frame gets room, as Statistic and Search Field do.
        room: 200,
        states: [
            { name: 'dots', props: { type: 'dots' } },
            { name: 'arc', props: { type: 'arc' } },
            { name: 'dot-ring', props: { type: 'ringDot' } },
        ],
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
        // The Design System frame grows by this much below the component, which is the last template made: see frameWithRoom.
        room: 200,
        states: [
            { name: 'suffix', props: { hasSuffix: true } },
            { name: 'no-suffix', props: { hasSuffix: false } },
        ],
    },
];

/**
 * Play opens the top-level frame that holds the selection. Search is the last template made, so it sits at the end of that frame: its padding
 * reaches the bottom of Play's viewport and the shot is cut short. The frame grows by `room` below its content, and its Prototype Scroll
 * behaviour is vertical, so Play scrolls it like any scrolling frame.
 */
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

        const id = await createFromPanel(page, c.templateId);
        if (c.room) await frameWithRoom(page, id, c.room);
        const master = await page.evaluate(id => window.midas.doc.get(window.midas.doc.get(id).sourceId), id);
        const sizeColl = master.behavior.variables.size;
        const modes = await page.evaluate(sizeColl => window.midas.doc.data.variables.collections.find(x => x.id === sizeColl).modes, sizeColl);

        const failures = [];
        for (const mode of modes) {
            await page.locator('[data-inspector-tab="design"]').click();
            await page.selectOption(`select[data-var-mode="${sizeColl}"]`, mode.id);
            // The text is measured with the fonts it draws with: wait for them, or the canvas measures the fallback face.
            await page.evaluate(() => document.fonts.ready);
            await settle(page, 6);
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
