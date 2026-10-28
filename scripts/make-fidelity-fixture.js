// Builds the fidelity test document: one page with a labelled frame for each feature the Play preview has to match the canvas on (text,
// shapes, arcs, lines, vector paths, strokes, fills, effects, booleans, masks, images, transforms). The frames sit in a grid, six to a
// row, and each frame's name is the feature it shows. Run `node scripts/make-fidelity-fixture.js` to write the file.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildBehaviorFixture } from './make-behavior-fixture.js';

const here = dirname(fileURLToPath(import.meta.url));
export const FIDELITY_FIXTURE_PATH = resolve(here, 'fixtures/fidelity-fixture.midas');

const COLS = 6, CELL_W = 360, CELL_H = 300, FRAME_W = 320, FRAME_H = 240;

/** A top-level frame of the grid. */
const frame = (id, name, index, extra = {}) => ({
    id, name, type: 'frame', parentId: null,
    x: (index % COLS) * CELL_W, y: Math.floor(index / COLS) * CELL_H, w: FRAME_W, h: FRAME_H,
    fill: '#f4f4f6', clip: true, version: 0, ...extra,
});

/** A layer inside a frame. Every field has a default, so a feature sets only what it shows. */
const layer = (id, parentId, type, extra = {}) => ({
    id, name: id, type, parentId, x: 20, y: 20, w: 120, h: 80,
    fill: '#0058CA', fillOpacity: 1, stroke: '#000000', strokeWidth: 0, strokeOpacity: 1,
    radius: 0, opacity: 1, rotation: 0, visible: true, locked: false, clip: false, shadow: false,
    version: 0, ...extra,
});

const text = (id, parentId, content, extra = {}) => layer(id, parentId, 'text', {
    text: content, w: 280, h: 40, x: 20, y: 20, fill: '#20202a', fontFamily: 'Inter', fontSize: 20, fontWeight: 400,
    fontStyle: 'normal', lineHeight: 1.35, letterSpacing: 0, textAlign: 'left', textDecoration: 'none', textCase: 'none',
    ...extra,
});

const solid = (color, extra = {}) => ({ type: 'solid', color, opacity: 1, visible: true, ...extra });

/**
 * The features, each a frame and the layers that draw it. `kids` gets the frame id.
 * @type {{ name: string, layers: (frameId: string) => any[], frame?: Record<string, unknown> }[]}
 */
const FEATURES = [
    { name: 'Text: solid colour', layers: f => [text('t1', f, 'Solid text', { fill: '#c0392b' })] },
    { name: 'Text: fill opacity', layers: f => [text('t2', f, 'Half opacity', { fillOpacity: 0.5 })] },
    { name: 'Text: in a plain frame (no box)', layers: f => [text('t3', f, 'No box behind me', { radius: 8, stroke: '#000000', strokeWidth: 0 })] },
    { name: 'Text: rich spans', layers: f => [text('t4', f, 'Bold plain', { spans: [{ text: 'Bold ', fontWeight: 700, fill: '#c0392b' }, { text: 'plain', fill: '#112233', fontStyle: 'italic' }] })] },
    { name: 'Text: stroke', layers: f => [text('t5', f, 'Outlined', { fontSize: 36, stroke: '#c0392b', strokeWidth: 1.5, strokeOpacity: 1 })] },
    { name: 'Text: drop shadow', layers: f => [text('t6', f, 'Shadowed', { fontSize: 28, effects: [{ type: 'drop', visible: true, x: 2, y: 3, blur: 6, spread: 0, color: '#000000', opacity: 0.4 }] })] },
    { name: 'Text: truncation (2 lines)', layers: f => [text('t7', f, 'A long line of text that runs over two lines and is cut off with an ellipsis after that', { w: 200, h: 60, textTruncate: true, maxLines: 2, fontSize: 16 })] },
    { name: 'Text: wrap balance', layers: f => [text('t8', f, 'Balanced wrapping across two lines of text', { w: 200, h: 60, textWrap: 'balance', fontSize: 16 })] },
    { name: 'Rect: solid, short hex, alpha', layers: f => [layer('r1', f, 'rect', { fill: '#abc', fillOpacity: 0.5 })] },
    { name: 'Rect: linear gradient angle 0', layers: f => [layer('r2', f, 'rect', { fillType: 'linear', fill: '#000000', fill2: '#ffffff', gradientAngle: 0 })] },
    { name: 'Rect: linear gradient angle 45', layers: f => [layer('r3', f, 'rect', { fillType: 'linear', fill: '#ff0000', fill2: '#0000ff', gradientAngle: 45 })] },
    { name: 'Rect: radial gradient', layers: f => [layer('r4', f, 'rect', { fills: [{ type: 'radial', color: '#ffffff', color2: '#0058CA', opacity: 1, visible: true }] })] },
    { name: 'Rect: angular gradient', layers: f => [layer('r5', f, 'rect', { fills: [{ type: 'angular', color: '#ffffff', color2: '#0058CA', opacity: 1, visible: true }] })] },
    { name: 'Rect: multiple fills', layers: f => [layer('r6', f, 'rect', { fills: [solid('#ffcc00', { opacity: 0.6 }), solid('#0058CA')] })] },
    { name: 'Rect: per-corner radius', layers: f => [layer('r7', f, 'rect', { radii: [4, 16, 28, 40], w: 160, h: 100, fill: '#2f855a' })] },
    { name: 'Rect: centred stroke', layers: f => [layer('r8', f, 'rect', { strokeWidth: 8, stroke: '#c0392b' })] },
    { name: 'Rect: inside stroke', layers: f => [layer('r9', f, 'rect', { strokeWidth: 8, stroke: '#c0392b', strokeAlign: 'inside' })] },
    { name: 'Rect: outside stroke', layers: f => [layer('r10', f, 'rect', { strokeWidth: 8, stroke: '#c0392b', strokeAlign: 'outside' })] },
    { name: 'Rect: dashed stroke', layers: f => [layer('r11', f, 'rect', { fill: 'none', strokeWidth: 4, stroke: '#112233', strokeStyle: 'dash', strokeDash: 12, strokeGap: 8 })] },
    { name: 'Rect: per-side stroke (top and left)', layers: f => [layer('r12', f, 'rect', { strokeWidth: 6, stroke: '#112233', strokeSides: 'custom', strokeT: 6, strokeL: 6, strokeR: 0, strokeB: 0 })] },
    { name: 'Ellipse: full with stroke', layers: f => [layer('e1', f, 'ellipse', { w: 140, h: 90, strokeWidth: 4, stroke: '#112233' })] },
    { name: 'Ellipse: arc 75%', layers: f => [layer('e2', f, 'ellipse', { w: 140, h: 140, arcStart: -90, arcSweep: 75, arcRatio: 0 })] },
    { name: 'Ellipse: donut', layers: f => [layer('e3', f, 'ellipse', { w: 140, h: 140, arcSweep: 100, arcRatio: 50 })] },
    { name: 'Line: stroke', layers: f => [layer('l1', f, 'line', { w: 160, h: 80, fill: 'none', strokeWidth: 4, stroke: '#c0392b', strokeCap: 'round' })] },
    { name: 'Vector path: closed', layers: f => [layer('p1', f, 'path', { w: 140, h: 120, pathW: 10, pathH: 10, closed: true, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }], stroke: '#112233', strokeWidth: 2 })] },
    { name: 'Vector path: curves', layers: f => [layer('p2', f, 'path', { w: 140, h: 120, pathW: 10, pathH: 10, closed: false, points: [{ x: 0, y: 5, out: { x: 0, y: 0 } }, { x: 10, y: 5, in: { x: 10, y: 10 } }], stroke: '#c0392b', strokeWidth: 3, fill: 'none' })] },
    { name: 'Boolean: union', layers: f => [{ ...layer('g1', f, 'group', { booleanOp: 'union', fill: 'none' }) }, layer('g1a', 'g1', 'rect', { x: 0, y: 0, w: 80, h: 60 }), layer('g1b', 'g1', 'rect', { x: 40, y: 30, w: 80, h: 60, fill: '#c0392b' })] },
    { name: 'Boolean: subtract', layers: f => [layer('g2', f, 'group', { booleanOp: 'subtract', fill: 'none' }), layer('g2a', 'g2', 'rect', { x: 0, y: 0, w: 80, h: 60 }), layer('g2b', 'g2', 'rect', { x: 40, y: 30, w: 80, h: 60, fill: '#c0392b' })] },
    { name: 'Mask: rectangle mask', layers: f => [layer('m1', f, 'rect', { w: 200, h: 140, fill: '#0058CA' }), layer('m2', f, 'ellipse', { w: 120, h: 120, isMask: true, fill: '#000000' })] },
    { name: 'Image layer', layers: f => [layer('i1', f, 'image', { assetId: 'missing', w: 120, h: 80 })] },
    { name: 'Effect: drop shadow', layers: f => [layer('x1', f, 'rect', { effects: [{ type: 'drop', visible: true, x: 4, y: 6, blur: 12, spread: 0, color: '#000000', opacity: 0.4 }] })] },
    { name: 'Effect: inner shadow', layers: f => [layer('x2', f, 'rect', { effects: [{ type: 'inner', visible: true, x: 0, y: 4, blur: 8, spread: 0, color: '#000000', opacity: 0.5 }] })] },
    { name: 'Effect: layer blur', layers: f => [layer('x3', f, 'rect', { effects: [{ type: 'layerBlur', visible: true, radius: 8 }] })] },
    { name: 'Effect: background blur', layers: f => [layer('x4a', f, 'rect', { x: 0, y: 0, w: 320, h: 240, fill: '#c0392b' }), layer('x4', f, 'rect', { x: 40, y: 40, w: 160, h: 120, fill: '#ffffff', fillOpacity: 0.3, effects: [{ type: 'bgBlur', visible: true, radius: 16 }] })] },
    { name: 'Effect: glass (not drawn yet)', layers: f => [layer('x5', f, 'rect', { effects: [{ type: 'glass', visible: true, radius: 8 }] })] },
    { name: 'Transform: flip X and rotation', layers: f => [layer('tr1', f, 'rect', { flipX: true, rotation: 20, radii: [0, 20, 0, 20], w: 140, h: 90, fill: '#2f855a' })] },
    { name: 'Opacity 40%', layers: f => [layer('o1', f, 'rect', { opacity: 0.4 })] },
    { name: 'Group with clip content', layers: f => [layer('gc', f, 'group', { clip: true, fill: 'none', x: 20, y: 20, w: 100, h: 60 }), layer('gc1', 'gc', 'rect', { x: 60, y: 30, w: 120, h: 80, fill: '#c0392b' })] },
];

/**
 * The fidelity document.
 * @returns {Record<string, any>}
 */
export function buildFidelityFixture() {
    const base = buildBehaviorFixture();
    const nodes = FEATURES.flatMap((feature, index) => {
        const id = `frame-${index}`;
        return [frame(id, feature.name, index), ...feature.layers(id)];
    });
    return {
        format: base.format, version: base.version, name: 'Fidelity fixture', pageId: 'page-fidelity', tokens: base.tokens, assets: base.assets,
        pages: [{ id: 'page-fidelity', name: 'Fidelity', nodes }],
        variables: { collections: [], items: [] },
    };
}

// Run directly: write the fixture file (the directory is created if missing).
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    mkdirSync(dirname(FIDELITY_FIXTURE_PATH), { recursive: true });
    writeFileSync(FIDELITY_FIXTURE_PATH, JSON.stringify(buildFidelityFixture(), null, 2) + '\n');
    console.log(`Wrote ${FIDELITY_FIXTURE_PATH}`);
}
