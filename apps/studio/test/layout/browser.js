// Runs in the harness page (Chromium). For one fixture it lays the tree out twice and returns each rendered node's box:
//   canvas: the editor's autolayout engine (engine/autolayout.js), positions made absolute by adding the parents' offsets
//   dom:    the same tree rendered as DOM with Preview's CSS mapping (preview/flexStyle.js), read with getBoundingClientRect
// Hidden layers are not rendered by either engine (Preview skips them, the canvas leaves them out of the flow), so they are skipped.
import { runLayout, displayText, fontSpec } from '/src/engine/autolayout.js';
import { nodeToStyle, layoutOrder } from '/src/preview/flexStyle.js';

const isShown = n => n.visible !== false;

/** Children of `id` in list order, hidden layers removed. Flow order is applied by the caller (layoutOrder). */
function shownKids(nodes, id) {
    return nodes.filter(n => n.parentId === id && isShown(n));
}

/** Text the way Preview shows it: the same font and line height the canvas measures with. */
function applyTextStyle(el, n) {
    el.textContent = displayText(n);
    el.style.font = fontSpec(n);
    el.style.lineHeight = `${(n.fontSize || 16) * (n.lineHeight || 1.35)}px`;
    el.style.letterSpacing = `${n.letterSpacing || 0}px`;
    el.style.margin = '0';
    el.style.whiteSpace = el.style.whiteSpace || 'pre-wrap';
}

function renderDom(nodes, n, parent, parentEl, elById) {
    n._pn = parent; // the parent's parent, as live copies carry it (resolvesHug walks it)
    const el = document.createElement('div');
    Object.assign(el.style, nodeToStyle(n, parent));
    if (n.type === 'text') applyTextStyle(el, n);
    parentEl.append(el);
    elById.set(n.id, el);
    for (const kid of layoutOrder(n, shownKids(nodes, n.id)))
        renderDom(nodes, kid, n, el, elById);
}

/** Absolute box of a canvas node: its x/y are relative to the parent. */
function canvasBox(byId, n) {
    let x = n.x, y = n.y;
    for (let p = byId.get(n.parentId); p; p = byId.get(p.parentId)) {
        x += p.x;
        y += p.y;
    }
    return { x, y, w: n.w, h: n.h };
}

export function measureFixture(fixture) {
    const nodes = JSON.parse(JSON.stringify(fixture.nodes));
    const byId = new Map(nodes.map(n => [n.id, n]));
    const hasKids = id => nodes.some(n => n.parentId === id);

    // Canvas: the engine mutates the copy in place.
    runLayout({ nodes, get: id => byId.get(id), touch() { } }, { hasKids });

    // DOM: Preview's mapping, rendered under a stage at 0,0 so client rects are absolute.
    const stage = document.createElement('div');
    stage.style.cssText = 'position:absolute;left:0;top:0;';
    document.body.replaceChildren(stage);
    const elById = new Map();
    // Preview gets its own untouched copy: the engine above wrote canvas sizes into `nodes`, and a fixed child must not read them back.
    const domNodes = JSON.parse(JSON.stringify(fixture.nodes));
    const root = domNodes.find(n => n.parentId == null);
    renderDom(domNodes, root, null, stage, elById);
    const origin = stage.getBoundingClientRect();

    const out = {};
    for (const n of nodes) {
        if (!isShown(n)) continue;
        const hiddenAncestor = (() => { for (let p = n; p; p = byId.get(p.parentId)) if (!isShown(p)) return true; return false; })();
        if (hiddenAncestor) continue;
        const r = elById.get(n.id)?.getBoundingClientRect();
        if (!r) continue;
        out[n.id] = {
            type: n.type,
            canvas: canvasBox(byId, n),
            dom: { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height },
        };
    }
    return out;
}

/** Canvas layout of every page of a document served at `url`: page id -> node id -> [x, y, w, h]. Used by rects.mjs. */
export async function layoutDocument(url) {
    const doc = await (await fetch(url)).json();
    const out = {};
    for (const page of doc.pages) {
        const nodes = JSON.parse(JSON.stringify(page.nodes));
        const byId = new Map(nodes.map(n => [n.id, n]));
        runLayout({ nodes, get: id => byId.get(id), touch() { } }, { hasKids: id => nodes.some(n => n.parentId === id) });
        out[page.id] = Object.fromEntries(nodes.map(n => [n.id, [n.x, n.y, n.w, n.h]]));
    }
    return out;
}

window.measureFixture = measureFixture;
window.layoutDocument = layoutDocument;
window.harnessReady = true;
