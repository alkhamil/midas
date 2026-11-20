// Spin's Type, every value: each one draws in the canvas and in Play (at rest), with no console error, and its Play shot is saved for a look.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureDevServers, openImportedFile, launchBrowser, shotNode } from './harness.mjs';
import { createFromPanel, isolatedStage, playTree, setProp, PAD } from './parity-helpers.mjs';

const TYPES = ['dots', 'arc', 'ring', 'ringTwo', 'ringDot', 'ringGap', 'ringScale', 'ringScaleTwo', 'squares', 'dotSlide', 'orbit', 'bars', 'bounce', 'bounceAlt'];

test('Spin draws every Type in the canvas and in Play, with no console error', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage({ name: 'spin-loaders.midas' }));
    const id = await createFromPanel(page, 'antd-spin');
    for (const type of TYPES) {
        await setProp(page, 'type', type);
        await shotNode(page, id, `spin-${type}-canvas`, PAD, 2);
        const measured = await playTree(page, id, `spin-${type}`);
        assert.ok(measured, `${type}: Play draws the instance`);
    }
    assert.deepEqual(errors, [], 'console errors');
});
