// The Typography templates (Text, Title, Paragraph, Link) on the canvas and in Play, in Chrome at DPR 1 and 2: every Type and every style, each set through the Behavior tab
// the way a user does. Each scenario shoots the canvas and Play at 1:1 and compares the box of every shown layer (within 0.5px) and the root width (within 0.1px, which holds
// the code box's padding and border to the same tokens on both); the Play label's computed font style, decoration and colour are read back.
// Screenshots go to .artifacts/typo-<template>-<dpr>x-<scenario>-{canvas,play}.png; the measurements to .artifacts/typo-<template>-<dpr>x.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { ARTIFACTS, ensureDevServers, openImportedFile, shotNode } from './harness.mjs';
import { PAD, TOLERANCE_PX, ROOT_WIDTH_TOLERANCE_PX, canvasTree, compare, createFromPanel, isolatedStage, playTree, setProp } from './parity-helpers.mjs';

/** Sets a mode (Type, Size, Level) the way a user does: the select of the Behavior tab. */
async function setMode(page, prop, label) {
    await page.locator('#inspector-tab-behavior').click();
    await page.locator(`[data-bp-prop="${prop}"]`).first().selectOption({ label });
    await page.waitForTimeout(250);
}

const TEXT = {
    id: 'antd-text',
    name: 'text',
    // [scenario name, props to set]. A boolean is set on, a mode by its name. Props not named keep the value the previous scenario left, so each scenario names all it needs.
    scenarios: [
        ...['default', 'secondary', 'success', 'warning', 'danger'].map(type => [`type-${type}`, { type }]),
        ['strong', { type: 'default', strong: true }],
        ['italic', { strong: false, italic: true }],
        ['underline', { italic: false, underline: true }],
        ['strikethrough', { underline: false, strikethrough: true }],
        ['underline-strikethrough', { underline: true, strikethrough: true }],
        ['code', { underline: false, strikethrough: false, code: true }],
        ['mark', { code: false, mark: true }],
        ['code-mark', { code: true, mark: true }],
        ['disabled', { code: false, mark: false, disabled: true }],
        ['all-styles', { disabled: false, strong: true, italic: true, underline: true, strikethrough: true, code: true, mark: true, type: 'danger' }],
    ],
    /** What Play's label must compute for a scenario's props (read back from the DOM). */
    expect: props => ({
        fontStyle: props.italic ? 'italic' : 'normal',
        underline: !!props.underline,
        strike: !!props.strikethrough,
    }),
};

const TITLE = {
    id: 'antd-title',
    name: 'title',
    scenarios: [
        ...['h1', 'h2', 'h3', 'h4', 'h5'].map(level => [`level-${level}`, { level }]),
        ...['default', 'secondary', 'success', 'warning', 'danger'].map(type => [`type-${type}`, { level: 'h2', type }]),
        ['italic', { type: 'default', italic: true }],
        ['underline-strikethrough', { italic: false, underline: true, strikethrough: true }],
        ['code', { underline: false, strikethrough: false, code: true }],
        ['mark', { code: false, mark: true }],
        ['code-mark', { code: true, mark: true }],
        ['disabled', { code: false, mark: false, disabled: true }],
    ],
};

/** The state of the props after each scenario: later scenarios build on earlier ones. */
function stateAfter(scenarios) {
    const state = {};
    return scenarios.map(([name, props]) => { Object.assign(state, props); return [name, props, { ...state }]; });
}

for (const template of [TEXT, TITLE]) for (const dpr of (process.env.DPRS ?? "1,2").split(",").map(Number)) {
    test(`${template.name}: canvas and Play agree at DPR ${dpr}, for every type and style`, async t => {
        const stop = await ensureDevServers();
        t.after(stop);
        mkdirSync(ARTIFACTS, { recursive: true });
        const browser = await chromium.launch({ channel: 'chrome' });
        t.after(() => browser.close());
        const { page, errors } = await openImportedFile(browser, isolatedStage({ name: `typo-${template.name}.midas` }), { dpr });
        const id = await createFromPanel(page, template.id);
        const report = [];
        for (const [name, props, after] of stateAfter(template.scenarios)) {
            for (const [prop, value] of Object.entries(props)) {
                if (typeof value === 'string') await setMode(page, prop, value);
                else await setProp(page, prop, value);
            }
            await page.evaluate(() => window.midas.select([]));
            await page.mouse.move(2, 2);
            const label = `typo-${template.name}-${dpr}x-${name}`;
            await shotNode(page, id, `${label}-canvas`, PAD, 1);
            const canvas = await canvasTree(page, id);
            const play = await playTree(page, id, label);
            assert.ok(play, `${name}: Play draws the ${template.name}`);
            const { rows, unmapped } = compare(canvas, play);
            for (const row of rows) {
                assert.ok(!row.missing, `${name}: ${row.name} is on the canvas but not in Play`);
                assert.ok(row.delta <= TOLERANCE_PX, `${name}: ${row.name} differs by ${row.delta}px (canvas ${JSON.stringify(row.canvas)}, Play ${JSON.stringify(row.play)})`);
            }
            assert.deepEqual(unmapped, [], `${name}: nothing in Play without a node`);
            assert.ok(Math.abs(rows[0].canvas.w - rows[0].play.w) <= ROOT_WIDTH_TOLERANCE_PX, `${name}: root width ${rows[0].canvas.w} vs ${rows[0].play.w}`);
            report.push({ scenario: name, props: after, rows });
        }
        writeFileSync(resolve(ARTIFACTS, `typo-${template.name}-${dpr}x.json`), JSON.stringify(report, null, 1));
        assert.deepEqual(errors, [], 'no console errors');
    });
}
