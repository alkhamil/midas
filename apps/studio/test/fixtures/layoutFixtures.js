// Layout conformance fixtures: small node trees (the editor's document shape, flat list with parentId) for the canvas
// autolayout engine and the Preview CSS mapping. Deterministic: the random cases come from a seeded generator, so the
// same file always produces the same trees. Run through test/layout/conformance.mjs (npm run test:layout).

/** mulberry32: a small seeded PRNG. Same seed, same sequence, on every machine. */
export function seeded(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const frame = (id, parentId, props = {}) => ({ id, type: 'frame', parentId, x: 0, y: 0, w: 100, h: 100, layout: 'none', ...props });
const rect = (id, parentId, w, h, props = {}) => ({ id, type: 'rect', parentId, x: 0, y: 0, w, h, ...props });
const text = (id, parentId, value, props = {}) => ({
    id, type: 'text', parentId, x: 0, y: 0, w: 100, h: 20, text: value,
    fontSize: 16, fontWeight: 400, fontFamily: 'Arial', lineHeight: 1.35, autoW: false, ...props,
});

/** Root frame: always at 0,0 and Fixed unless the case says otherwise. */
const root = props => frame('root', null, { w: 400, h: 300, ...props });

const CASES = [
    // --- sizing: fixed / fill / hug on each axis ---
    { name: 'fixed-horizontal', group: 'sizing', nodes: [
        root({ layout: 'horizontal', gap: 10, padding: 8 }),
        rect('a', 'root', 100, 40), rect('b', 'root', 60, 30), rect('c', 'root', 80, 50),
    ] },
    { name: 'fill-horizontal', group: 'sizing', nodes: [
        root({ layout: 'horizontal', gap: 10, padding: 8, w: 400, h: 100 }),
        rect('a', 'root', 0, 40, { layoutSizingH: 'fill' }), rect('b', 'root', 0, 40, { layoutSizingH: 'fill' }),
        rect('c', 'root', 50, 40),
    ] },
    { name: 'fill-vertical', group: 'sizing', nodes: [
        root({ layout: 'vertical', gap: 10, padding: 8, w: 200, h: 300 }),
        rect('a', 'root', 60, 0, { layoutSizingV: 'fill' }), rect('b', 'root', 60, 50),
    ] },
    { name: 'fill-cross-axis', group: 'sizing', nodes: [
        root({ layout: 'horizontal', gap: 10, padding: 8, w: 300, h: 120 }),
        rect('a', 'root', 60, 20, { layoutSizingV: 'fill' }), rect('b', 'root', 60, 80),
    ] },
    { name: 'hug-root-horizontal', group: 'sizing', nodes: [
        root({ layout: 'horizontal', gap: 8, padding: 12, layoutSizingH: 'hug', layoutSizingV: 'hug', w: 1, h: 1 }),
        rect('a', 'root', 50, 30), rect('b', 'root', 70, 20),
    ] },
    { name: 'hug-inside-fill', group: 'sizing', nodes: [
        root({ layout: 'horizontal', gap: 10, padding: 8, w: 400, h: 200 }),
        frame('inner', 'root', { layout: 'horizontal', gap: 6, padding: 4, layoutSizingH: 'fill', layoutSizingV: 'hug', w: 50, h: 20 }),
        rect('a', 'inner', 40, 24), rect('b', 'inner', 30, 16),
        rect('c', 'root', 40, 40),
    ] },
    { name: 'fill-inside-hug', group: 'sizing', nodes: [
        root({ layout: 'vertical', gap: 8, padding: 10, layoutSizingH: 'hug', layoutSizingV: 'hug', w: 1, h: 1 }),
        rect('a', 'root', 120, 20, { layoutSizingH: 'fill' }), rect('b', 'root', 80, 30),
    ] },
    // Several Fill siblings clamped by min / max: each clamp hands its unused share to the rest, until nothing is clamped.
    { name: 'fill-minmax-redistribute', group: 'sizing', nodes: [
        root({ layout: 'horizontal', gap: 10, padding: 8, w: 400, h: 60 }),
        rect('a', 'root', 0, 30, { layoutSizingH: 'fill', maxW: 60 }),
        rect('b', 'root', 0, 30, { layoutSizingH: 'fill', minW: 150 }),
        rect('c', 'root', 0, 30, { layoutSizingH: 'fill' }),
        rect('d', 'root', 0, 30, { layoutSizingH: 'fill', maxW: 40 }),
    ] },
    { name: 'hug-frame-min-max', group: 'sizing', nodes: [
        root({ layout: 'horizontal', gap: 10, padding: 8, w: 400, h: 100 }),
        rect('a', 'root', 0, 30, { layoutSizingH: 'fill', minW: 90, maxW: 140 }),
        rect('b', 'root', 0, 30, { layoutSizingH: 'fill', minW: 20 }),
    ] },

    // --- spacing and alignment ---
    { name: 'gap-padding-per-side', group: 'spacing', nodes: [
        root({ layout: 'vertical', gap: 12, padT: 4, padR: 8, padB: 12, padL: 16, w: 200, h: 200 }),
        rect('a', 'root', 50, 20), rect('b', 'root', 50, 20), rect('c', 'root', 50, 20),
    ] },
    { name: 'primary-align-center', group: 'alignment', nodes: [
        root({ layout: 'horizontal', gap: 10, padding: 8, primaryAlign: 'center', w: 300, h: 80 }),
        rect('a', 'root', 60, 20), rect('b', 'root', 60, 20),
    ] },
    { name: 'primary-align-end', group: 'alignment', nodes: [
        root({ layout: 'horizontal', gap: 10, padding: 8, primaryAlign: 'end', w: 300, h: 80 }),
        rect('a', 'root', 60, 20), rect('b', 'root', 60, 20),
    ] },
    { name: 'counter-align-center', group: 'alignment', nodes: [
        root({ layout: 'horizontal', gap: 10, padding: 8, counterAlign: 'center', w: 300, h: 120 }),
        rect('a', 'root', 60, 20), rect('b', 'root', 60, 60),
    ] },
    { name: 'counter-align-end', group: 'alignment', nodes: [
        root({ layout: 'horizontal', gap: 10, padding: 8, counterAlign: 'end', w: 300, h: 120 }),
        rect('a', 'root', 60, 20), rect('b', 'root', 60, 60),
    ] },
    { name: 'space-between', group: 'alignment', nodes: [
        root({ layout: 'horizontal', padding: 8, gapAuto: true, gapMode: 'between', w: 300, h: 60 }),
        rect('a', 'root', 40, 20), rect('b', 'root', 40, 20), rect('c', 'root', 40, 20),
    ] },
    { name: 'space-evenly', group: 'alignment', nodes: [
        root({ layout: 'horizontal', padding: 8, gapAuto: true, gapMode: 'evenly', w: 300, h: 60 }),
        rect('a', 'root', 40, 20), rect('b', 'root', 40, 20), rect('c', 'root', 40, 20),
    ] },
    { name: 'space-around', group: 'alignment', nodes: [
        root({ layout: 'horizontal', padding: 8, gapAuto: true, gapMode: 'around', w: 300, h: 60 }),
        rect('a', 'root', 40, 20), rect('b', 'root', 40, 20), rect('c', 'root', 40, 20),
    ] },

    // --- wrap ---
    { name: 'wrap-horizontal', group: 'wrap', nodes: [
        root({ layout: 'horizontal', layoutWrap: true, gap: 10, gapCross: 14, padding: 8, w: 200, h: 200 }),
        rect('a', 'root', 80, 30), rect('b', 'root', 80, 40), rect('c', 'root', 80, 20), rect('d', 'root', 50, 20),
    ] },

    // --- grid ---
    { name: 'grid-fixed-tracks', group: 'grid', nodes: [
        root({ layout: 'grid', gridCols: 3, gap: 8, padding: 8, w: 400, h: 300 }),
        rect('a', 'root', 60, 30), rect('b', 'root', 90, 20), rect('c', 'root', 40, 40),
        rect('d', 'root', 50, 25), rect('e', 'root', 70, 35),
    ] },
    { name: 'grid-fill-cells', group: 'grid', nodes: [
        root({ layout: 'grid', gridCols: 2, gap: 8, padding: 8, w: 300, h: 200 }),
        rect('a', 'root', 0, 30, { layoutSizingH: 'fill' }), rect('b', 'root', 0, 30, { layoutSizingH: 'fill' }),
        rect('c', 'root', 60, 30), rect('d', 'root', 60, 30),
    ] },

    // --- grid tracks: fixed (px), fill (1fr), hug (largest child) ---
    { name: 'grid-mixed-columns', group: 'grid', nodes: [
        root({ layout: 'grid', gridCols: 3, gridColumns: [120, 'fill', 'hug'], gap: 8, padding: 8, w: 400, h: 200 }),
        rect('a', 'root', 40, 20), rect('b', 'root', 0, 30, { layoutSizingH: 'fill' }), rect('c', 'root', 60, 30),
        rect('d', 'root', 30, 25), rect('e', 'root', 0, 35, { layoutSizingH: 'fill' }), rect('f', 'root', 50, 20),
    ] },
    { name: 'grid-fill-rows', group: 'grid', nodes: [
        root({ layout: 'grid', gridCols: 2, gridRows: ['fill', 40], gap: 6, padding: 8, w: 300, h: 220 }),
        rect('a', 'root', 60, 0, { layoutSizingV: 'fill' }), rect('b', 'root', 70, 0, { layoutSizingV: 'fill' }),
        rect('c', 'root', 60, 30), rect('d', 'root', 40, 25),
    ] },
    { name: 'grid-gap-padding-tracks', group: 'grid', nodes: [
        root({ layout: 'grid', gridCols: 2, gridColumns: [60, 'fill'], gridRows: [30, 'fill'], gap: 10, gapCross: 14, padT: 4, padR: 8, padB: 12, padL: 16, w: 300, h: 200 }),
        rect('a', 'root', 40, 20), rect('b', 'root', 0, 20, { layoutSizingH: 'fill' }),
        rect('c', 'root', 50, 0, { layoutSizingV: 'fill' }), rect('d', 'root', 0, 0, { layoutSizingH: 'fill', layoutSizingV: 'fill' }),
    ] },
    { name: 'grid-hug-parent', group: 'grid', nodes: [
        root({ layout: 'grid', gridCols: 2, gap: 6, padding: 8, layoutSizingH: 'hug', layoutSizingV: 'hug', w: 1, h: 1 }),
        rect('a', 'root', 50, 30), rect('b', 'root', 20, 40), rect('c', 'root', 70, 10),
    ] },
    // --- absolute children, hidden children ---
    { name: 'absolute-child-in-auto', group: 'positioning', nodes: [
        root({ layout: 'horizontal', gap: 10, padding: 8, w: 300, h: 120 }),
        rect('a', 'root', 60, 30), rect('b', 'root', 60, 30),
        rect('abs', 'root', 40, 40, { layoutPositioning: 'absolute', x: 150, y: 60 }),
        rect('c', 'root', 60, 30),
    ] },
    { name: 'hidden-child-takes-no-gap', group: 'positioning', nodes: [
        root({ layout: 'horizontal', gap: 10, padding: 8, w: 300, h: 80 }),
        rect('a', 'root', 60, 30), rect('gone', 'root', 60, 30, { visible: false }), rect('b', 'root', 60, 30),
    ] },
    { name: 'hidden-child-fill-share', group: 'positioning', nodes: [
        root({ layout: 'vertical', gap: 10, padding: 8, w: 200, h: 200 }),
        rect('a', 'root', 60, 0, { layoutSizingV: 'fill' }), rect('gone', 'root', 60, 90, { visible: false }), rect('b', 'root', 60, 50),
    ] },

    // --- text: hug width and height, fill with wrap ---
    { name: 'text-hug-width-horizontal', group: 'text', nodes: [
        root({ layout: 'horizontal', gap: 10, padding: 8, w: 400, h: 60 }),
        text('t', 'root', 'Add to cart', { autoW: true, layoutSizingH: 'hug' }), rect('r', 'root', 40, 20),
    ] },
    { name: 'text-hug-height-vertical', group: 'text', nodes: [
        root({ layout: 'vertical', gap: 6, padding: 8, w: 200, h: 200 }),
        text('t', 'root', 'Short line', { w: 180, layoutSizingV: 'hug' }), rect('r', 'root', 80, 20),
    ] },
    { name: 'text-fill-wraps', group: 'text', nodes: [
        root({ layout: 'vertical', gap: 6, padding: 8, w: 160, h: 200 }),
        text('t', 'root', 'A longer sentence that has to wrap onto several lines', { layoutSizingH: 'fill', h: 20 }),
        rect('r', 'root', 80, 20),
    ] },

    // --- layers that are not text or auto layout: Hug reads as Fixed ---
    { name: 'hug-plain-rect-is-fixed', group: 'sizing', nodes: [
        root({ layout: 'horizontal', gap: 10, padding: 8, w: 300, h: 80 }),
        rect('a', 'root', 70, 30, { layoutSizingH: 'hug', layoutSizingV: 'hug' }), rect('b', 'root', 40, 30),
    ] },

    // --- strokes included in the layout: the outer part of a child stroke takes room in the flow; a frame's own inner stroke pushes its content in ---
    { name: 'strokes-inside', group: 'strokes', nodes: [
        root({ layout: 'horizontal', gap: 10, padding: 8, strokesIncluded: true, w: 300, h: 80 }),
        rect('a', 'root', 60, 30, { stroke: '#000', strokeWidth: 4, strokeAlign: 'inside' }), rect('b', 'root', 60, 30, { stroke: '#000', strokeWidth: 4, strokeAlign: 'inside' }),
    ] },
    { name: 'strokes-center', group: 'strokes', nodes: [
        root({ layout: 'horizontal', gap: 10, padding: 8, strokesIncluded: true, w: 300, h: 80 }),
        rect('a', 'root', 60, 30, { stroke: '#000', strokeWidth: 4, strokeAlign: 'center' }), rect('b', 'root', 60, 30, { stroke: '#000', strokeWidth: 4, strokeAlign: 'center' }),
    ] },
    { name: 'strokes-outside-cross-fill', group: 'strokes', nodes: [
        root({ layout: 'horizontal', gap: 10, padding: 8, strokesIncluded: true, w: 300, h: 120 }),
        rect('a', 'root', 60, 0, { layoutSizingV: 'fill', stroke: '#000', strokeWidth: 4, strokeAlign: 'outside' }),
        rect('b', 'root', 0, 40, { layoutSizingH: 'fill', stroke: '#000', strokeWidth: 4, strokeAlign: 'outside' }),
    ] },
    { name: 'strokes-frame-own-inner', group: 'strokes', nodes: [
        root({ layout: 'vertical', gap: 6, padding: 4, strokesIncluded: true, stroke: '#000', strokeWidth: 6, strokeAlign: 'inside', w: 200, h: 200 }),
        rect('a', 'root', 80, 30), rect('b', 'root', 80, 30, { stroke: '#000', strokeWidth: 2, strokeAlign: 'center' }),
    ] },
    { name: 'strokes-not-included', group: 'strokes', nodes: [
        root({ layout: 'horizontal', gap: 10, padding: 8, w: 300, h: 80 }),
        rect('a', 'root', 60, 30, { stroke: '#000', strokeWidth: 4, strokeAlign: 'outside' }), rect('b', 'root', 60, 30),
    ] },
    // --- stroke included in the flow (reported only, not fixed yet) ---
    { name: 'strokes-included', group: 'strokes', nodes: [
        root({ layout: 'horizontal', gap: 10, padding: 8, strokesIncluded: true, w: 300, h: 80 }),
        rect('a', 'root', 60, 30, { stroke: '#000', strokeWidth: 4, strokeAlign: 'outside' }), rect('b', 'root', 60, 30),
    ] },
];

/** Seeded random auto layout trees: depth up to 2, mixed sizing, gaps, paddings and alignments. */
function randomCases(seed, count) {
    const rnd = seeded(seed);
    const pick = list => list[Math.floor(rnd() * list.length)];
    const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const cases = [];
    for (let c = 0; c < count; c++) {
        const nodes = [root({ layout: pick(['horizontal', 'vertical']), gap: int(0, 16), padding: int(0, 12), primaryAlign: pick(['start', 'center', 'end']), counterAlign: pick(['start', 'center', 'end']), w: int(200, 420), h: int(120, 320) })];
        let id = 0;
        const sizing = () => pick(['fixed', 'fixed', 'fill', 'hug']);
        const addKids = (parent, depth) => {
            for (let k = int(1, 4); k > 0; k--) {
                const sizeH = sizing(), sizeV = sizing();
                if (depth < 2 && rnd() < 0.35) {
                    const fr = frame(`f${++id}`, parent, { layout: pick(['horizontal', 'vertical']), gap: int(0, 10), padding: int(0, 8), layoutSizingH: sizeH, layoutSizingV: sizeV, w: int(40, 160), h: int(30, 120) });
                    nodes.push(fr);
                    addKids(fr.id, depth + 1);
                }
                else if (rnd() < 0.25) nodes.push(text(`t${++id}`, parent, pick(['Label', 'Confirm order', 'A bit more text here']), { autoW: sizeH === 'hug', layoutSizingH: sizeH, layoutSizingV: sizeV, w: int(40, 160) }));
                else nodes.push(rect(`r${++id}`, parent, int(20, 120), int(16, 80), { layoutSizingH: sizeH, layoutSizingV: sizeV }));
            }
        };
        addKids('root', 0);
        cases.push({ name: `random-${String(c + 1).padStart(2, '0')}`, group: 'random', nodes });
    }
    return cases;
}

/** All cases in a fixed order. The random block uses seed 20260501 and 12 trees. */
export function layoutFixtures() {
    return [...CASES, ...randomCases(20260501, 12)];
}
