// Visual check of canvas layout changes on a real document: for each page, renders the area where the most nodes moved,
// before and after, and a diff image. A schematic render of the geometry (fills, strokes, text), not the editor's own renderer.
// Usage: node test/layout/visual.mjs <file.midas> <before.json> <after.json> <outDir> [pageName ...]   (from apps/studio)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright';

const [, , docPath, beforePath, afterPath, outDir, ...only] = process.argv;
const doc = JSON.parse(readFileSync(resolve(docPath), 'utf8'));
const before = JSON.parse(readFileSync(resolve(beforePath), 'utf8'));
const after = JSON.parse(readFileSync(resolve(afterPath), 'utf8'));
const MAX = 1600, TOP = 60, PAD = 40;

/** Absolute box of every node of a page: a node's rect is relative to its parent. */
function absoluteBoxes(page, rects) {
    const byId = new Map(page.nodes.map(n => [n.id, n]));
    const boxes = new Map();
    const boxOf = id => {
        if (boxes.has(id)) return boxes.get(id);
        const n = byId.get(id), r = rects[id];
        const p = n.parentId && byId.get(n.parentId) ? boxOf(n.parentId) : { x: 0, y: 0 };
        const b = { x: p.x + r[0], y: p.y + r[1], w: r[2], h: r[3] };
        boxes.set(id, b);
        return b;
    };
    for (const n of page.nodes) if (rects[n.id]) boxOf(n.id);
    return boxes;
}

function depthOf(page) {
    const byId = new Map(page.nodes.map(n => [n.id, n]));
    const d = new Map();
    const depth = id => {
        if (d.has(id)) return d.get(id);
        const p = byId.get(id)?.parentId;
        const v = p && byId.has(p) ? depth(p) + 1 : 0;
        d.set(id, v);
        return v;
    };
    for (const n of page.nodes) depth(n.id);
    return d;
}

function paintOf(n) {
    const solid = (n.fills || []).find(f => f.visible !== false && (f.type || 'solid') === 'solid');
    if (n.fills && !solid) return null;
    const color = solid?.color ?? (n.fillType && n.fillType !== 'solid' ? null : n.fill);
    return color ? `${color}` : null;
}

function html(page, boxes, rects, region, depth) {
    const inside = b => b.x < region.x + region.w && b.x + b.w > region.x && b.y < region.y + region.h && b.y + b.h > region.y;
    const nodes = page.nodes
        .filter(n => n.visible !== false && n.type !== 'group' && rects[n.id] && inside(boxes.get(n.id)))
        .sort((a, b) => depth.get(a.id) - depth.get(b.id));
    const parts = nodes.map(n => {
        const b = boxes.get(n.id);
        const css = [`left:${b.x - region.x}px`, `top:${b.y - region.y}px`, `width:${b.w}px`, `height:${b.h}px`];
        if (n.opacity != null) css.push(`opacity:${n.opacity}`);
        if (n.type === 'text') {
            css.push(`font:${n.fontStyle || 'normal'} ${n.fontWeight || 400} ${n.fontSize || 16}px ${n.fontFamily === 'Inter' ? 'Inter, Arial, sans-serif' : `'${String(n.fontFamily || 'Arial').replace(/['"]/g, '')}', sans-serif`}`);
            css.push(`line-height:${(n.fontSize || 16) * (n.lineHeight || 1.35)}px`, `color:${n.fill || '#000'}`, n.autoW ? 'white-space:nowrap' : 'white-space:pre-wrap;overflow-wrap:anywhere', 'margin:0');
            return `<div style="${css.join(';')}">${String(n.text || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])}</div>`;
        }
        const bg = paintOf(n);
        if (bg) css.push(`background:${bg}`);
        if (n.strokeWidth > 0 && n.stroke && n.stroke !== 'none' && n.strokeVisible !== false) css.push(`box-sizing:border-box`, `border:${n.strokeWidth}px solid ${n.stroke}`);
        if (n.radius) css.push(`border-radius:${n.radius}px`);
        return `<div style="${css.join(';')}"></div>`;
    });
    return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#fff}body{position:relative;width:${region.w}px;height:${region.h}px;overflow:hidden}div{position:absolute;box-sizing:border-box}</style></head><body>${parts.join('')}</body></html>`;
}

const names = Object.fromEntries(doc.pages.map(p => [p.id, p.name]));
mkdirSync(resolve(outDir), { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const report = [];
    for (const p of doc.pages) {
        if (only.length && !only.includes(p.name)) continue;
        const bB = absoluteBoxes(p, before[p.id]), bA = absoluteBoxes(p, after[p.id]);
        const moved = [];
        for (const n of p.nodes) {
            const d = Math.max(...before[p.id][n.id].map((v, i) => Math.abs(v - after[p.id][n.id][i])));
            if (d > 0.5) moved.push({ id: n.id, d, box: bA.get(n.id) });
        }
        if (!moved.length) continue;
        moved.sort((a, b) => b.d - a.d);
        const top = moved.slice(0, TOP);
        let x0 = Math.min(...top.map(m => m.box.x)) - PAD, y0 = Math.min(...top.map(m => m.box.y)) - PAD;
        let x1 = Math.max(...top.map(m => m.box.x + m.box.w)) + PAD, y1 = Math.max(...top.map(m => m.box.y + m.box.h)) + PAD;
        if (x1 - x0 > MAX || y1 - y0 > MAX) {
            const c = top[0].box; // too big for one shot: centre on the node that moved most
            x0 = c.x + c.w / 2 - MAX / 2; y0 = c.y + c.h / 2 - MAX / 2; x1 = x0 + MAX; y1 = y0 + MAX;
        }
        const region = { x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0) };
        const depth = depthOf(p);
        const name = (names[p.id] || p.id).replace(/[^\w-]+/g, '_');
        await page.setViewportSize({ width: region.w, height: region.h });
        const shot = async (rects, boxes) => {
            await page.setContent(html(p, boxes, rects, region, depth));
            return page.screenshot({ type: 'png' });
        };
        const pngB = await shot(before[p.id], bB), pngA = await shot(after[p.id], bA);
        const diffUrl = await page.evaluate(async ([a, b]) => {
            const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; });
            const [ia, ib] = await Promise.all([load(a), load(b)]);
            const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height;
            const ctx = c.getContext('2d');
            ctx.drawImage(ib, 0, 0);
            const pb = ctx.getImageData(0, 0, c.width, c.height);
            ctx.drawImage(ia, 0, 0);
            const pa = ctx.getImageData(0, 0, c.width, c.height);
            let changed = 0;
            for (let i = 0; i < pa.data.length; i += 4) {
                const diff = Math.abs(pa.data[i] - pb.data[i]) + Math.abs(pa.data[i + 1] - pb.data[i + 1]) + Math.abs(pa.data[i + 2] - pb.data[i + 2]);
                if (diff > 0) {
                    changed++;
                    pa.data[i] = 255; pa.data[i + 1] = 0; pa.data[i + 2] = 0;
                } else {
                    const g = (pa.data[i] + pa.data[i + 1] + pa.data[i + 2]) / 3 * 0.3 + 178;
                    pa.data[i] = pa.data[i + 1] = pa.data[i + 2] = g;
                }
            }
            ctx.putImageData(pa, 0, 0);
            return { url: c.toDataURL('image/png'), changed, total: pa.data.length / 4 };
        }, [`data:image/png;base64,${pngA.toString('base64')}`, `data:image/png;base64,${pngB.toString('base64')}`]);
        const files = {
            before: join(resolve(outDir), `${name}-before.png`),
            after: join(resolve(outDir), `${name}-after.png`),
            diff: join(resolve(outDir), `${name}-diff.png`),
        };
        writeFileSync(files.before, pngB);
        writeFileSync(files.after, pngA);
        writeFileSync(files.diff, Buffer.from(diffUrl.url.split(',')[1], 'base64'));
        report.push({ page: names[p.id], movedNodes: moved.length, region, changedPixels: diffUrl.changed, ...files });
    }
    console.log(JSON.stringify(report, null, 2));
} finally {
    await browser.close();
}
