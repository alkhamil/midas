// The step a click takes on a toggle control (pure). The state is what the root's attributes say now; the options are the template's `toggle` (see toggleOf).
// Play applies the result to the root's attributes; nothing here touches a DOM or a document.

/**
 * @param {{ checked: boolean, indeterminate: boolean }} state the state before the click
 * @param {{ once: boolean, clears?: boolean }} options `once`: the click only turns the state on (a radio); `clears`: the template has a second state (indeterminate) that the click ends
 * @returns {{ checked: boolean, indeterminate: boolean }}
 */
export function nextToggle(state, { once, clears = false }) {
    return { checked: once ? true : !state.checked, indeterminate: clears ? false : state.indeterminate };
}

/**
 * A click on a toggle control's root (Play): flips the state attributes the root carries, as `nextToggle` says, and brings the rest of the DOM in line with them:
 * aria-checked, and the alignment attribute and style of a root that moves its content (a Switch's handle). The glyphs need nothing: the stylesheet shows them from the state attributes. Nothing happens
 * while the root is disabled. The root says what to flip in data attributes (see dom-tree.js), so no template is read here.
 * @param {{ getAttribute(n: string): string | null, hasAttribute(n: string): boolean, setAttribute(n: string, v: string): void, removeAttribute(n: string): void, style: Record<string, string> }} root
 * @returns {boolean} whether the root is a toggle that took the click
 */
export function applyToggle(root) {
    const attr = root.getAttribute('data-toggle');
    if (!attr || root.hasAttribute('disabled') || root.getAttribute('aria-disabled') === 'true') return false;
    const clearsAttr = root.getAttribute('data-toggle-clears');
    const next = nextToggle({ checked: root.hasAttribute(attr), indeterminate: clearsAttr ? root.hasAttribute(clearsAttr) : false }, { once: root.hasAttribute('data-toggle-once'), clears: clearsAttr !== null });
    const write = (name, on) => (on ? root.setAttribute(name, '') : root.removeAttribute(name));
    write(attr, next.checked);
    if (clearsAttr) write(clearsAttr, next.indeterminate);
    root.setAttribute('aria-checked', next.indeterminate ? 'mixed' : String(next.checked));
    const align = `${attr}-align`;
    if (root.hasAttribute(align)) {
        const side = next.checked ? 'end' : 'start';
        root.setAttribute(align, side);
        root.style.justifyContent = `flex-${side}`;
    }
    return true;
}

/**
 * A click on a toggle control's root in Play: flips the state like applyToggle, and glides each child the flip moved
 * (a Switch's handle) from its old spot to its new one. Justification cannot transition, so the travel is a FLIP
 * animation over the template's 0.2s ease-in-out; children that did not move (glyphs, icons) animate nothing.
 * Distances are in the element's own px (see the scale below). A child that also changes size at the click (the pressed handle, grown while held, returns to its size as the button is released) moves and resizes in
 * the same animation: its own width transition is suspended while the end layout is measured, so the child neither shrinks in place first nor
 * travels at the wrong size. The glide keeps the edge the alignment anchors (the far edge of a handle that ends at the end of the track).
 * Reduced motion skips the glide. Returns what applyToggle returns.
 * @param {{ getAttribute(n: string): string | null, hasAttribute(n: string): boolean, setAttribute(n: string, v: string): void, removeAttribute(n: string): void, style: Record<string, string>, children?: { style?: Record<string, string>, getBoundingClientRect?: () => { left: number, width?: number }, animate?: (frames: object[], opts: object) => void }[], ownerDocument?: { defaultView?: { matchMedia?: (query: string) => { matches: boolean } } | null } | null }} root
 * @returns {boolean} whether the root is a toggle that took the click
 */
export function flipToggle(root) {
    // Element.children is an HTMLCollection, which has no map: copy it into an array first.
    const kids = Array.from(root.children ?? []);
    // Play scales its stage (a fit mode is a CSS scale), so a client rect is in screen px while the animation is in the element's own px: divide by the scale,
    // read as the root's client width over its layout width.
    const rootRect = root.getBoundingClientRect?.();
    const k = rootRect?.width > 0 && root.offsetWidth > 0 ? rootRect.width / root.offsetWidth : 1;
    const rectOf = el => { const r = el.getBoundingClientRect?.(); return { left: (r?.left ?? 0) / k, width: (r?.width ?? 0) / k }; };
    const before = new Map(kids.map(el => [el, rectOf(el)]));
    if (!applyToggle(root)) return false;
    if (root.ownerDocument?.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return true;
    const anchoredEnd = root.style.justifyContent === 'flex-end';
    for (const [el, from] of before) {
        // The end layout, measured with the child's own transition suspended so a width still easing back from the press does not count.
        const held = el.style?.transition;
        if (el.style) el.style.transition = 'none';
        const to = rectOf(el);
        if (el.style) el.style.transition = held ?? '';
        const dx = from.left - to.left;
        if (dx === 0 || typeof el.animate !== 'function') continue;
        const dw = to.width - from.width;
        // Width changes about the anchored edge, so the left edge's offset follows it: the glide interpolates the left edge from its old to its new place.
        const shift = dw !== 0 && anchoredEnd ? dx - (to.width - from.width) : dx;
        const first = dw !== 0 ? { transform: `translateX(${shift}px)`, width: `${from.width}px` } : { transform: `translateX(${shift}px)` };
        const last = dw !== 0 ? { transform: 'translateX(0px)', width: `${to.width}px` } : { transform: 'translateX(0px)' };
        el.animate([first, last], { duration: 200, easing: 'ease-in-out' });
    }
    return true;
}
