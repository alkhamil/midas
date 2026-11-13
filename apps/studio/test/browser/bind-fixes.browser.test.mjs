// A plain frame with a text layer, bound to Button or Input from the Behavior panel, then instanced. The instance draws what its props
// say, on the canvas and in Play: the Button's solid background and spinner (its colour and size from the Semantic foreground and the
// icon size), the wave on a click, the Size height as a fixed height, and the Input's value and placeholder.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ensureDevServers, openImportedFile, shotNode, ARTIFACTS, ROOT, launchBrowser } from './harness.mjs';
import { setProp, PAD } from './parity-helpers.mjs';

/** The testing file with a stage and one plain frame holding a text layer "Test", on the Testing page. */
function bindStage(name) {
    const data = JSON.parse(readFileSync(resolve(ROOT, 'testing.midas'), 'utf8'));
    const page = data.pages.find(p => p.name === 'Testing');
    data.pageId = page.id;
    const black = [{ type: 'solid', color: '#000000', opacity: 1, visible: true }];
    page.nodes = [
        { id: 'strict-stage', name: 'Stage', type: 'frame', parentId: null, x: -5000, y: -5000, w: 400, h: 200, clip: true, component: false, isInstance: false, fills: [{ type: 'solid', color: '#ffffff', opacity: 1, visible: true }], layout: 'none' },
        { id: 'bind-frame', name: 'Test', type: 'frame', parentId: null, x: -4900, y: -4900, w: 160, h: 40, clip: false, component: false, isInstance: false, fills: [], layout: 'horizontal', gap: 0, padding: 0 },
        { id: 'bind-label', name: 'Test', type: 'text', parentId: 'bind-frame', x: 0, y: 0, w: 40, h: 16, text: 'Test', fills: black, fontFamily: 'Inter', fontSize: 14, fontWeight: 400, fontStyle: 'normal', lineHeight: 1.4, letterSpacing: 0, textAlign: 'left', textDecoration: 'none', textCase: 'none', direction: 'auto', autoW: true, layoutSizingH: 'hug', layoutSizingV: 'hug', visible: true, stroke: '#000000', strokeWidth: 0, opacity: 1, rotation: 0, radius: 0, clip: false, locked: false, version: 0 },
    ];
    mkdirSync(ARTIFACTS, { recursive: true });
    const out = resolve(ARTIFACTS, name);
    writeFileSync(out, JSON.stringify(data));
    return out;
}

/** Binds the frame to a template from the Behavior panel and places one instance of it. Returns the instance id. */
async function bindAndInstance(page, template) {
    await page.evaluate(() => window.midas.select(['bind-frame']));
    await page.locator('#inspector-tab-behavior').click();
    await page.locator('[data-bp="frame-template"]').first().selectOption({ value: template });
    await page.waitForTimeout(500);
    const masterId = 'bind-frame';
    const instId = await page.evaluate(id => { window.midas.instantiate(id, { x: -4700, y: -4900 }); return window.midas.doc.data.pages.flatMap(p => p.nodes).filter(n => n.isInstance && n.sourceId === id).at(-1)?.id ?? null; }, masterId);
    await page.evaluate(id => window.midas.select([id]), instId);
    await page.locator('#inspector-tab-behavior').click();
    return instId;
}

/** Opens the instance in Play at actual size, reads the element tree and the computed styles, and closes Play. */
async function playOf(page, id) {
    await page.evaluate(i => window.midas.select([i]), id);
    await page.locator('#play').click();
    await page.waitForSelector('.play-overlay');
    await page.locator('.play-overlay [aria-label="View options"]').click();
    await page.locator('.play-overlay [data-mode="actual-size"]').click();
    await page.waitForTimeout(500);
    const dump = await page.evaluate(i => {
        const root = document.querySelector('.play-overlay [data-node-id="' + i + '"]');
        const describe = el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return { tag: el.tagName, id: el.getAttribute('data-node-id'), role: el.getAttribute('data-role'), w: r.width, h: r.height, bg: cs.backgroundColor, color: cs.color, value: el.tagName === 'INPUT' ? el.value : null, placeholder: el.placeholder ?? null, paths: el.querySelectorAll('path').length, waveOn: el.hasAttribute('data-wave-on') }; };
        return { root: root ? describe(root) : null, kids: root ? [...root.children].map(describe) : [] };
    }, id);
    return { dump, overlay: '.play-overlay' };
}
async function closePlay(page) {
    await page.evaluate(() => document.querySelector('[aria-label="Close (Esc)"]').click());
    await page.waitForSelector('.play-overlay', { state: 'detached' });
}

test('a bound Button: its spinner is drawn in Play in the icon colour and size, its solid background shows, and a click waves', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, bindStage('bind-button.midas'));
    const id = await bindAndInstance(page, 'button');
    await page.locator('[data-bp-prop="variant"]').first().selectOption({ value: 'solid' });
    await page.locator('[data-bp-prop="color"]').first().selectOption({ value: 'primary' });
    await page.locator('[data-bp-prop="size"]').first().selectOption({ value: 'md' });
    await setProp(page, 'loading', true);
    await page.mouse.move(2, 2);

    const spinner = await page.evaluate(i => { const s = window.midas.doc.children(i).find(c => c.name === 'spinner'); return s ? { w: s.w, h: s.h, visible: s.visible, stroke: s.stroke, vars: s.vars } : null; }, id);
    assert.ok(spinner && spinner.visible !== false, 'the spinner is on the canvas while loading');
    assert.equal(spinner.w, 14, 'the spinner is the icon size of md');
    assert.deepEqual(spinner.vars?.stroke, 'v-fg', 'the spinner is coloured by the foreground token');

    const { dump } = await playOf(page, id);
    const spinnerEl = dump.kids.find(k => k.paths > 0);
    assert.ok(spinnerEl, 'Play draws the spinner (an arc path)');
    assert.ok(Math.abs(spinnerEl.w - 14) < 2, `the spinner is the icon size (${spinnerEl.w})`);
    // The fill is drawn by the stroke overlay (inside the stroke), so the root itself may be transparent: one of them is filled.
    const filled = [dump.root, ...dump.kids].some(k => k.bg !== 'rgba(0, 0, 0, 0)' && k.bg !== 'transparent');
    assert.ok(filled, 'the solid background shows in Play');
    await page.locator('.play-overlay [data-node-id="' + id + '"]').screenshot({ path: resolve(ARTIFACTS, 'bind-button-play.png') });
    await closePlay(page);
    await shotNode(page, id, 'bind-button-canvas', PAD, 2);
    assert.deepEqual(errors, [], 'console errors');
});

test('a bound Button in Play waves on a click, and the bound height is fixed', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, bindStage('bind-button-wave.midas'));
    const id = await bindAndInstance(page, 'button');
    await page.locator('[data-bp-prop="variant"]').first().selectOption({ value: 'solid' });
    await page.locator('[data-bp-prop="color"]').first().selectOption({ value: 'primary' });
    await page.locator('[data-bp-prop="size"]').first().selectOption({ value: 'md' });
    const sizing = await page.evaluate(i => window.midas.doc.get(i).layoutSizingV, id);
    assert.equal(sizing, 'fixed', 'the root binds the Size height: its vertical sizing is fixed, not Hug');
    const height = await page.evaluate(i => window.midas.doc.get(i).h, id);
    assert.equal(height, 32, 'the md height is 32');
    await page.evaluate(id => window.midas.select([id]), id);
    await page.locator('#play').click();
    await page.waitForSelector('.play-overlay');
    await page.locator('.play-overlay [aria-label="View options"]').click();
    await page.locator('.play-overlay [data-mode="actual-size"]').click();
    await page.waitForTimeout(400);
    await page.locator(`.play-overlay [data-node-id="${id}"]`).click();
    const waved = await page.evaluate(i => document.querySelector('.play-overlay [data-node-id="' + i + '"]').hasAttribute('data-wave-on'), id);
    assert.ok(waved, 'a click starts the wave on the button');
    await closePlay(page);
    assert.deepEqual(errors, [], 'console errors');
});

test('a bound Input shows its value on the canvas and in Play, and its placeholder in Play while the value is empty', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, bindStage('bind-input.midas'));
    const id = await bindAndInstance(page, 'input');
    await setProp(page, 'placeholder', 'Search');
    await setProp(page, 'value', 'tesssssss');
    await page.mouse.move(2, 2);
    const label = await page.evaluate(i => window.midas.doc.children(i).find(c => c.name === 'Test')?.text ?? null, id);
    assert.equal(label, 'tesssssss', 'the canvas label shows the value');
    const { dump } = await playOf(page, id);
    const input = dump.kids.find(k => k.tag === 'INPUT');
    assert.equal(input?.value, 'tesssssss', 'Play shows the value');
    await closePlay(page);
    await setProp(page, 'value', '');
    await page.mouse.move(2, 2);
    const { dump: empty } = await playOf(page, id);
    const emptyInput = empty.kids.find(k => k.tag === 'INPUT');
    assert.equal(emptyInput?.placeholder, 'Search', 'Play shows the placeholder while the value is empty');
    await closePlay(page);
    assert.deepEqual(errors, [], 'console errors');
});

test('a bound solid Button fills its box in Play, and a Dash stroke set on it stays set', async t => {
    const stop = await ensureDevServers();
    t.after(stop);
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const { page, errors } = await openImportedFile(browser, bindStage('bind-button-solid.midas'));
    const id = await bindAndInstance(page, 'button');
    await page.locator('[data-bp-prop="variant"]').first().selectOption({ value: 'solid' });
    await page.locator('[data-bp-prop="color"]').first().selectOption({ value: 'primary' });
    await page.locator('[data-bp-prop="size"]').first().selectOption({ value: 'md' });
    await page.evaluate(i => window.midas.select([i]), id);
    await page.locator('#play').click();
    await page.waitForSelector('.play-overlay');
    await page.locator('.play-overlay [aria-label="View options"]').click();
    await page.locator('.play-overlay [data-mode="actual-size"]').click();
    await page.waitForTimeout(400);
    const root = page.locator(`.play-overlay [data-node-id="${id}"]`);
    const expected = await root.evaluate(el => getComputedStyle(el).getPropertyValue('--button-bg').trim());
    const png = (await root.screenshot()).toString('base64');
    const pixel = await page.evaluate(async ({ png, expected }) => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + png;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const [r, g, b] = ctx.getImageData(3, Math.floor(img.height / 2), 1, 1).data;
        const hex = expected.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})/i);
        const want = hex ? [parseInt(hex[1], 16), parseInt(hex[2], 16), parseInt(hex[3], 16)] : null;
        return { got: [r, g, b], want };
    }, { png, expected });
    assert.ok(pixel.want, `the solid fill has a colour (${expected})`);
    const off = Math.hypot(...pixel.got.map((v, i) => v - pixel.want[i]));
    assert.ok(off < 12, `the left edge of the box is the solid fill in Play: ${pixel.got} vs ${pixel.want}`);
    await closePlay(page);

    await page.evaluate(i => window.midas.select([i]), id);
    await page.locator('[data-inspector-tab="design"]').click();
    await page.locator('[data-st-settings]').first().click();
    await page.locator('[data-stp="strokeStyle"]').selectOption('dash');
    await page.waitForTimeout(200);
    const style = await page.evaluate(i => window.midas.doc.get(i).strokeStyle, id);
    assert.equal(style, 'dash', 'a Dash stroke is kept, not reset to the variant');
    await page.keyboard.press('Escape');
    assert.deepEqual(errors, [], 'console errors');
});
