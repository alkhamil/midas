// Shared pieces of the browser parity tests: the isolated stage the components are made on, the Components panel create, the Behavior
// tab's props, the canvas and Play measurements, and the comparison of the two. Used by strict-parity and export-parity.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ARTIFACTS, ROOT, edgeCheck, integerClip, pixelDiff, settle, shotNode } from './harness.mjs';

export const FIXTURE = resolve(ROOT, 'testing.midas');
// The pair crops: the root's box plus this padding, the same in both shots. Both are taken at zoom 1 (one document unit per CSS pixel).
export const PAD = 8;
// The gates: a layer's box, the outline and the root width, in CSS pixels. The pixel share is recorded under a loose ceiling.
export const TOLERANCE_PX = 0.5;
export const ROOT_WIDTH_TOLERANCE_PX = 0.1;
export const DIFF_LIMIT = 0.08;

/**
 * The testing file with its stage moved to an isolated page: the Testing page keeps one empty frame far from the canvas's centre, so
 * the components made for the test sit on nothing else. Returns the path of the written file.
 */
export function isolatedStage({ icons = true, name = 'strict-parity.midas' } = {}) {
    const data = JSON.parse(readFileSync(FIXTURE, 'utf8'));
    // Without the icon library, the Components page keeps no Icon/ component (nor anything inside one).
    if (!icons) {
        const components = data.pages.find(p => p.name === 'Components');
        const iconIds = new Set(components.nodes.filter(n => n.name.startsWith('Icon/')).map(n => n.id));
        components.nodes = components.nodes.filter(n => !iconIds.has(n.id) && !iconIds.has(n.parentId));
    }
    for (const page of data.pages) {
        if (page.name !== 'Testing') continue;
        const stage = page.nodes.find(n => n.parentId == null && n.type === 'frame');
        page.nodes = [{ ...stage, id: 'strict-stage', name: 'Stage', x: -5000, y: -5000, w: 100, h: 100, clip: true, component: false, isInstance: false, sourceId: undefined, parentId: null, layout: 'none', behavior: undefined, vars: undefined, varModes: undefined }];
        data.pageId = page.id;
    }
    mkdirSync(ARTIFACTS, { recursive: true });
    const file = resolve(ARTIFACTS, name);
    writeFileSync(file, JSON.stringify(data));
    return file;
}

/**
 * Builds the template components with the Assets tab's one button (Generate Design System: every registered template on the Design System page, each with a
 * demo instance) the first time, then selects the demo instance of `templateId`. A second call finds the page built and only selects.
 */
export async function createFromPanel(page, templateId) {
    await page.getByRole('button', { name: 'Components' }).first().click();
    await settle(page, 4);
    const built = await page.evaluate(() => window.midas.doc.data.pages.some(p => p.name === 'Design System'));
    if (!built) {
        await page.locator('[data-generate-design-system]').click();
        await page.waitForFunction(() => window.midas.doc.page?.name === 'Design System', null, { timeout: 30000 });
        await settle(page, 8);
    }
    return page.evaluate(templateId => {
        const nodes = window.midas.doc.data.pages.find(p => p.name === 'Design System').nodes;
        const master = nodes.find(n => n.component && n.behavior?.templateId === templateId);
        const instance = nodes.find(n => n.isInstance && n.sourceId === master.id);
        window.midas.select([instance.id]);
        return instance.id;
    }, templateId);
}

/** Sets a prop in the Behavior tab: a checkbox for a boolean, a text field for the value. */
export async function setProp(page, name, value) {
    await page.locator('#inspector-tab-behavior').click();
    const field = page.locator(`[data-bp-prop="${name}"]`).first();
    if (typeof value === 'boolean') {
        if (value) await field.check({ force: true });
        else await field.uncheck({ force: true });
    }
    else if (value === null) {
        // A user clears a number field by selecting its text and pressing Delete, then Enter.
        await field.focus();
        await field.evaluate(el => el.select());
        await page.keyboard.press('Delete');
        await page.keyboard.press('Enter');
    }
    else {
        await field.fill(String(value));
        await field.press('Enter');
    }
    await settle(page, 4);
}

/** Every node of an instance, its root first, with the canvas box relative to the root and whether it is shown. */
export const canvasTree = (page, rootId) => page.evaluate(rootId => {
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

/**
 * Opens Play on the instance (selected), measures its elements relative to its root, saves a screenshot of the root's Play element to
 * `name`, and closes Play. Animations are read at rest.
 */
export async function playTree(page, rootId, name, clipSize = null) {
    await page.evaluate(id => window.midas.select([id]), rootId);
    await page.locator('#play').click();
    await page.waitForSelector('.play-overlay');
    // Actual size (1:1), so Play and the canvas are the same scale. The default fits the window. The viewport is white: Play's default
    // dark background would hide a dark stroke, and the pixels compared are the component's own box.
    await page.locator('.play-overlay [aria-label="View options"]').click();
    await page.locator('.play-overlay [data-background]').evaluate(el => {
        el.value = '#ffffff';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.locator('.play-overlay [data-mode="actual-size"]').click();
    // The stage is laid out at scale 1 (no transform) before anything is measured; the frames after it let the layout and the first paint settle.
    await page.waitForFunction(() => { const s = document.querySelector('.play-overlay .play-stage'); return !!s && (s.style.transform === '' || s.style.transform === 'none'); });
    await settle(page, 6);
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
    if (measured) {
        // A component far down the Design System page (the Divider is made last) is scrolled to before its shot.
        await page.locator(`.play-overlay [data-node-id="${rootId}"]`).scrollIntoViewIfNeeded();
        const r = await page.locator(`.play-overlay [data-node-id="${rootId}"]`).boundingBox();
        await page.screenshot({ path: resolve(ARTIFACTS, `${name}-play.png`), clip: { ...integerClip({ x: r.x, y: r.y, w: r.width, h: r.height }, PAD), ...(clipSize ? { width: clipSize.width, height: clipSize.height } : {}) } });
    }
    await page.locator('[aria-label="Close (Esc)"]').click();
    await page.waitForSelector('.play-overlay', { state: 'detached' });
    return measured;
}

/** One row of the report: the canvas tree against the Play tree at one Size mode and state. */
export function compare(canvas, play) {
    // Play is at actual size, so one document unit is one CSS pixel: no scale to fit either box to the other.
    const scale = 1;
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


/**
 * Measures one pair at the state the components are in: the canvas shot and the Play shot at the same crop, the geometry of every shown
 * layer, the outline on each side, the root width and the pixel share. Returns the measurements and the gate failures (empty when the
 * pair passes); the pair images are written under the pair name.
 */
/**
 * The canvas-shot rects (device px) of the empty content slots: the canvas draws each as an editor placeholder, which Play does not draw. The rects
 * are for the pixel diff only; the geometry rows still compare each slot's box. Two device px of margin cover a fractional clip origin.
 */
async function placeholderRects(page, rootId, pad) {
    return page.evaluate(([rootId, pad]) => {
        const dpr = window.devicePixelRatio || 1;
        const root = window.midas.doc.world(rootId).box;
        const out = [];
        const walk = id => {
            for (const c of window.midas.doc.children(id)) {
                if (c.propBind?.slot && window.midas.doc.children(c.id).length === 0) {
                    const b = window.midas.doc.world(c.id).box;
                    out.push({ x: Math.floor((pad + b.x - root.x) * dpr) - 2, y: Math.floor((pad + b.y - root.y) * dpr) - 2, w: Math.ceil(b.w * dpr) + 4, h: Math.ceil(b.h * dpr) + 4 });
                }
                walk(c.id);
            }
        };
        walk(rootId);
        return out;
    }, [rootId, pad]);
}

export async function measurePair(page, browser, id, label, pair, { outline = true } = {}) {
    await page.evaluate(() => window.midas.select([]));
    await page.mouse.move(2, 2);
    await settle(page, 3);
    const canvasShot = await shotNode(page, id, pair + '-canvas', PAD, 1);
    const canvas = await canvasTree(page, id);
    // The canvas sets the crop size: both shots are the same size, so a width that rounds across a whole pixel cannot differ between them.
    const play = await playTree(page, id, pair, { width: canvasShot.clip.width, height: canvasShot.clip.height });
    if (!play) return { failures: [label + ': Play draws no component'] };
    const { rows, unmapped } = compare(canvas, play);
    const ignore = await placeholderRects(page, id, PAD);
    const diff = await pixelDiff(browser, resolve(ARTIFACTS, pair + '-canvas.png'), resolve(ARTIFACTS, pair + '-play.png'), resolve(ARTIFACTS, pair + '-diff.png'), { inset: PAD * 2, tolerance: 24, ignore });
    const edges = outline ? await edgeCheck(browser, resolve(ARTIFACTS, pair + '-canvas.png'), resolve(ARTIFACTS, pair + '-play.png'), { inset: PAD * 2 }) : { found: true, delta: 0 };
    const failures = [];
    if (outline && !edges.found) failures.push(label + ': the outline is not found on both shots');
    else if (outline && edges.delta > TOLERANCE_PX) failures.push(label + ': the outline differs by ' + edges.delta.toFixed(2) + ' px (width, height or centre)');
    const rootRow = rows[0];
    if (Math.abs(rootRow.canvas.w - rootRow.play.w) > ROOT_WIDTH_TOLERANCE_PX) failures.push(label + ': root width ' + rootRow.canvas.w.toFixed(4) + ' on the canvas, ' + rootRow.play.w.toFixed(4) + ' in Play');
    if (diff.sizeA.join() !== diff.sizeB.join()) failures.push(label + ': canvas and Play crops differ in size');
    else if (diff.changed / diff.pixels > DIFF_LIMIT) failures.push(label + ': ' + (100 * diff.changed / diff.pixels).toFixed(1) + '% of pixels differ');
    for (const row of rows) {
        if (row.missing) failures.push(label + ': ' + row.name + ' is on the canvas but not in Play');
        else if (row.delta > TOLERANCE_PX) failures.push(label + ': ' + row.name + ' differs by ' + row.delta + 'px');
    }
    for (const u of unmapped) failures.push(label + ': Play draws ' + u + ' with no node');
    return { rows, unmapped, diff, edges, failures };
}
