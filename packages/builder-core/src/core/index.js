// The bridge to the Rust core (crates/midas-core, built to ./pkg by scripts/build-core.mjs). The core is loaded once, when this module is first
// imported, so every export below is synchronous: a top-level await, in Node (tests, the server) from the file next to this one, and in the
// browser through the bundler's own URL for the .wasm. A failed load stops the import with the loader's error; there is no JS fallback.
import init, { initSync, core_version, stroke_area, paint_layer, picture_extent } from './pkg/midas_core.js';

if (typeof window === 'undefined' && typeof process !== 'undefined' && process.versions?.node) {
    // Node has no fetch for file: URLs; the bytes are read here and handed over.
    const fs = 'node:fs/promises';
    const { readFile } = await import(/* @vite-ignore */ fs);
    initSync({ module: await readFile(new URL('./pkg/midas_core_bg.wasm', import.meta.url)) });
}
else await init();

/**
 * One drawing command of a layer outline (`pathCommands` in geometry/shapes.js; a text layer's glyph outlines go in as the same commands).
 * @typedef {{ op: 'M' | 'L', x: number, y: number } | { op: 'C', x1: number, y1: number, x2: number, y2: number, x: number, y: number } | { op: 'Z' }
 *   | { op: 'E', cx: number, cy: number, rx: number, ry: number, start: number, end: number, ccw: boolean } | { op: 'R', w: number, h: number, radii: number[] }} PathCommand
 */

/**
 * The stroke geometry of a layer.
 * @typedef {object} StrokeGeometry
 * @property {number} weight
 * @property {'inside' | 'center' | 'outside'} [align] open paths are always centred
 * @property {'miter' | 'round' | 'bevel'} [join]
 * @property {'butt' | 'round' | 'square'} [cap]
 * @property {number} [miterLimit]
 * @property {number[]} [dashes] dash, gap, ... (none: solid)
 * @property {number[] | null} [sides] per-side weights top, right, bottom, left (a rectangle only)
 * @property {boolean} [closed] false for a line and an open path
 * @property {boolean} [evenOdd] the shape fills even-odd
 */

/**
 * The area a stroke paints.
 * @typedef {{ d: string, rule: 'evenodd' | 'nonzero' }} StrokeArea `d` is SVG path data in the layer's own space; `rule` is the fill rule that paints it
 */

/**
 * The SVG layer of a paint.
 * @typedef {{ defs: string, content: string, flat: boolean }} PaintLayer `content` is the markup that paints it (place it in a group clipped by the stroke area); `flat` says it is a plain colour standing in for a paint SVG cannot draw
 */

/**
 * Where a picture is drawn in a box: its rectangle in the box's space (it may reach beyond the box on one axis), and its turn about the box's centre. A tiled picture is one tile at the origin that repeats.
 * @typedef {{ x: number, y: number, w: number, h: number, tile: boolean, rotation: number }} PictureExtent
 */

const MEMO_LIMIT = 2048;
/** @type {Map<string, StrokeArea>} */
const areas = new Map();

/** The version of the Rust core the bridge loaded. */
export function coreVersion() {
    return core_version();
}

/**
 * The area a stroke paints, as a path to fill with its rule. A layer whose outline and stroke are unchanged gets the same object back, so a
 * caller may key its own caches by it. Throws on a path with invalid coordinates or one too complex to outline.
 * @param {PathCommand[]} commands
 * @param {StrokeGeometry} props
 * @returns {StrokeArea}
 */
export function strokeArea(commands, props) {
    const c = JSON.stringify(commands), p = JSON.stringify(props), key = `${c}|${p}`;
    const hit = areas.get(key);
    if (hit) return hit;
    const area = /** @type {StrokeArea} */ (JSON.parse(stroke_area(c, p)));
    if (areas.size >= MEMO_LIMIT) areas.clear();
    areas.set(key, area);
    return area;
}

/**
 * The SVG layer of a paint (a fill-shaped object of fills.js) for a layer `w` by `h`: gradients (linear and radial map directly; an angular or a diamond gradient has no SVG
 * paint server, so it comes back as its first stop's colour), patterns, pictures placed by their extent with their adjustments as a filter, and a video's poster. Null for a solid
 * or hidden paint or one that cannot be drawn yet.
 * @param {any} paint
 * @param {string} id the id the layer takes
 * @param {number} w
 * @param {number} h
 * @param {string | null} [src] the asset the paint draws (an image, a video's poster, a pattern's tile)
 * @returns {PaintLayer | null}
 */
export function paintLayer(paint, id, w, h, src = null) {
    return JSON.parse(paint_layer(JSON.stringify(paint), id, w, h, src));
}

/**
 * Where an image or a video poster paint is drawn in a box `w` by `h`: the one placement of every mode (fill, fit, crop, tile) the canvas and Play both draw from. `iw` and
 * `ih` are the picture's measured size (the canvas has the loaded image); without them the paint's own recorded size is used. Null while it cannot be placed.
 * @param {any} paint
 * @param {number} w
 * @param {number} h
 * @param {number} [iw]
 * @param {number} [ih]
 * @returns {PictureExtent | null}
 */
export function pictureExtent(paint, w, h, iw, ih) {
    return JSON.parse(picture_extent(JSON.stringify(paint), w, h, iw, ih));
}
