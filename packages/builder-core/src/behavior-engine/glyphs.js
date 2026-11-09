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
    // The eye of a password shown: an almond with the pupil cut out. One contour, filled non-zero: the pupil is wound the other way and joined by a bridge that
    // is walked there and back, so it has no width.
    eye: { points: eyePoints() },
    // The eye of a password hidden: the same eye with a slash through it, a second loop of the same winding joined by its own bridge.
    eyeOff: { points: [...eyePoints(), corner(9, 12), corner(3.5, 4.6), corner(5.1, 3), corner(20.5, 19.4), corner(18.9, 21), corner(3.5, 4.6), corner(9, 12)] },
    // The arrows of a number input's stepper: a filled triangle each.
    chevronUp: { points: [corner(12, 6), corner(21, 16), corner(3, 16)] },
    chevronDown: { points: [corner(3, 8), corner(21, 8), corner(12, 18)] },
};

/** The almond of the eye and its pupil, ending on the pupil's start so a caller can chain another loop from there. */
function eyePoints() {
    const k = 3 * 0.5523;
    return [
        corner(1, 12), round(12, 5.5, 7, 5.5, 17, 5.5), corner(23, 12), round(12, 18.5, 17, 18.5, 7, 18.5), corner(1, 12),
        round(9, 12, 9, 12 - k, 9, 12 + k), round(12, 15, 12 - k, 15, 12 + k, 15), round(15, 12, 15, 12 + k, 15, 12 - k), round(12, 9, 12 + k, 9, 12 - k, 9), round(9, 12, 9, 12 - k, 9, 12 + k),
    ];
}

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
