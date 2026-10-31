// Stroke paint of a layer whose stroke is bound to a variable (pure). The colour lives in the variable; the layer keeps the rest of
// the paint (opacity, visibility). A stale zero opacity or a hidden paint would keep the swatch and the canvas blank even when the
// variable resolves to a real colour, so every bind and every mode change passes the layer through here.
import { splitColor } from './tokens.js';
import { setStrokeWeight } from '../geometry/shapes.js';

/**
 * Leaves a layer with a bound stroke a paint that draws, unless the variable truly resolves transparent: opacity 100 when it is
 * zero, the stroke visible, and (when `ensureWidth`) a width of 1 when it has none. A colour with alpha 0, or one that is not a
 * colour, changes nothing: the transparency belongs to the variable.
 * @param {any} node
 * @param {string | null | undefined} color the colour the variable resolves to in the layer's modes
 * @param {{ ensureWidth?: boolean }} [options]
 * @returns {boolean} whether the layer changed
 */
export function restoreStrokePaint(node, color, { ensureWidth = false } = {}) {
    const paint = typeof color === 'string' ? splitColor(color) : null;
    if (!paint || paint.alpha === 0) return false;
    let changed = false;
    if (ensureWidth && !(node.strokeWidth > 0)) { setStrokeWeight(node, 1); changed = true; }
    if (node.strokeOpacity !== undefined && !(node.strokeOpacity > 0)) { node.strokeOpacity = 1; changed = true; }
    if (node.strokeVisible === false) { delete node.strokeVisible; changed = true; }
    return changed;
}

/**
 * The red, green, blue and alpha (0 to 1) a Design panel swatch draws a colour with, over its checkerboard: the colour's own alpha
 * (`#rrggbbaa`, a variable's transparency) times the paint's opacity. A value that is not a colour draws as the default grey.
 * @param {string | undefined} color
 * @param {number} opacity 0 to 1
 * @returns {{ r: number, g: number, b: number, a: number }}
 */
export function swatchPaint(color, opacity) {
    const paint = (color ? splitColor(color) : null) ?? { rgb: '#d9d9d9', alpha: 100 };
    const rgb = parseInt(paint.rgb.slice(1), 16);
    return { r: rgb >> 16, g: (rgb >> 8) & 255, b: rgb & 255, a: opacity * paint.alpha / 100 };
}
