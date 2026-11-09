// Built-in glyph definitions (data): the marks a form control draws inside its box, which are not icons a designer picks. A glyph is a closed outline in a
// 24 x 24 space (bezier handles absolute), drawn filled in a colour token and sized by a token. The canvas holds it as a vector layer while its state is on; Play
// and the export draw the same outline from this definition (glyphPathD), so a click needs no layer. A template names a glyph in its anatomy (`kind: 'glyph'`).
import { pathCommands, svgPathD } from '../geometry/shapes.js';
import { SOLAR } from './solar-glyphs.js';

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
    // Solar Outline icons (solar-glyphs.js): the eyes of a password, the arrows of a number stepper.
    eye: fromPath(SOLAR.eye),
    eyeOff: fromPath(SOLAR.eyeOff),
    chevronUp: fromPath(SOLAR.chevronUp),
    chevronDown: fromPath(SOLAR.chevronDown),
    // The grip of a resizable text area: two short diagonal bars in the bottom right corner.
    resizeHandle: fromPath('M20.6 9.4L9.4 20.6L8 19.2L19.2 8L20.6 9.4ZM20.6 15.4L15.4 20.6L14 19.2L19.2 14L20.6 15.4Z'),
};

/**
 * A glyph from SVG path data (absolute or relative M, L, H, V, C, Z): its first sub-path is the layer's points, the others its contours, filled even-odd.
 * @param {string} d
 */
function fromPath(d) {
    const contours = [];
    let cur = null, x = 0, y = 0, start = [0, 0];
    const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
    let i = 0, cmd = '';
    const num = () => Number(tokens[i++]);
    const close = () => {
        if (!cur) return;
        const first = cur[0], last = cur[cur.length - 1];
        // A curve that ends where the path began closes onto the first point instead of repeating it.
        if (cur.length > 1 && last.x === first.x && last.y === first.y) { if (last.in) first.in = last.in; cur.pop(); }
        contours.push({ points: cur, closed: true });
        cur = null;
    };
    while (i < tokens.length) {
        if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
        const rel = cmd === cmd.toLowerCase(), op = cmd.toUpperCase();
        if (op === 'Z') { close(); x = start[0]; y = start[1]; continue; }
        if (op === 'M') { close(); x = num() + (rel ? x : 0); y = num() + (rel ? y : 0); start = [x, y]; cur = [{ x, y }]; cmd = rel ? 'l' : 'L'; continue; }
        if (op === 'L') { x = num() + (rel ? x : 0); y = num() + (rel ? y : 0); cur.push({ x, y }); continue; }
        if (op === 'H') { x = num() + (rel ? x : 0); cur.push({ x, y }); continue; }
        if (op === 'V') { y = num() + (rel ? y : 0); cur.push({ x, y }); continue; }
        if (op === 'C') {
            const x1 = num() + (rel ? x : 0), y1 = num() + (rel ? y : 0), x2 = num() + (rel ? x : 0), y2 = num() + (rel ? y : 0), nx = num() + (rel ? x : 0), ny = num() + (rel ? y : 0);
            cur[cur.length - 1].out = { x: x1, y: y1 };
            cur.push({ x: nx, y: ny, in: { x: x2, y: y2 } });
            x = nx; y = ny;
            continue;
        }
        throw new Error(`glyph path command ${cmd} is not supported`);
    }
    close();
    const [first, ...rest] = contours;
    return { points: first.points, ...(rest.length ? { contours: rest } : {}), fillRule: 'evenodd' };
}

/**
 * The vector layer fields of a glyph (what the canvas draws): the outline in its own 24 x 24 space, closed.
 * @param {string} name
 */
export function glyphFields(name) {
    const g = GLYPHS[name];
    return { type: 'path', closed: true, pathW: 24, pathH: 24, points: structuredClone(g.points), ...(g.contours ? { contours: structuredClone(g.contours) } : {}), ...(g.fillRule ? { fillRule: g.fillRule } : {}) };
}

/**
 * The SVG path data of a glyph, as Play and the export draw it in a `viewBox="0 0 24 24"`.
 * @param {string} name
 * @returns {string}
 */
export function glyphPathD(name) {
    return svgPathD(pathCommands({ ...glyphFields(name), w: 24, h: 24 }), value => +value.toFixed(3));
}

/** The fill-rule attribute a glyph's SVG path needs (even-odd for the Solar outlines, none for the plain polygons). */
export const glyphFillRuleAttr = name => (GLYPHS[name].fillRule === 'evenodd' ? ' fill-rule="evenodd"' : '');
