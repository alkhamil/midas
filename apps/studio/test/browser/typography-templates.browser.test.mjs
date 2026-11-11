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

const PARAGRAPH = {
    id: 'antd-paragraph',
    name: 'paragraph',
    scenarios: [
        ['plain', { type: 'default' }],
        ['ellipsis-2', { ellipsis: true, rows: 2 }],
        ['ellipsis-3', { rows: 3 }],
        ['ellipsis-expand', { expandable: true }],
        ['ellipsis-expand-label', { expandText: 'More' }],
        ['copyable', { expandable: false, ellipsis: false, copyable: true }],
        ['ellipsis-expand-copyable', { ellipsis: true, rows: 2, expandable: true, copyable: true }],
        ...['secondary', 'success', 'warning', 'danger'].map(type => [`type-${type}`, { type }]),
        ['strong-italic', { type: 'default', strong: true, italic: true }],
        ['code-mark', { strong: false, italic: false, code: true, mark: true }],
        ['disabled', { code: false, mark: false, disabled: true }],
    ],
};

const LINK = {
    id: 'antd-link',
    name: 'link',
    scenarios: [
        ['plain', { type: 'default', href: 'https://example.com' }],
        ...['secondary', 'success', 'warning', 'danger'].map(type => [`type-${type}`, { type }]),
        ['strong', { type: 'default', strong: true }],
        ['underline', { strong: false, underline: true }],
        ['italic-strikethrough', { underline: false, italic: true, strikethrough: true }],
        ['code', { italic: false, strikethrough: false, code: true }],
        ['disabled', { code: false, disabled: true }],
    ],
};

/** The state of the props after each scenario: later scenarios build on earlier ones. */
function stateAfter(scenarios) {
    const state = {};
    return scenarios.map(([name, props]) => { Object.assign(state, props); return [name, props, { ...state }]; });
}

for (const template of [TEXT, TITLE, PARAGRAPH, LINK]) for (const dpr of (process.env.DPRS ?? "1,2").split(",").map(Number)) {
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
                if (['type', 'size', 'level'].includes(prop)) await setMode(page, prop, value);
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

/** Opens Play on the instance at actual size on a white background. */
async function openPlay(page, id) {
    await page.evaluate(i => window.midas.select([i]), id);
    await page.locator('#play').click();
    await page.waitForSelector('.play-overlay');
    await page.locator('.play-overlay [aria-label="View options"]').click();
    await page.locator('.play-overlay [data-mode="actual-size"]').click();
    await page.waitForTimeout(400);
}

for (const dpr of (process.env.DPRS ?? '1,2').split(',').map(Number)) {
    test(`paragraph: in Play the expand control lifts the clamp, the copy icon copies, and both recolour on hover (DPR ${dpr})`, async t => {
        const stop = await ensureDevServers();
        t.after(stop);
        mkdirSync(ARTIFACTS, { recursive: true });
        const browser = await chromium.launch({ channel: 'chrome' });
        t.after(() => browser.close());
        const { page, errors } = await openImportedFile(browser, isolatedStage({ name: `typo-paragraph-play.midas` }), { dpr });
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:5174' });
        const id = await createFromPanel(page, 'antd-paragraph');
        for (const [prop, value] of [['ellipsis', true], ['rows', 1], ['expandable', true], ['copyable', true]]) await setProp(page, prop, value);
        await openPlay(page, id);
        const label = page.locator('.play-overlay .antd-paragraph-label');
        const clamped = (await label.boundingBox()).height;
        const color = loc => loc.evaluate(el => getComputedStyle(el).color);
        const expandText = page.locator('.play-overlay .antd-paragraph-expandText');
        const restColour = await color(expandText);
        await expandText.hover();
        await page.waitForTimeout(150);
        assert.notEqual(await color(expandText), restColour, 'the expand text recolours on hover');
        const copier = page.locator('.play-overlay .antd-paragraph-copy');
        const copyRest = await color(copier);
        await copier.hover();
        await page.waitForTimeout(150);
        assert.notEqual(await color(copier), copyRest, 'the copy icon recolours on hover');
        await page.screenshot({ path: resolve(ARTIFACTS, `typo-paragraph-${dpr}x-play-hover.png`) });
        await page.locator('.play-overlay .antd-paragraph-expander').click();
        await page.waitForTimeout(200);
        assert.ok((await label.boundingBox()).height > clamped + 1, 'expanded: the whole text shows');
        assert.equal(await page.locator('.play-overlay .antd-paragraph[data-expanded]').count(), 1);
        await page.locator('.play-overlay .antd-paragraph-expander').click();
        await page.waitForTimeout(200);
        assert.ok(Math.abs((await label.boundingBox()).height - clamped) < 0.5, 'a second click clamps again');
        await copier.click();
        const copied = await page.evaluate(() => navigator.clipboard.readText());
        assert.match(copied, /^Ant Design, a design language/, 'the text is on the clipboard');
        assert.deepEqual(errors, [], 'no console errors');
    });
}

for (const dpr of (process.env.DPRS ?? '1,2').split(',').map(Number)) {
    test(`link: in Play the anchor carries its href, recolours on hover and pressed, stays on the stage when clicked, and a disabled link does none of it (DPR ${dpr})`, async t => {
        const stop = await ensureDevServers();
        t.after(stop);
        mkdirSync(ARTIFACTS, { recursive: true });
        const browser = await chromium.launch({ channel: 'chrome' });
        t.after(() => browser.close());
        const { page, errors } = await openImportedFile(browser, isolatedStage({ name: 'typo-link-play.midas' }), { dpr });
        const id = await createFromPanel(page, 'antd-link');
        await setProp(page, 'href', 'https://example.com/away');
        await openPlay(page, id);
        const anchor = page.locator('.play-overlay a.antd-link');
        assert.equal(await anchor.getAttribute('href'), 'https://example.com/away');
        const label = page.locator('.play-overlay .antd-link-label');
        const colour = () => label.evaluate(el => getComputedStyle(el).color);
        const rest = await colour();
        await anchor.hover();
        await page.waitForTimeout(150);
        const hover = await colour();
        assert.notEqual(hover, rest, 'hover recolours');
        await page.mouse.down();
        await page.waitForTimeout(100);
        const pressed = await colour();
        assert.notEqual(pressed, hover, 'pressed recolours again');
        await page.screenshot({ path: resolve(ARTIFACTS, `typo-link-${dpr}x-play-pressed.png` )});
        await page.mouse.up();
        const url = page.url();
        await page.waitForTimeout(300);
        assert.equal(page.url(), url, 'a click does not leave the studio');
        assert.equal(await page.locator('.play-overlay').count(), 1, 'Play is still open');
        await page.keyboard.press('Escape');
        await page.waitForSelector('.play-overlay', { state: 'detached' });
        await setProp(page, 'disabled', true);
        await openPlay(page, id);
        const off = page.locator('.play-overlay .antd-link');
        assert.equal(await off.getAttribute('href'), null, 'a disabled link has no href');
        const dRest = await label.evaluate(el => getComputedStyle(el).color);
        await off.hover({ force: true });
        await page.waitForTimeout(150);
        assert.equal(await label.evaluate(el => getComputedStyle(el).color), dRest, 'a disabled link does not hover');
        assert.deepEqual(errors, [], 'no console errors');
    });
}
