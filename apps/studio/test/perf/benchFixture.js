// Benchmark document: about 5,000 layers (nested frames, auto layout, text, rectangles, ellipses) for the selection benchmark.
// Deterministic: the same seed gives the same file. Written as a .midas document (the format the editor opens).
import { seeded } from '../fixtures/layoutFixtures.js';

const NODE_DEFAULTS = {
    rotation: 0, fillType: 'solid', fill2: '#ffffff', gradientAngle: 90, fillOpacity: 1, stroke: 'none', strokeWidth: 0,
    radius: 0, opacity: 1, visible: true, locked: false, clip: false, shadow: false, shadowColor: '#000000', shadowOpacity: .16,
    shadowBlur: 20, shadowX: 0, shadowY: 6, version: 0, fills: [], strokeAlign: 'center',
};

/** A node with the fields the editor expects, the rest from NODE_DEFAULTS. */
function node(props) {
    const n = { ...NODE_DEFAULTS, x: 0, y: 0, w: 100, h: 40, parentId: null, fill: '#e6e8ec', ...props };
    if (!n.name) n.name = `${n.type} ${n.id}`;
    return n;
}

/**
 * `boards` board frames of about 49 layers each (102 boards = about 5,000 layers), laid out on a grid of 8 columns.
 * Each board: a vertical auto layout with six rows; each row is a horizontal auto layout holding a label, a rectangle, an
 * ellipse, and a nested vertical auto layout with two labels and a rectangle. Nested frames are 3 levels deep.
 */
export function benchDocument({ boards = 102, seed = 20260601 } = {}) {
    const rnd = seeded(seed);
    const pick = list => list[Math.floor(rnd() * list.length)];
    const nodes = [];
    let id = 0;
    const next = (prefix) => `${prefix}-${(++id).toString(36)}`;
    const add = n => { nodes.push(n); return n.id; };
    const label = (parent, text) => add(node({
        id: next('t'), type: 'text', parentId: parent, text, fontFamily: 'Inter', fontStyle: 'normal', letterSpacing: 0,
        textAlign: 'left', textDecoration: 'none', textCase: 'none', direction: 'ltr', fontSize: 14, fontWeight: 500,
        lineHeight: 1.35, autoW: true, layoutSizingH: 'hug', layoutSizingV: 'hug', fill: '#1f2329', w: 60 + Math.round(rnd() * 40), h: 19,
    }));

    for (let b = 0; b < boards; b++) {
        const col = b % 8, row = Math.floor(b / 8);
        const boardId = add(node({
            id: next('board'), type: 'frame', name: `Board ${b + 1}`, x: col * 320, y: row * 360, w: 280, h: 320, fill: '#ffffff',
            stroke: '#d9d9d9', strokeWidth: 1, radius: 8, clip: true, layout: 'vertical', gap: 8, padding: 12, primaryAlign: 'start',
            counterAlign: 'start', layoutSizingH: 'fixed', layoutSizingV: 'fixed',
        }));
        for (let r = 0; r < 6; r++) {
            const rowId = add(node({
                id: next('row'), type: 'frame', parentId: boardId, name: `Row ${r + 1}`, w: 256, h: 40, fill: '#f5f7fa', radius: 6,
                layout: 'horizontal', gap: 8, padding: 6, primaryAlign: 'start', counterAlign: 'center',
                layoutSizingH: 'fill', layoutSizingV: 'hug',
            }));
            label(rowId, `Item ${b + 1}.${r + 1}`);
            add(node({ id: next('r'), type: 'rect', parentId: rowId, w: 40, h: 24, fill: pick(['#1677ff', '#52c41a', '#fa8c16', '#eb2f96']), radius: 4, layoutSizingH: 'fixed', layoutSizingV: 'fixed' }));
            add(node({ id: next('e'), type: 'ellipse', parentId: rowId, w: 18, h: 18, fill: '#722ed1', layoutSizingH: 'fixed', layoutSizingV: 'fixed' }));
            const inner = add(node({
                id: next('stack'), type: 'frame', parentId: rowId, name: `Stack ${r + 1}`, w: 120, h: 30, fill: '#ffffff', layout: 'vertical',
                gap: 2, padding: 2, layoutSizingH: 'hug', layoutSizingV: 'hug',
            }));
            label(inner, 'Primary');
            label(inner, 'Secondary');
            add(node({ id: next('r'), type: 'rect', parentId: inner, w: 100, h: 4, fill: '#bfbfbf', radius: 2, layoutSizingH: 'fill', layoutSizingV: 'fixed' }));
        }
    }
    // a few top-level frames and labels so the page has more than one root kind
    add(node({ id: next('frame'), type: 'frame', name: 'Legend', x: 0, y: boards / 8 * 360 + 40, w: 200, h: 40, fill: '#fafafa', layout: 'none' }));
    return {
        format: 'midas',
        version: 1,
        name: `Benchmark ${nodes.length} layers`,
        pageId: 'page-bench',
        pages: [{ id: 'page-bench', name: 'Bench', nodes, parentId: null }],
        tokens: { colors: [], typography: [] },
        variables: [],
        guideStyles: [],
        created: 1792905282842,
        assets: {},
    };
}

// CLI: node test/perf/benchFixture.js <out.midas> [boards]
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('benchFixture.js')) {
    const { writeFileSync } = await import('node:fs');
    const out = process.argv[2];
    const boards = process.argv[3] ? +process.argv[3] : 102;
    if (!out) { console.error('usage: node test/perf/benchFixture.js <out.midas> [boards]'); process.exit(1); }
    const doc = benchDocument({ boards });
    writeFileSync(out, JSON.stringify(doc));
    console.log(`${doc.pages[0].nodes.length} layers -> ${out}`);
}
