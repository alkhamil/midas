// What the Design tab sets on a template instance's layers reaches Play, in both modes: unbound (Play draws the raw px / hex) and bound to a variable of any collection
// (Play resolves it). One property class per row, on representative templates: Button (box and label), Checkbox (the box group), Avatar (root), Text (label only).
// The raw value goes through the Design tab's own handler (midas.setProperty, the one every Design input calls). A binding is what bindVariable writes (`vars[prop] = id`).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { ARTIFACTS, ensureDevServers, openImportedFile } from './harness.mjs';
import { createFromPanel, isolatedStage } from './parity-helpers.mjs';

const RGB = (r, g, b) => `rgb(${r}, ${g}, ${b})`;
// The variables the bound mode binds to: a collection of their own, so they belong to no template.
const E2E = { color: '#123456', radius: 9, pad: 13, gap: 5, width: 187, fontSize: 29 };

// A row: [property, node var key / field, raw value, bound item, CSS property in Play, expected raw, expected bound, options]. Options: boundKey (the vars key a binding
// uses when it is not the field), detach (vars keys the Design tab detaches first: an attached typography is read-only).
const COLOUR_RAW = '#ff0000', COLOUR_RAW_CSS = RGB(255, 0, 0), COLOUR_BOUND_CSS = RGB(18, 52, 86);
const TEXT_ROWS = () => [
    ['text colour', 'fills.0', COLOUR_RAW, 'color', 'color', COLOUR_RAW_CSS, COLOUR_BOUND_CSS],
    ['typography', 'fontSize', 23, 'typography', 'fontSize', '23px', `${E2E.fontSize}px`, { boundKey: 'typography', detach: ['typography'] }],
];
const BOX_ROWS = (fill, stroke) => [
    ['fill', 'fills.0', COLOUR_RAW, 'color', 'backgroundColor', fill, COLOUR_BOUND_CSS],
    ['stroke', 'stroke', '#00ff00', 'color', 'borderTopColor', stroke, COLOUR_BOUND_CSS],
    ['radius', 'radius', 7, 'radius', 'borderTopLeftRadius', '7px', `${E2E.radius}px`],
];
const CASES = [
    ['button', 'root', [...BOX_ROWS(COLOUR_RAW_CSS, RGB(0, 255, 0)),
        ['padding', 'padH', 21, 'pad', 'paddingLeft', '21px', `${E2E.pad}px`],
        ['gap', 'gap', 11, 'gap', 'columnGap', '11px', `${E2E.gap}px`],
        ['fixed width', 'w', 222, 'width', 'width', '222px', `${E2E.width}px`]]],
    ['button', 'label', TEXT_ROWS()],
    ['checkbox', 'box', BOX_ROWS(COLOUR_RAW_CSS, RGB(0, 255, 0))],
    ['checkbox', 'label', TEXT_ROWS()],
    ['radio', 'box', BOX_ROWS(COLOUR_RAW_CSS, RGB(0, 255, 0))],
    ['radio', 'label', TEXT_ROWS()],
    ['antd-avatar', 'root', [['fill', 'fills.0', COLOUR_RAW, 'color', 'backgroundColor', COLOUR_RAW_CSS, COLOUR_BOUND_CSS]]],
    ['antd-text', 'label', TEXT_ROWS()],
];

/** The variables of the bound mode, added to the open file in one edit. */
const addVariables = page => page.evaluate(E2E => window.midas.transaction('E2E variables', () => {
    const store = window.midas.doc.data.variables;
    const mode = 'e2e-mode';
    store.collections.push({ id: 'e2e-coll', name: 'E2E', modes: [{ id: mode, name: 'Mode 1' }] });
    const add = (id, type, value) => store.items.push({ id, collectionId: 'e2e-coll', name: id, type, values: { [mode]: value } });
    add('e2e-color', 'color', E2E.color);
    add('e2e-radius', 'number', E2E.radius);
    add('e2e-pad', 'number', E2E.pad);
    add('e2e-gap', 'number', E2E.gap);
    add('e2e-width', 'number', E2E.width);
    const source = store.items.find(i => i.type === 'typography' && Object.values(i.values).some(v => v && typeof v === 'object' && !('alias' in v)));
    const raw = Object.values(source.values).find(v => v && typeof v === 'object' && !('alias' in v));
    add('e2e-typography', 'typography', { ...raw, fontSize: E2E.fontSize });
}), E2E);

/** The layer of an instance a row targets. */
const targetOf = (page, instanceId, which) => page.evaluate(({ instanceId, which }) => {
    const { doc } = window.midas;
    if (which === 'root') return instanceId;
    const below = doc.descendants(instanceId);
    if (which === 'box') return below.find(c => c.behavior?.group === 'box')?.id ?? null;
    return below.find(c => c.type === 'text' && !c.behavior?.part && !c.behavior?.text)?.id ?? null;
}, { instanceId, which });

/** Applies one row to a layer: raw through the Design tab's handler (after the Design tab's detach), or bound as bindVariable does. */
const apply = (page, id, key, raw, boundItem, bound, opts = {}) => page.evaluate(({ id, key, raw, boundItem, bound, opts }) => window.midas.transaction('E2E design edit', () => {
    const { doc } = window.midas;
    const n = doc.get(id);
    if (bound) {
        n.vars = { ...(n.vars || {}), [opts.boundKey ?? key]: `e2e-${boundItem}` };
        doc.touch(n);
        return;
    }
    if (n.vars) for (const k of [key, ...(opts.detach ?? [])]) delete n.vars[k];
    window.midas.select([id]);
    window.midas.setProperty(key === 'fills.0' ? 'fill' : key, raw);
    if (key === 'w') { n.layoutSizingH = 'fixed'; doc.touch(n); }
}), { id, key, raw, boundItem, bound, opts });

/** What the canvas holds for a property after the edit and the syncs that followed: whether the template's binding came back, and the node's value. */
const canvasHolds = (page, id, key) => page.evaluate(({ id, key }) => {
    const n = window.midas.doc.get(id);
    const value = key === 'fills.0' ? n.fills?.[0]?.color : key === 'padH' ? n.padL ?? n.padding : n[key];
    return { bound: n.vars?.[key] ?? null, value };
}, { id, key });

const styleInPlay = (page, id, css) => page.evaluate(({ id, css }) => {
    const el = document.querySelector('.play-overlay')?.querySelector(`[data-node-id="${id}"]`);
    return el ? getComputedStyle(el)[css] : null;
}, { id, css });

test('every Design tab property reaches Play, unbound as the raw value and bound as the variable\'s value', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await chromium.launch({ channel: 'chrome' });
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage({ name: 'design-tab-play.midas' }), { dpr: 1 });
    await createFromPanel(page, 'button');
    await addVariables(page);
    const failures = [];
    const templates = [...new Set(CASES.map(c => c[0]))];
    for (const bound of [false, true]) {
        for (const templateId of templates) {
            const instanceId = await createFromPanel(page, templateId);
            const wanted = [];
            for (const [, which, rows] of CASES.filter(c => c[0] === templateId)) {
                const layer = await targetOf(page, instanceId, which);
                if (!layer) { failures.push(`${templateId}.${which}: no such layer on the instance`); continue; }
                for (const [name, key, raw, boundItem, css, expectRaw, expectBound, opts] of rows) {
                    await apply(page, layer, key, raw, boundItem, bound, opts);
                    wanted.push({ label: `${bound ? 'bound' : 'raw'} ${templateId}.${which} ${name}`, layer, key, raw, css, expect: bound ? expectBound : expectRaw, isRaw: !bound });
                }
            }
            await page.waitForTimeout(400);
            // A raw edit sticks on the canvas: the sync did not bind the template's variable again, and the node still holds the raw value.
            for (const w of wanted.filter(w => w.isRaw && w.key !== 'w')) {
                const held = await canvasHolds(page, w.layer, w.key);
                if (held.bound !== null || String(held.value).toLowerCase() !== String(w.raw).toLowerCase()) failures.push(`${w.label}: the canvas lost the edit (${JSON.stringify(held)})`);
            }
            await page.evaluate(id => window.midas.select([id]), instanceId);
            await page.locator('#play').click();
            await page.waitForSelector('.play-overlay');
            await page.waitForTimeout(500);
            for (const w of wanted) {
                const got = await styleInPlay(page, w.layer, w.css);
                if (got !== w.expect) failures.push(`${w.label}: Play ${w.css} is ${JSON.stringify(got)}, wanted ${w.expect}`);
            }
            await page.keyboard.press('Escape');
            await page.waitForSelector('.play-overlay', { state: 'detached', timeout: 5000 }).catch(() => {});
        }
    }
    assert.deepEqual(failures, []);
    assert.deepEqual(errors.filter(e => !/503|WebSocket/.test(e)), [], 'no console errors');
});

/** Edits fields of a node in one transaction (the Design tab's sizing, position and alignment inputs write these fields). */
const patch = (page, id, fields) => page.evaluate(({ id, fields }) => window.midas.transaction('E2E layout edit', () => {
    const n = window.midas.doc.get(id);
    Object.assign(n, fields);
    window.midas.doc.touch(n);
}), { id, fields });

const playOf = async (page, instanceId, css) => {
    await page.evaluate(id => window.midas.select([id]), instanceId);
    await page.locator('#play').click();
    await page.waitForSelector('.play-overlay');
    await page.waitForTimeout(500);
    const out = await page.evaluate(({ id, css }) => {
        const el = document.querySelector('.play-overlay').querySelector(`[data-node-id="${id}"]`);
        const s = getComputedStyle(el);
        return Object.fromEntries(css.map(k => [k, s[k]]));
    }, { id: instanceId, css });
    await page.keyboard.press('Escape');
    await page.waitForSelector('.play-overlay', { state: 'detached', timeout: 5000 }).catch(() => {});
    return out;
};

test('hug, fill and fixed sizing, node position and alignment of an instance reach Play', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    const browser = await chromium.launch({ channel: 'chrome' });
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage({ name: 'layout-play.midas' }), { dpr: 1 });
    const failures = [];
    for (const templateId of ['button', 'checkbox']) {
        const id = await createFromPanel(page, templateId);
        const parentId = await page.evaluate(id => window.midas.doc.get(id).parentId, id);
        // The holder is a fixed 420px row, so fill and hug differ.
        await patch(page, parentId, { layoutSizingH: 'fixed', w: 420, padding: 0 });
        const label = what => `${templateId} ${what}`;
        // hug: the content gives the width (the canvas width), well under the row.
        await patch(page, id, { layoutSizingH: 'hug', layoutPositioning: 'auto' });
        const hugW = await page.evaluate(id => window.midas.doc.get(id).w, id);
        let got = await playOf(page, id, ['width']);
        if (Math.abs(parseFloat(got.width) - hugW) > 1.5 || parseFloat(got.width) > 300) failures.push(`${label('hug')}: Play width ${got.width}, canvas ${hugW}`);
        // fixed
        await patch(page, id, { layoutSizingH: 'fixed', w: 200 });
        got = await playOf(page, id, ['width']);
        if (got.width !== '200px') failures.push(`${label('fixed')}: Play width ${got.width}`);
        // fill: the row's width
        await patch(page, id, { layoutSizingH: 'fill' });
        // It takes what the holder's other children leave: it grows (flex 1), past its hug width, and stays inside the 420px row.
        got = await playOf(page, id, ['width', 'flexGrow']);
        if (got.flexGrow !== '1' || parseFloat(got.width) <= hugW + 20 || parseFloat(got.width) > 420) failures.push(`${label('fill')}: Play ${JSON.stringify(got)}, hug was ${hugW}`);
        // alignment (the instance's own, nine positions): end / start
        await patch(page, id, { layoutSizingH: 'hug', primaryAlign: 'end', counterAlign: 'start' });
        got = await playOf(page, id, ['justifyContent', 'alignItems']);
        if (got.justifyContent !== 'flex-end' || got.alignItems !== 'flex-start') failures.push(`${label('align')}: Play ${JSON.stringify(got)}`);
        await patch(page, id, { primaryAlign: 'center', counterAlign: 'center' });
        got = await playOf(page, id, ['justifyContent', 'alignItems']);
        if (got.justifyContent !== 'center' || got.alignItems !== 'center') failures.push(`${label('align centre')}: Play ${JSON.stringify(got)}`);
        // position: absolute at x, y in the holder
        await patch(page, id, { layoutPositioning: 'absolute', x: 30, y: 20 });
        got = await playOf(page, id, ['position', 'left', 'top']);
        if (got.position !== 'absolute' || got.left !== '30px' || got.top !== '20px') failures.push(`${label('position')}: Play ${JSON.stringify(got)}`);
    }
    assert.deepEqual(failures, []);
    assert.deepEqual(errors.filter(e => !/503|WebSocket/.test(e)), [], 'no console errors');
});

test('an override survives a state change and a variant change, and Reset gives the template\'s value back', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    const browser = await chromium.launch({ channel: 'chrome' });
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, isolatedStage({ name: 'override-reset.midas' }), { dpr: 1 });
    const id = await createFromPanel(page, 'checkbox');
    const label = await targetOf(page, id, 'label'), box = await targetOf(page, id, 'box');
    const read = (layer, key) => page.evaluate(({ layer, key }) => ({ bound: window.midas.doc.get(layer).vars?.[key] ?? null, fill: window.midas.doc.get(layer).fills?.[0]?.color, size: window.midas.doc.get(layer).fontSize }), { layer, key });
    const templateFill = (await read(label, 'fills.0')).bound;
    const templateBox = (await read(box, 'stroke')).bound;
    assert.ok(templateFill && templateBox);
    await apply(page, label, 'fills.0', COLOUR_RAW, 'color', false, {});
    await apply(page, label, 'fontSize', 23, 'typography', false, { detach: ['typography'] });
    await apply(page, box, 'stroke', '#00ff00', 'color', false, {});
    const failures = [];
    const check = async what => {
        const l = await read(label, 'fills.0'), b = await read(box, 'stroke');
        if (l.bound !== null || l.fill !== COLOUR_RAW || l.size !== 23) failures.push(`${what}: the label lost its override (${JSON.stringify(l)})`);
        if (b.bound !== null) failures.push(`${what}: the box stroke was bound again`);
    };
    await check('after the edit');
    // state changes: checked, then disabled
    for (const state of ['checked', 'disabled']) {
        await page.locator('#inspector-tab-behavior').click();
        await page.evaluate(id => window.midas.select([id]), id);
        await page.locator(`[data-bp-prop="${state}"]`).first().check({ force: true });
        await page.waitForTimeout(500);
        await check(`after ${state}`);
        await page.locator(`[data-bp-prop="${state}"]`).first().uncheck({ force: true });
        await page.waitForTimeout(500);
    }
    // variant change: the Color mode
    await page.evaluate(id => window.midas.select([id]), id);
    const colorSelect = page.locator('[data-bp-prop="color"]').first();
    const options = await colorSelect.locator('option').allTextContents();
    if (options.length > 1) { await colorSelect.selectOption({ index: options.length - 1 }); await page.waitForTimeout(500); await check('after a Color change'); }
    // Reset: the template's variables come back.
    await page.evaluate(({ label, box }) => { window.midas.select([label, box]); window.midas.resetOverride(); }, { label, box });
    await page.waitForTimeout(600);
    const l = await read(label, 'fills.0'), b = await read(box, 'stroke');
    if (l.bound !== templateFill) failures.push(`reset: the label colour is ${l.bound}, the template's is ${templateFill}`);
    if (b.bound !== templateBox) failures.push(`reset: the box stroke is ${b.bound}, the template's is ${templateBox}`);
    assert.deepEqual(failures, []);
    assert.deepEqual(errors.filter(e => !/503|WebSocket/.test(e)), [], 'no console errors');
});