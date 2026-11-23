// A truncated Breadcrumb's ellipsis: a click in Play toggles the dropdown's root attribute; a disabled root ignores it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPress, OVERFLOW_ATTR } from '../src/prototype/press.js';

/** A minimal element: attributes in a map, `closest` by a predicate on the chain of parents. */
function element(attrs = {}, parent = null) {
    const el = {
        attrs: new Map(Object.entries(attrs)), parent,
        hasAttribute(n) { return this.attrs.has(n); },
        getAttribute(n) { return this.attrs.get(n) ?? null; },
        setAttribute(n, v) { this.attrs.set(n, v); },
        removeAttribute(n) { this.attrs.delete(n); },
        closest(sel) { for (let cur = this; cur; cur = cur.parent) if (sel === '[data-press]' ? cur.attrs.has('data-press') : sel === '[data-press-root]' ? cur.attrs.has('data-press-root') : false) return cur; return null; },
        querySelector() { return null; },
        querySelectorAll() { return []; },
    };
    return el;
}

test('the ellipsis opens the dropdown on the first click and closes it on the next', () => {
    const root = element({ 'data-press-root': '' });
    const ellipsis = element({ 'data-press': 'overflow' }, root);
    assert.equal(applyPress(ellipsis), true);
    assert.equal(root.hasAttribute(OVERFLOW_ATTR), true);
    assert.equal(applyPress(ellipsis), true);
    assert.equal(root.hasAttribute(OVERFLOW_ATTR), false);
});

test('a disabled row does not open its dropdown', () => {
    const root = element({ 'data-press-root': '', 'aria-disabled': 'true' });
    const ellipsis = element({ 'data-press': 'overflow' }, root);
    assert.equal(applyPress(ellipsis), false);
    assert.equal(root.hasAttribute(OVERFLOW_ATTR), false);
});
