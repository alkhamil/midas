// Preview viewport (pure). How a frame is placed in the Play window for each view mode, which view mode a stored preference means,
// when the chrome is visible, and which frame the previous and next controls move to. Nothing here touches the DOM, the document or
// the player; the runtime applies the results.

/** The view modes, in the order Z cycles them. */
export const SCALING_MODES = ['actual-size', 'responsive', 'fit-width', 'fit-width-and-height'];

/** The pointer within this many pixels of the top of the window shows the chrome again. */
const TOP_EDGE_PX = 48;

/**
 * The view mode a stored preference means. A mode that was removed (fill-screen) maps to fit-width-and-height, which covers the same
 * need; any other value, or none, maps to actual size.
 * @param {unknown} stored
 * @returns {string}
 */
export function resolveScalingMode(stored) {
    if (stored === 'fill-screen') return 'fit-width-and-height';
    return SCALING_MODES.includes(stored) ? stored : 'actual-size';
}

/**
 * The view mode Z moves to. An unknown mode counts as actual size, so it moves on to responsive.
 * @param {unknown} mode
 * @returns {string}
 */
export function nextScalingMode(mode) {
    const index = SCALING_MODES.indexOf(resolveScalingMode(mode));
    return SCALING_MODES[(index + 1) % SCALING_MODES.length];
}

/**
 * Where a frame sits in the window for a view mode, as a window-sized box with the frame drawn inside it.
 * - actual-size: 1:1, centred; a frame larger than the window scrolls on the axes it overflows.
 * - responsive: the frame is the window (scale 1); its own scroll behaviour decides what happens inside it, the window never scrolls.
 * - fit-width: scaled to the window width, starts at the top; scrolls vertically when taller.
 * - fit-width-and-height: contained (the smaller of the two scales), centred, never scrolls.
 * `scrollX` and `scrollY` are how far the drawn frame runs beyond the window (0 when it fits). A window with no size gives scale 1.
 * @param {{ viewport: { width: number, height: number }, frame: { width: number, height: number }, mode: string }} input
 * @returns {{ scale: number, width: number, height: number, offsetX: number, offsetY: number, scrollX: number, scrollY: number }}
 */
export function viewportLayout({ viewport, frame, mode }) {
    const { width: vw, height: vh } = viewport;
    if (mode === 'responsive') return { scale: 1, width: vw, height: vh, offsetX: 0, offsetY: 0, scrollX: 0, scrollY: 0 };
    const fitted = scaleFor(mode, frame, viewport);
    if (fitted === undefined) throw new Error(`Unknown view mode "${mode}".`);
    const scale = vw > 0 && vh > 0 ? fitted : 1;
    const width = frame.width * scale, height = frame.height * scale;
    return {
        scale,
        width,
        height,
        offsetX: Math.max(0, (vw - width) / 2),
        offsetY: Math.max(0, (vh - height) / 2),
        scrollX: Math.max(0, width - vw),
        scrollY: Math.max(0, height - vh),
    };
}

/**
 * The scale a fitting mode gives a frame in a window. Undefined for a mode that is not one of the fitting ones.
 * @param {string} mode
 * @param {{ width: number, height: number }} frame
 * @param {{ width: number, height: number }} viewport
 */
function scaleFor(mode, frame, viewport) {
    if (mode === 'actual-size') return 1;
    if (mode === 'fit-width') return viewport.width / frame.width;
    if (mode === 'fit-width-and-height') return Math.min(viewport.width / frame.width, viewport.height / frame.height);
    return undefined;
}

/**
 * The state of the chrome (top bar and bottom controls). `visible` is what is on screen; `pinnedHidden` is set by
 * Ctrl+\ and keeps the chrome hidden whatever the pointer does until it is pressed again.
 * @typedef {{ visible: boolean, pinnedHidden: boolean }} ChromeState
 * @typedef {{ type: 'click', target: 'empty' | 'disabled' | 'node' | 'button' | 'scroll' | 'chrome' | 'menu', triggered: boolean }
 *   | { type: 'pointer', y: number }
 *   | { type: 'toggle-pinned' }
 *   | { type: 'menu', open: boolean }} ChromeEvent
 */

/**
 * The chrome after one event. A click on an area that triggers nothing hides it: an empty area, a node with no interaction, or a
 * disabled element. A click that triggers an interaction, a Button, a scrollbar, the chrome or the menu does not. The pointer in the
 * top edge zone shows it. Pinned, it never shows.
 * @param {ChromeState} state
 * @param {ChromeEvent} event
 * @returns {ChromeState}
 */
export function chromeVisibility(state, event) {
    if (event.type === 'toggle-pinned') {
        const pinnedHidden = !state.pinnedHidden;
        return { visible: !pinnedHidden, pinnedHidden };
    }
    if (state.pinnedHidden) return { visible: false, pinnedHidden: true };
    if (event.type === 'pointer') return { visible: state.visible || event.y < TOP_EDGE_PX, pinnedHidden: false };
    if (event.type === 'menu') return { visible: event.open || state.visible, pinnedHidden: false };
    const hides = !event.triggered && (event.target === 'empty' || event.target === 'disabled' || event.target === 'node');
    return { visible: hides ? false : state.visible, pinnedHidden: false };
}

/**
 * Whether the content of a frame runs past the frame on an axis, so that scrolling on that axis would move something. The content is
 * the extent of the visible children on that axis: the furthest edge of any of them.
 * @param {{ width: number, height: number }} frame
 * @param {'horizontal' | 'vertical'} axis
 * @param {{ x: number, y: number, w: number, h: number, visible?: boolean }[]} children the frame's direct children
 * @returns {boolean} true when the content is not bigger than the frame on that axis (the warning shows)
 */
function overflowWarning(frame, axis, children) {
    const extent = children.reduce((max, c) => (c.visible === false ? max : Math.max(max, axis === 'horizontal' ? c.x + c.w : c.y + c.h)), 0);
    return extent <= (axis === 'horizontal' ? frame.width : frame.height);
}

/**
 * The overflow warning of each axis a scroll behaviour opens. Only those axes appear: an axis the behaviour does not open has no warning.
 * @param {{ width: number, height: number }} frame
 * @param {'none' | 'horizontal' | 'vertical' | 'both'} mode
 * @param {{ x: number, y: number, w: number, h: number, visible?: boolean }[]} children
 * @returns {{ horizontal?: boolean, vertical?: boolean }}
 */
export function overflowWarnings(frame, mode, children) {
    const axes = { none: [], horizontal: ['horizontal'], vertical: ['vertical'], both: ['horizontal', 'vertical'] }[mode] ?? [];
    return Object.fromEntries(axes.map(axis => [axis, overflowWarning(frame, axis, children)]));
}

/**
 * The frames a flow walks through: the top-level frames of its page, in the order they are stored.
 * @param {{ nodes?: any[] }} page
 * @returns {string[]}
 */
export function flowFrames(page) {
    const nodes = page.nodes || [];
    const isTopLevel = n => n.type === 'frame' && (!n.parentId || nodes.find(x => x.id === n.parentId)?.isSection);
    return nodes.filter(isTopLevel).map(n => n.id);
}

/**
 * Where the previous or next control goes from a frame, with the counter and the disabled state of both controls.
 * @param {string[]} frames
 * @param {string} current
 * @param {'prev' | 'next'} direction
 * @returns {{ target: string | null, index: number, total: number, prevDisabled: boolean, nextDisabled: boolean }}
 */
export function stepFrame(frames, current, direction) {
    const index = frames.indexOf(current);
    const total = frames.length;
    const prevDisabled = index <= 0;
    const nextDisabled = index < 0 || index >= total - 1;
    const step = direction === 'prev' ? -1 : 1;
    const targetIndex = index + step;
    const target = index >= 0 && targetIndex >= 0 && targetIndex < total ? frames[targetIndex] : null;
    return { target, index, total, prevDisabled, nextDisabled };
}
