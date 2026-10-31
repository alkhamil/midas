// Shared flex layout: the canvas rules for auto layout, used by Play and the code generator alike so a component draws
// exactly as its master does. Gap and padding are token-driven (the codegen writes them from variables); display is set
// by the surface (flex in Play and on canvas, inline-flex in generated code so a hug-sized component still hugs).
import { layoutPads, layoutGap, layoutGapCross, strokeOutside } from '../geometry/autolayout.js';
/**
 * How a child of an auto layout frame sizes itself on the parent's main axis (the flow direction) and on its cross axis.
 * - main fill: takes the free space (flex 1, may shrink to zero). Main fixed or hug: keeps its size and does not shrink, so a child
 *   wider than its frame is clipped by the frame instead of squeezed.
 * - cross fill: stretches across the parent. Cross fixed or hug: keeps its size, aligned to the start.
 * A text layer takes its natural size on a fixed or hug axis; only a fill axis changes it.
 * @param {any} n
 * @param {any} parent an auto layout frame
 * @returns {Record<string, string>}
 */
export function flowSizing(n, parent) {
    const vertical = parent.layout === 'vertical';
    const mainAxis = vertical ? { sizing: n.layoutSizingV, size: 'height', length: n.h, min: 'minHeight' } : { sizing: n.layoutSizingH, size: 'width', length: n.w, min: 'minWidth' };
    const crossAxis = vertical ? { sizing: n.layoutSizingH, size: 'width', length: n.w } : { sizing: n.layoutSizingV, size: 'height', length: n.h };
    /** @type {Record<string, string>} */
    const style = {};
    if (mainAxis.sizing === 'fill') {
        style.flex = '1 1 0';
        style[mainAxis.min] = '0px';
    }
    else {
        style.flexShrink = '0';
        if (mainAxis.sizing !== 'hug' && n.type !== 'text') style[mainAxis.size] = `${mainAxis.length}px`;
    }
    // A fixed or hug cross axis keeps its size and takes the parent's cross alignment (align-items), as on the canvas.
    if (crossAxis.sizing === 'fill') {
        style.alignSelf = 'stretch';
    }
    else if (crossAxis.sizing !== 'hug' && n.type !== 'text') {
        style[crossAxis.size] = `${crossAxis.length}px`;
    }
    const outside = strokeOutside(n, parent);
    if (outside) style.margin = `${outside}px`;
    return style;
}
/**
 * The flex container style of an auto layout frame: the spacing and alignment the canvas layout engine uses (`layoutPads`, the gaps,
 * `gapAuto` for space between, evenly or around, and the alignments). Grid layouts are laid out as a row here.
 * @param {any} n
 * @param {number} flowCount the children in the flow
 */
export function flexOf(n, flowCount) {
    const vertical = n.layout === 'vertical';
    const P = layoutPads(n), gap = layoutGap(n), mainGap = n.gapAuto ? 0 : gap, crossGap = layoutGapCross(n, gap);
    const edge = { start: 'flex-start', center: 'center', end: 'flex-end' };
    const mode = n.gapMode || 'between';
    let justify = edge[n.primaryAlign ?? 'start'] ?? 'flex-start';
    if (n.gapAuto && mode === 'evenly') justify = 'space-evenly';
    else if (n.gapAuto && mode === 'around') justify = 'space-around';
    else if (n.gapAuto && flowCount > 1) justify = 'space-between';
    return {
        display: 'flex',
        flexDirection: vertical ? 'column' : 'row',
        flexWrap: n.layoutWrap ? 'wrap' : 'nowrap',
        columnGap: `${vertical ? crossGap : mainGap}px`,
        rowGap: `${vertical ? mainGap : crossGap}px`,
        padding: `${P.t}px ${P.r}px ${P.b}px ${P.l}px`,
        justifyContent: justify,
        alignItems: !vertical && n.alignBaseline ? 'baseline' : edge[n.counterAlign ?? n.layoutAlign ?? 'start'] ?? 'flex-start',
        alignContent: 'flex-start',
        boxSizing: 'border-box',
    };
}

/**
 * The flex layout of a template root from its master node: direction, justification and cross alignment, as the canvas
 * lays them out. Gap, padding and display are owned elsewhere (tokens and the surface); absent alignments are the start.
 * @param {any} master an auto layout frame
 * @param {number} flowCount the children in the flow
 * @returns {Record<string, string>} { flexDirection, flexWrap, justifyContent, alignItems, alignContent }
 */
export function rootLayoutOf(master, flowCount) {
    const { display, columnGap, rowGap, padding, boxSizing, ...layout } = flexOf(master, flowCount);
    return layout;
}

/**
 * The label style from its canvas layer: a fill label takes the free space, a fixed or hug one keeps its size and never
 * squeezes, exactly as the canvas flow sizes it; the text aligns as the layer says. The sizing stays the layer's own.
 * @param {any} label the text layer, or null when the master has none
 * @param {any} parent the auto layout frame that holds it
 * @returns {Record<string, string>}
 */
export function labelLayoutOf(label, parent) {
    if (!label) return {};
    const style = flowSizing(label, parent);
    if (label.textAlign) style.textAlign = label.textAlign;
    return style;
}
