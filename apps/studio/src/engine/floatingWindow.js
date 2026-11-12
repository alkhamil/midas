// The one floating window of the studio: every picker, popover and editor that the Design, Behavior and Prototype tabs open mounts on it. The title bar is the drag handle,
// a close button is always there, the window stays whole inside the viewport, and nothing is selected while it is dragged. It opens docked beside the right panel (its right
// edge 8px before the panel's left edge), its top on the row that opened it, and it opens there again each time: the position is never remembered.

/** The space between a window and the panel it is docked to, and between a window and the viewport edge. */
export const WINDOW_GAP = 8;

/**
 * A window position kept whole inside the viewport: the left and top edges at least `margin` from the viewport's, the right and bottom edges no further than `margin` from its
 * far edges (a window larger than the viewport sits at the margin and overflows on its far side).
 * @param {{ left: number, top: number }} pos
 * @param {{ w: number, h: number }} size
 * @param {{ w: number, h: number }} viewport
 * @param {number} [margin]
 * @returns {{ left: number, top: number }}
 */
export function clampWindow(pos, size, viewport, margin = WINDOW_GAP) {
    const left = Math.max(margin, Math.min(pos.left, viewport.w - size.w - margin));
    const top = Math.max(margin, Math.min(pos.top, viewport.h - size.h - margin));
    return { left, top };
}

/**
 * Where a window opens: docked beside the right panel (its right edge is the panel's left edge minus the gap), its top aligned with the row that opened it, clamped so
 * the whole window is inside the viewport.
 * @param {{ anchorTop: number, panelLeft: number, size: { w: number, h: number }, viewport: { w: number, h: number }, gap?: number, margin?: number }} input
 * @returns {{ left: number, top: number }}
 */
export function placeWindow({ anchorTop, panelLeft, size, viewport, gap = WINDOW_GAP, margin = WINDOW_GAP }) {
    return clampWindow({ left: panelLeft - gap - size.w, top: anchorTop }, size, viewport, margin);
}

/** What in a title bar does not start a drag: the controls it holds. */
const CONTROLS = 'button, select, input, textarea, a, label, [contenteditable="true"]';

/**
 * Makes an element (already in the document, with its title bar as `.pp-head` or its first child) a floating window: places it by `placeWindow`, makes the title bar its drag
 * handle, adds a close button when the bar has none, and keeps it inside the viewport when the window or its content changes size.
 * @param {HTMLElement} el
 * @param {{ anchor?: Element | null, panel?: Element | null, onClose?: () => void, closeHtml?: string }} [options] `anchor`: the control that opened it (its top is the window's);
 *   `dragAnywhere`: the whole surface drags, not only the title bar, except the controls and the `noDrag` selector;
 *   `panel`: the right panel to dock beside; `onClose`: what the close button does (the opener's own close); `closeHtml`: the close button's icon
 * @returns {{ close: () => void, place: () => void, dispose: () => void }}
 */
export function mountFloatingWindow(el, { anchor = null, panel = document.querySelector('#right-panel'), onClose, closeHtml = '&times;', dragAnywhere = false, noDrag = '' } = {}) {
    el.classList.add('fw');
    el.style.position = 'fixed';
    const headOf = () => el.querySelector('.pp-head') ?? el.firstElementChild;
    const viewport = () => ({ w: window.innerWidth, h: window.innerHeight });
    const sizeOf = () => ({ w: el.offsetWidth, h: el.offsetHeight });
    const apply = pos => { el.style.left = `${pos.left}px`; el.style.top = `${pos.top}px`; };
    const place = () => apply(placeWindow({ anchorTop: anchor ? anchor.getBoundingClientRect().top : WINDOW_GAP * 8, panelLeft: panel ? panel.getBoundingClientRect().left : window.innerWidth, size: sizeOf(), viewport: viewport() }));
    place();

    // The title bar: the drag handle, and a close button when it has none. An opener that draws its content again replaces the bar, so this runs again then.
    const dress = () => {
        const head = headOf();
        if (!head) return;
        head.classList.add('fw-handle');
        if (head.querySelector('[aria-label="Close"], [data-fw-close]')) return;
        const button = document.createElement('button');
        button.className = 'ui-icon-button small';
        button.setAttribute('data-fw-close', '');
        button.setAttribute('aria-label', 'Close');
        button.innerHTML = closeHtml;
        head.appendChild(button);
    };
    dress();
    const dispose = () => { observer.disconnect(); redrawn.disconnect(); window.removeEventListener('resize', keep); el.removeEventListener('pointerdown', onDown); };
    const close = () => { dispose(); if (onClose) onClose(); else el.remove(); };
    const keep = () => apply(clampWindow({ left: el.offsetLeft, top: el.offsetTop }, sizeOf(), viewport()));
    const onDown = ev => {
        if (ev.button !== 0) return;
        if (ev.target.closest?.('[data-fw-close]')) { ev.preventDefault(); return close(); }
        const head = headOf();
        if (ev.target.closest?.(noDrag ? `${CONTROLS}, ${noDrag}` : CONTROLS)) return;
        if (!dragAnywhere && (!head || !head.contains(ev.target))) return;
        ev.preventDefault();
        const start = { x: ev.clientX, y: ev.clientY, left: el.offsetLeft, top: el.offsetTop };
        const previousSelect = document.body.style.userSelect;
        document.body.style.userSelect = 'none';
        el.classList.add('fw-dragging');
        const move = e => apply(clampWindow({ left: start.left + e.clientX - start.x, top: start.top + e.clientY - start.y }, sizeOf(), viewport()));
        const up = () => {
            document.body.style.userSelect = previousSelect;
            el.classList.remove('fw-dragging');
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };
    el.addEventListener('pointerdown', onDown);
    const redrawn = new MutationObserver(dress);
    redrawn.observe(el, { childList: true });
    const observer = new ResizeObserver(keep);
    observer.observe(el);
    window.addEventListener('resize', keep);
    return { close, place, dispose };
}
