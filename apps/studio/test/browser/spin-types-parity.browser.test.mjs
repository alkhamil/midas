// Spin's Type, every value at every Size: the canvas and Play measure the same (within 0.5px, pixel share under the limit), and Play moves each
// animated Type while it is open (read twice while running, not at rest).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { ensureDevServers, openImportedFile, launchBrowser, ARTIFACTS, settle } from './harness.mjs';
import { createFromPanel, isolatedStage, measurePair, setProp } from './parity-helpers.mjs';

const TYPES = ['dots', 'arc', 'ring', 'ringTwo', 'ringDot', 'ringGap', 'ringScale', 'ringScaleTwo', 'squares', 'dotSlide', 'orbit', 'bars', 'bounce', 'bounceAlt'];

/** Each animation Play runs, with whether its element's transform or opacity moves between two reads 300 ms apart. */
const motionOf = page => page.evaluate(async () => {
    const read = () => document.getAnimations().filter(a => a.animationName).map(a => {
        const cs = getComputedStyle(a.effect.target);
        return { name: a.animationName, value: cs.transform + '|' + cs.opacity };
    });
    const first = read();
    await new Promise(r => setTimeout(r, 300));
    const second = read();
    return first.map((f, i) => ({ name: f.name, moves: second[i] !== undefined && second[i].value !== f.value }));
});

test('Spin: every Type at every Size measures the same on the canvas and in Play, and Play moves it', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage({ name: 'spin-types-parity.midas' }));
    const id = await createFromPanel(page, 'antd-spin');
    const master = await page.evaluate(id => window.midas.doc.get(window.midas.doc.get(id).sourceId), id);
    const sizeColl = master.behavior.variables.size;
    const modes = await page.evaluate(sizeColl => window.midas.doc.data.variables.collections.find(x => x.id === sizeColl).modes, sizeColl);
    const failures = [];
    const still = {};
    for (const type of TYPES) {
        await setProp(page, 'type', type);
        for (const mode of modes) {
            await page.locator('[data-inspector-tab="design"]').click();
            await page.selectOption(`select[data-var-mode="${sizeColl}"]`, mode.id);
            await page.evaluate(() => document.fonts.ready);
            await settle(page, 6);
            const m = await measurePair(page, browser, id, `spin ${type} ${mode.name}`, `pair-spin-${type}-${mode.name.toLowerCase()}`, { outline: false, matchBackdrop: true });
            failures.push(...m.failures);
        }
        // Play, read while it runs, at the default Size (the Play of each Size is measured above).
        await page.locator('[data-inspector-tab="design"]').click();
        await page.selectOption(`select[data-var-mode="${sizeColl}"]`, modes[0].id);
        await settle(page, 4);
        await page.evaluate(id => window.midas.select([id]), id);
        await page.locator('#play').click();
        await page.waitForSelector('.play-overlay');
        await settle(page, 6);
        still[type] = await motionOf(page);
        await page.locator('[aria-label="Close (Esc)"]').click();
        await page.waitForSelector('.play-overlay', { state: 'detached' });
    }
    for (const type of TYPES) assert.ok(still[type].some(a => a.moves), `${type}: Play moves nothing (${JSON.stringify(still[type])})`);
    assert.deepEqual(errors, [], 'console errors');
    assert.deepEqual(failures, [], 'canvas and Play differ');
});
