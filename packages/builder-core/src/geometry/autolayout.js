// Auto layout spacing (pure). The canvas layout engine and the DOM renderer read the same values here, so padding, gaps and the room a
// stroke takes in the flow are the same in both.
import { strokeIsOn, strokeSideWidths } from './shapes.js';

const NONE = { t: 0, r: 0, b: 0, l: 0 };

/** Whether a node is a frame that lays its children out (auto layout). */
const isAutoFrame = n => !!n && n.type === 'frame' && !!n.layout && n.layout !== 'none';

/**
 * The order the children of an auto layout frame follow in the flow. A frame imported from Figma stores its children back to front
 * (`layoutFlip`): they are laid out in reverse list order. `kids` are the children in list order; other frames keep their order.
 * @param {any} parent
 * @param {any[]} kids
 * @returns {any[]}
 */
export const layoutOrder = (parent, kids) => (parent?.layoutFlip && isAutoFrame(parent) ? [...kids].reverse() : kids);

/**
 * The stroke room inside a frame's padding: the part of its own stroke that lies inside its box, per side, when strokes are included in
 * the layout. An outside stroke takes no room.
 * @param {any} n
 */
function strokeInside(n) {
    if (!strokeIsOn(n) || n.strokeAlign === 'outside') return NONE;
    const k = n.strokeAlign === 'inside' ? 1 : .5, s = strokeSideWidths(n);
    return { t: s.t * k, r: s.r * k, b: s.b * k, l: s.l * k };
}

/**
 * The padding of an auto layout frame per side. A side that is not set takes the padding, and the padding defaults to 16.
 * @param {any} n
 * @returns {{ t: number, r: number, b: number, l: number }}
 */
export function layoutPads(n) {
    const p = n.padding ?? 16;
    const P = { t: n.padT ?? p, r: n.padR ?? p, b: n.padB ?? p, l: n.padL ?? p };
    if (!n.strokesIncluded) return P;
    const s = strokeInside(n);
    return { t: P.t + s.t, r: P.r + s.r, b: P.b + s.b, l: P.l + s.l };
}

/**
 * The gap between the children along the flow. It defaults to 16.
 * @param {any} n
 */
export const layoutGap = n => n.gap ?? 16;

/**
 * The gap across the flow (between wrapped lines). It is the gap unless a cross gap is set.
 * @param {any} n
 * @param {number} gap
 */
export const layoutGapCross = (n, gap) => (Number.isFinite(n.gapCross) ? n.gapCross : gap);

/**
 * The room a child's outside stroke takes beyond its box, when its parent includes strokes in the layout. Zero otherwise.
 * @param {any} child
 * @param {any} parent
 */
export function strokeOutside(child, parent) {
    if (!parent?.strokesIncluded || !strokeIsOn(child) || child.strokeAlign === 'inside') return 0;
    return child.strokeAlign === 'outside' ? (child.strokeWidth || 0) : (child.strokeWidth || 0) / 2;
}
