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

/** The page sizes a pager offers, in order. */
export const PAGE_SIZES = [10, 20, 50];
/** The next page size after `size` (wraps around; an unknown size starts again at the first). */
export function nextPageSize(size, sizes = PAGE_SIZES) {
    const i = sizes.indexOf(Number(size));
    return sizes[(i + 1) % sizes.length];
}

/** The state of step i (0-based) while `current` is the step in progress: before it completed, the current one active (or error), after it upcoming. These are the Midas states named like that. */
export function stepStatus(i, current, failed = false) {
    if (i < current) return 'completed';
    if (i === current) return failed ? 'error' : 'active';
    return 'upcoming';
}
/** The step after Next (+1) or Prev (-1): kept inside the steps. Next is refused while the step cannot be left (its gate is closed). */
export function stepAfter(current, delta, count, canLeave = true) {
    if (delta > 0 && !canLeave) return current;
    return Math.min(Math.max(0, current + delta), Math.max(0, count - 1));
}

/** The open sections of a Collapse, from its State: one key (accordion) or comma-separated keys (multiple). */
export function openSections(value, mode) {
    const text = String(value ?? '');
    if (mode === 'multiple') return text.split(',').map(s => s.trim()).filter(Boolean);
    return text ? [text] : [];
}
/** The open sections after a click on `key`: an accordion keeps one open (a click on the open one closes it); multiple toggles it. */
export function toggleOpen(open, key, mode) {
    const on = open.includes(key);
    if (mode === 'multiple') return on ? open.filter(k => k !== key) : [...open, key];
    return on ? [] : [key];
}

/** Prev / Next: whether each is disabled at the edges. */
export function pagerEdges(page, pageCount) {
    return { prevDisabled: page <= 1, nextDisabled: page >= Math.max(1, pageCount) };
}
