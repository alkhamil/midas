// Built-in glyph definitions (data): the marks a form control draws inside its box, which are not icons a designer picks. A glyph is a closed outline in a
// 24 x 24 space (bezier handles absolute), drawn filled in a colour token and sized by a token. The canvas holds it as a vector layer while its state is on; Play
// and the export draw the same outline from this definition (glyphPathD), so a click needs no layer. A template names a glyph in its anatomy (`kind: 'glyph'`).
import { pathCommands, svgPathD } from '../geometry/shapes.js';

/** The control distance of a bezier circle of radius 12: radius times 0.5523. */
const K = 6.6276;
const corner = (x, y) => ({ x, y });
const round = (x, y, inX, inY, outX, outY) => ({ x, y, in: { x: inX, y: inY }, out: { x: outX, y: outY } });

/** @type {Record<string, { points: { x: number, y: number, in?: { x: number, y: number }, out?: { x: number, y: number } }[] }>} */
export const GLYPHS = {
    // The checkmark of a checked box.
    checkmark: { points: [corner(2.5, 12.5), corner(5, 10), corner(9.5, 14.5), corner(19, 5), corner(21.5, 7.5), corner(9.5, 19.5)] },
    // The square of an indeterminate box (antd draws a filled square).
    dash: { points: [corner(0, 0), corner(24, 0), corner(24, 24), corner(0, 24)] },
    // The dot of a selected radio: a full-bleed disc, which its small slot draws as the dot.
    dot: { points: [round(12, 0, 12 - K, 0, 12 + K, 0), round(24, 12, 24, 12 - K, 24, 12 + K), round(12, 24, 12 + K, 24, 12 - K, 24), round(0, 12, 0, 12 + K, 0, 12 - K)] },
};

/**
 * The vector layer fields of a glyph (what the canvas draws): the outline in its own 24 x 24 space, closed.
 * @param {string} name
 */
export function glyphFields(name) {
    return { type: 'path', closed: true, pathW: 24, pathH: 24, points: structuredClone(GLYPHS[name].points) };
}

/**
 * The SVG path data of a glyph, as Play and the export draw it in a `viewBox="0 0 24 24"`.
 * @param {string} name
 * @returns {string}
 */
export function glyphPathD(name) {
    return svgPathD(pathCommands({ ...glyphFields(name), w: 24, h: 24 }), value => +value.toFixed(3));
}
