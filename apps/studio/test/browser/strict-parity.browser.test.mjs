// Strict parity for generator-built components: a Button and an Input created from the Components panel are measured on the canvas
// and in Play at every Size mode and each key state (Loading, Allow Clear, Show Count). Every visible canvas node must be a Play element
// whose box matches the canvas box within 0.5px (relative to the component root), and Play must draw nothing in the component that has
// no node. Writes .artifacts/strict-parity.json (every row measured) and screenshots of the canvas and Play for each size.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { ARTIFACTS, ROOT, ensureDevServers, openImportedFile, shotNode } from './harness.mjs';

const FIXTURE = resolve(ROOT, 'testing.midas');
const TOLERANCE_PX = 0.5;

/** The states each template is measured in, after its Size modes: the prop it toggles and the value it takes. Rest is always measured. */
const STATES = {
    button: [{ name: 'rest' }, { name: 'loading', prop: 'loading', value: true }],
    input: [{ name: 'rest' }, { name: 'allowClear', prop: 'allowClear', value: true }, { name: 'showCount', prop: 'showCount', value: true }],
};

/** Creates a template component from the Components panel, and waits for its instance to be selected. */
async function createFromPanel(page, templateId) {
    await page.getByRole('button', { name: 'Components' }).first().click();
    await page.waitForTimeout(300);
    await page.locator(`[data-create-template="${templateId}"]`).click();
    await page.waitForFunction(() => window.midas.state.selection.size === 1, null, { timeout: 5000 });
    return page.evaluate(() => [...window.midas.state.selection][0]);
}

/** Every node of an instance, its root first, with the canvas box relative to the root and whether it is shown. */
const canvasTree = (page, rootId) => page.evaluate(rootId => {
    const root = window.midas.doc.world(rootId);
    const out = [];
    const walk = id => {
        for (const c of window.midas.doc.children(id)) {
            const w = window.midas.doc.world(c.id);
            out.push({ id: c.id, name: c.name, shown: !w.hidden && c.visible !== false, box: { x: w.box.x - root.box.x, y: w.box.y - root.box.y, w: w.box.w, h: w.box.h } });
            walk(c.id);
        }
    };
    out.unshift({ id: rootId, name: window.midas.doc.get(rootId).name, shown: true, box: { x: 0, y: 0, w: root.box.w, h: root.box.h } });
    walk(rootId);
    return out;
}, rootId);

/** Opens Play on the selection, measures the instance's elements (relative to its root), and closes Play. Animations are read at rest. */
async function playTree(page, rootId) {
    await page.locator('#play').click();
    await page.waitForSelector('.play-overlay');
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getAnimations().forEach(anim => anim.cancel()));
    const measured = await page.evaluate(rootId => {
        const overlay = document.querySelector('.play-overlay');
        const rootEl = overlay.querySelector(`[data-node-id="${rootId}"]`);
        if (!rootEl) return null;
        const r0 = rootEl.getBoundingClientRect();
        const boxes = {};
        for (const el of rootEl.querySelectorAll('[data-node-id]')) {
            const r = el.getBoundingClientRect();
            boxes[el.getAttribute('data-node-id')] = { w: r.width, h: r.height, dx: r.x - r0.x, dy: r.y - r0.y };
        }
        boxes[rootId] = { w: r0.width, h: r0.height, dx: 0, dy: 0 };
        const unmapped = [];
        for (const el of rootEl.querySelectorAll('*')) {
            if (el.closest('[data-node-id]') !== el && el.closest('[data-node-id]')) continue;
            if (el.hasAttribute('data-node-id')) continue;
            const visible = el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
            const text = [...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim() !== '');
            if ((text || el.tagName === 'INPUT') && visible) unmapped.push(`${el.tagName.toLowerCase()}.${el.className}`);
        }
        return { rootWidth: r0.width, rootHeight: r0.height, boxes, unmapped };
    }, rootId);
    await page.locator('[aria-label="Close (Esc)"]').click();
    await page.waitForSelector('.play-overlay', { state: 'detached' });
    return measured;
}

/** One row of the report: the canvas tree against the Play tree at one Size mode and state. */
function compare(canvas, play) {
    const scale = play.rootWidth / canvas[0].box.w;
    const rows = [];
    for (const node of canvas) {
        if (!node.shown) continue;
        const el = play.boxes[node.id];
        if (!el) {
            rows.push({ name: node.name, id: node.id, missing: true });
            continue;
        }
        const d = { x: el.dx / scale - node.box.x, y: el.dy / scale - node.box.y, w: el.w / scale - node.box.w, h: el.h / scale - node.box.h };
        rows.push({ name: node.name, id: node.id, canvas: node.box, play: { x: el.dx / scale, y: el.dy / scale, w: el.w / scale, h: el.h / scale }, delta: +Math.max(...Object.values(d).map(Math.abs)).toFixed(2) });
    }
    return { rows, unmapped: play.unmapped };
}

test('a created Button and Input measure the same on the canvas and in Play at every Size and key state, within 0.5px', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await chromium.launch();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, FIXTURE);

    const report = [];
    const failures = [];
    for (const templateId of ['button', 'input']) {
        const id = await createFromPanel(page, templateId);
        const master = await page.evaluate(id => window.midas.doc.get(window.midas.doc.get(id).sourceId), id);
        const sizeColl = master.behavior.variables.size;
        const modes = await page.evaluate(sizeColl => window.midas.doc.data.variables.collections.find(c => c.id === sizeColl).modes, sizeColl);
        for (const mode of modes) {
            // The Size mode is an Appearance mode, on the Design tab; the key states are props, on the Behavior tab.
            await page.locator('[data-inspector-tab="design"]').click();
            await page.selectOption(`select[data-var-mode="${sizeColl}"]`, mode.id);
            await page.waitForTimeout(200);
            for (const state of STATES[templateId]) {
                if (state.prop) {
                    await page.locator('#inspector-tab-behavior').click();
                    await page.locator(`input[aria-label="${state.prop}"]`).first().check({ force: true });
                    await page.waitForTimeout(200);
                }
                const canvas = await canvasTree(page, id);
                const play = await playTree(page, id);
                assert.ok(play, `${templateId} ${mode.name} ${state.name}: Play draws the component`);
                const { rows, unmapped } = compare(canvas, play);
                const label = `${templateId} ${mode.name} ${state.name}`;
                report.push({ label, rows, unmapped });
                for (const row of rows) {
                    if (row.missing) failures.push(`${label}: ${row.name} is on the canvas but not in Play`);
                    else if (row.delta > TOLERANCE_PX) failures.push(`${label}: ${row.name} differs by ${row.delta}px`);
                }
                for (const u of unmapped) failures.push(`${label}: Play draws ${u} with no node`);
                if (state.prop) {
                    await page.locator('#inspector-tab-behavior').click();
                    await page.locator(`input[aria-label="${state.prop}"]`).first().uncheck({ force: true });
                    await page.waitForTimeout(200);
                }
            }
            await shotNode(page, id, `strict-${templateId}-${mode.name.toLowerCase()}-canvas`);
        }
    }
    writeFileSync(resolve(ARTIFACTS, 'strict-parity.json'), JSON.stringify(report, null, 2));
    assert.deepEqual(errors, [], 'console errors while measuring');
    assert.deepEqual(failures, [], 'canvas and Play differ');
});
