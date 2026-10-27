// The one place Preview turns a node's layout into CSS. Auto layout becomes flexbox and the browser does the layout:
// no positions are computed here. Pure: (node, parent) in, a CSS style object out.
//
// Midas field names (Figma term in brackets):
//   layout 'horizontal' | 'vertical' | 'grid' | 'none'   [layoutMode]      layoutFlip      [children stored back to front: see layoutOrder]
//   layoutReverseZ [canvas stacking: first on top: see paintOrder]
//   gap [itemSpacing], gapCross [counterAxisSpacing], gapAuto + gapMode [space-between / evenly / around]
//   padding, padT/padR/padB/padL                          primaryAlign, counterAlign (start | center | end)
//   layoutWrap                                            layoutSizingH / layoutSizingV: 'fixed' | 'hug' | 'fill'
//   layoutPositioning 'absolute'                          clip [clipsContent], minW/maxW/minH/maxH
// Not mapped (the canvas engine still draws these, Preview does not): "strokes included" in the flow, text baseline alignment.

const px = v => `${Math.round((+v || 0) * 100) / 100}px`;
const finite = v => v !== undefined && v !== null && v !== '' && Number.isFinite(+v);
const ALIGN = { start: 'flex-start', center: 'center', end: 'flex-end' };
const SPACE = { between: 'space-between', evenly: 'space-evenly', around: 'space-around' };

export const isAutoFrame = n => !!n && n.type === 'frame' && !!n.layout && n.layout !== 'none';

/**
 * The order the children of an auto layout frame follow in the flow. This is the single source of truth for the canvas and for
 * Preview. A frame imported from Figma stores its children back to front (`layoutFlip`): they are laid out in reverse list order.
 * `kids` = the children in list order. Children of other frames are returned as they are.
 */
export const layoutOrder = (parent, kids) => parent?.layoutFlip && isAutoFrame(parent) ? [...kids].reverse() : kids;

/**
 * The order the children are painted in, first = underneath. "Canvas stacking: First on top" (`layoutReverseZ`) paints the list
 * in reverse. It only decides what covers what: it never changes where a child sits in the flow.
 */
export const paintOrder = (parent, kids) => parent?.layoutReverseZ && isAutoFrame(parent) ? [...kids].reverse() : kids;

/**
 * z-index per child id for Preview, which keeps the DOM in layoutOrder: only where paint order differs from flow order
 * (otherwise the DOM order already stacks them right and nothing is set). First painted = 1.
 */
export function zIndexMap(parent, kids) {
    const flow = layoutOrder(parent, kids), stacked = paintOrder(parent, kids);
    return new Map(flow.every((k, i) => k === stacked[i]) ? [] : stacked.map((k, i) => [k.id, i + 1]));
}

/** A layer's stroke is drawn: on, with a width, not hidden, and not a group. Shared by the canvas and Preview. */
export function strokeIsOn(n) { return !['group'].includes(n.type) && n.strokeWidth > 0 && n.strokeVisible !== false && !!n.stroke && n.stroke !== 'none'; }

/** Width of the stroke on each side (Strokes: all / top / custom sides). */
export function strokeSideWidths(n) {
    const w = n.strokeWidth || 0, m = n.strokeSides || 'all';
    if (m === 'custom')
        return { t: n.strokeT ?? w, r: n.strokeR ?? w, b: n.strokeB ?? w, l: n.strokeL ?? w };
    if (m === 'all')
        return { t: w, r: w, b: w, l: w };
    return { t: m === 'top' ? w : 0, r: m === 'right' ? w : 0, b: m === 'bottom' ? w : 0, l: m === 'left' ? w : 0 };
}

/**
 * How far a child's stroke reaches outside its box, when its parent includes strokes in the layout: a Outside stroke takes its
 * whole width, Center half, Inside nothing. Applied as a margin in Preview, as an offset in the canvas.
 */
export function strokeOutset(n) {
    if (!strokeIsOn(n) || n.strokeAlign === 'inside') return 0;
    return n.strokeAlign === 'outside' ? (n.strokeWidth || 0) : (n.strokeWidth || 0) / 2;
}

/** A frame's own stroke pushes its content in, per side, when strokes are included: Inside all of it, Center half, Outside none. */
export function strokeInset(n) {
    if (!strokeIsOn(n) || n.strokeAlign === 'outside') return { t: 0, r: 0, b: 0, l: 0 };
    const k = n.strokeAlign === 'inside' ? 1 : .5, s = strokeSideWidths(n);
    return { t: s.t * k, r: s.r * k, b: s.b * k, l: s.l * k };
}

/** 'fixed' | 'hug' | 'fill' for one axis ('h' | 'v'). Hug only means something on text and on auto layout frames. */
export function sizingOf(n, axis, parentIsAuto = false) {
    const v = axis === 'h' ? n.layoutSizingH : n.layoutSizingV;
    if (n.type === 'text') {
        if (v) return v;
        return axis === 'h' ? (n.autoW ? 'hug' : 'fixed') : (parentIsAuto ? 'hug' : 'fixed');
    }
    if (v === 'hug') return isAutoFrame(n) ? 'hug' : 'fixed';
    return v || 'fixed';
}

/** The flex container half of the style: only for frames with auto layout. */
function containerStyle(n) {
    const s = {};
    if (n.layout === 'grid') {
        const cols = Math.max(1, Math.round(n.gridCols || 2));
        s.display = 'grid';
        s.gridTemplateColumns = `repeat(${cols}, auto)`;
        s.gap = px(n.gap ?? 16);
        if (finite(n.gapCross)) s.rowGap = px(n.gapCross);
        s.justifyItems = ALIGN[n.primaryAlign || 'start'];
        s.alignItems = ALIGN[n.counterAlign || n.layoutAlign || 'start'];
        return s;
    }
    const horiz = n.layout === 'horizontal';
    s.display = 'flex';
    // Never `*-reverse`: it would also mirror start / end alignment. A flipped frame gets its children in layoutOrder instead.
    s.flexDirection = horiz ? 'row' : 'column';
    const gap = n.gap ?? 16, cross = finite(n.gapCross) ? +n.gapCross : gap;
    if (n.gapAuto) {
        // Space between / evenly / around replace the gap along the main axis.
        s.justifyContent = SPACE[n.gapMode || 'between'] || SPACE.between;
        if (horiz) { s.columnGap = px(0); s.rowGap = px(cross); } else { s.rowGap = px(0); s.columnGap = px(cross); }
    }
    else {
        s.justifyContent = ALIGN[n.primaryAlign || 'start'] || 'flex-start';
        if (cross === gap) s.gap = px(gap);
        else if (horiz) { s.columnGap = px(gap); s.rowGap = px(cross); }
        else { s.rowGap = px(gap); s.columnGap = px(cross); }
    }
    s.alignItems = horiz && n.alignBaseline ? 'baseline' : (ALIGN[n.counterAlign || n.layoutAlign || 'start'] || 'flex-start');
    if (n.layoutWrap) { s.flexWrap = 'wrap'; s.alignContent = 'flex-start'; }
    const p = n.padding ?? 16;
    s.padding = [n.padT ?? p, n.padR ?? p, n.padB ?? p, n.padL ?? p].map(px).join(' ');
    return s;
}

/**
 * CSS for one node inside its parent.
 * `parent` is the node it sits in (null for the root). Fill needs it: along the parent's main axis a Fill child shares the
 * space (flex), across it the child stretches. `off` is only for layers inside a mask wrapper: they sit at x/y plus that offset.
 */
export function nodeToStyle(node, parent, off) {
    const s = { boxSizing: 'border-box' };
    const owner = off ? null : parent;
    const flow = isAutoFrame(owner) && node.layoutPositioning !== 'absolute';
    const absolute = !!off || (!!owner && !flow);
    const container = node.type === 'frame' || node.type === 'group';

    if (absolute) {
        s.position = 'absolute';
        s.left = px(node.x + (off?.x || 0));
        s.top = px(node.y + (off?.y || 0));
    }
    else if (container || !owner) s.position = 'relative';

    if (isAutoFrame(node)) Object.assign(s, containerStyle(node));
    if (node.type === 'frame' && (node.clip || node.overflow === 'none')) s.overflow = 'hidden';
    if (node.rotation) s.transform = `rotate(${node.rotation}deg)`;

    const horizMain = owner?.layout !== 'vertical';
    for (const axis of ['h', 'v']) {
        const dim = axis === 'h' ? 'width' : 'height', Dim = axis === 'h' ? 'Width' : 'Height', size = axis === 'h' ? node.w : node.h;
        const mode = sizingOf(node, axis, isAutoFrame(owner));
        let min = finite(axis === 'h' ? node.minW : node.minH) ? px(axis === 'h' ? node.minW : node.minH) : null;
        const max = finite(axis === 'h' ? node.maxW : node.maxH) ? px(axis === 'h' ? node.maxW : node.maxH) : null;
        if (flow && owner.layout !== 'grid') {
            const main = (axis === 'h') === horizMain;
            if (mode === 'fixed') { s[dim] = px(size); if (main) s.flexShrink = 0; }
            else if (mode === 'hug') { s[dim] = 'auto'; if (main) s.flexShrink = 0; }
            else if (main) { s.flex = '1 1 0'; min = min || '0'; }        // Fill along the main axis: share what is left
            else s.alignSelf = 'stretch';                                  // Fill across it: no size of its own
        }
        else if (flow) {
            // A grid cell: Fill stretches to the cell, the rest keeps its size.
            if (mode === 'fill') { s[axis === 'h' ? 'justifySelf' : 'alignSelf'] = 'stretch'; }
            else s[dim] = mode === 'hug' ? 'auto' : px(size);
        }
        else if (mode === 'fixed') s[dim] = px(size);
        else if (mode === 'hug') s[dim] = owner ? 'auto' : 'fit-content';
        else { s[dim] = '100%'; if (absolute) s[axis === 'h' ? 'left' : 'top'] = px(off ? (axis === 'h' ? off.x : off.y) : 0); }
        if (min) s['min' + Dim] = min;
        if (max) s['max' + Dim] = max;
    }
    // Text that hugs its width stays on one line (a hard line break is kept); Fixed and Fill widths may wrap.
    if (node.type === 'text') s.whiteSpace = sizingOf(node, 'h', isAutoFrame(owner)) === 'hug' ? (/\n/.test(node.text || '') ? 'pre' : 'nowrap') : 'pre-wrap';
    return s;
}
