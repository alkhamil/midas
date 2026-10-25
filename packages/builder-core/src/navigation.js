// Navigation families (Tabs, Pagination, and later Steps, Collapse, Menu, Carousel): the pure rules behind their State.
// No layers, no drawing here. The Preview and the Behavior tab call these with the values they hold. Pure.

/** The tab that is active after a click: the clicked tab, unless it is unknown or disabled (then it stays). */
export function activeAfterClick(tabs, current, key, disabled = []) {
    if (!tabs.includes(key) || disabled.includes(key)) return current;
    return key;
}

/** How many pages there are (at least one, even with no rows). */
export function pageCountOf(total, pageSize) {
    const size = Math.max(1, Math.floor(Number(pageSize)) || 1);
    return Math.max(1, Math.ceil(Math.max(0, Number(total) || 0) / size));
}

/** The page after a change: clamped to the pages that exist. A new page size goes back to page 1. */
export function pageAfter(page, pageSize, total, { sizeChanged = false } = {}) {
    if (sizeChanged) return 1;
    return Math.min(Math.max(1, Math.floor(Number(page)) || 1), pageCountOf(total, pageSize));
}

/** Page numbers to draw, with '…' for the gaps: at most `max` entries, the current page and both ends always shown. */
export function pageItems(current, pageCount, max = 7) {
    const last = Math.max(1, pageCount);
    if (last <= max) return Array.from({ length: last }, (_, i) => i + 1);
    const cur = Math.min(Math.max(1, current), last);
    const out = new Set([1, last, cur - 1, cur, cur + 1]);
    if (cur <= 4) [2, 3, 4, 5].forEach(n => out.add(n));
    if (cur >= last - 3) [last - 4, last - 3, last - 2, last - 1].forEach(n => out.add(n));
    const pages = [...out].filter(n => n >= 1 && n <= last).sort((a, b) => a - b);
    const items = [];
    pages.forEach((n, i) => { if (i && n - pages[i - 1] > 1) items.push('…'); items.push(n); });
    return items;
}

/** Prev / Next: whether each is disabled at the edges. */
export function pagerEdges(page, pageCount) {
    return { prevDisabled: page <= 1, nextDisabled: page >= Math.max(1, pageCount) };
}
