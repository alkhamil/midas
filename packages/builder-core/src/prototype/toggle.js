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
