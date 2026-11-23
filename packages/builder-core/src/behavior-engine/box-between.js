// The row a box lays out when its items are truncated: the first and the last item always show. With the truncation on, the items between them are
// hidden, and the ellipsis stands where they were, after the separator before the first hidden item. Gap i is the separator before item i (gap 0 is none).
// Pure over a count, so the studio's sync and the tests use the same rule.

/**
 * @param {number} count the items in the box
 * @param {{ truncated: boolean }} options
 * @returns {{ items: { visible: boolean }[], gaps: { visible: boolean }[], ellipsis: boolean, hidden: number[] }}
 */
export function betweenPlan(count, { truncated }) {
    const hidden = truncated && count >= 3 ? Array.from({ length: count - 2 }, (_, k) => k + 1) : [];
    const hiddenSet = new Set(hidden);
    const items = Array.from({ length: count }, (_, i) => ({ visible: !hiddenSet.has(i) }));
    // A gap before a hidden item goes with it, except the first one (it sits before the ellipsis) and the one before the last item.
    const gaps = Array.from({ length: count }, (_, i) => ({ visible: i >= 1 && !(hidden.length && i >= 2 && i <= count - 2) }));
    return { items, gaps, ellipsis: hidden.length > 0, hidden };
}

/**
 * The anatomy layers a box makes itself between its items (a slot's separator layer and its ellipsis). They are not stubs an instance holds from its
 * props: the sync makes them, so the instance never holds one at its root.
 * @param {{ slots?: any[] }} template
 * @returns {string[]}
 */
export function boxLayerIdsOf(template) {
    return (template.slots ?? []).flatMap(s => [s.between?.layer, s.overflow?.layer]).filter(id => id !== undefined);
}
