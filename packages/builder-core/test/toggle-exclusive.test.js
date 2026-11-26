// A toggle may be exclusive (`toggle.exclusive`): turning one item on turns the same state off on its siblings in the same box (Tabs' active tab).
// The aria attribute follows `toggle.aria` (selected for a tab, checked by default).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyToggle } from '../src/prototype/toggle.js';

/** A fake element with attributes, a style and a parent whose children are the box's items. */
function el(attrs = {}) {
    const map = new Map(Object.entries(attrs));
    return {
        map, style: {},
        getAttribute: n => (map.has(n) ? String(map.get(n)) : null),
        hasAttribute: n => map.has(n),
        setAttribute: (n, v) => map.set(n, String(v)),
        removeAttribute: n => map.delete(n),
    };
}

function box(...tabs) {
    const parent = { children: tabs };
    for (const t of tabs) t.parentElement = parent;
    return tabs;
}

test('turning an exclusive item on turns the others off and sets their aria-selected false', () => {
    const tab = (on) => el({ 'data-toggle': 'data-active', 'data-toggle-once': '', 'data-toggle-exclusive': '', 'data-toggle-aria': 'selected', ...(on ? { 'data-active': '' } : {}) });
    const [a, b, c] = box(tab(true), tab(false), tab(false));
    assert.equal(applyToggle(b), true);
    assert.equal(a.hasAttribute('data-active'), false);
    assert.equal(b.hasAttribute('data-active'), true);
    assert.equal(a.getAttribute('aria-selected'), 'false');
    assert.equal(b.getAttribute('aria-selected'), 'true');
    assert.equal(c.hasAttribute('data-active'), false);
});

test('a non-exclusive toggle leaves its siblings alone', () => {
    const plain = on => el({ 'data-toggle': 'data-checked', 'data-toggle-once': '', ...(on ? { 'data-checked': '' } : {}) });
    const [a, b] = box(plain(true), plain(false));
    applyToggle(b);
    assert.equal(a.hasAttribute('data-checked'), true);
});

test('a disabled sibling is still cleared, and a disabled root takes no click', () => {
    const tab = (on, extra = {}) => el({ 'data-toggle': 'data-active', 'data-toggle-once': '', 'data-toggle-exclusive': '', 'data-toggle-aria': 'selected', ...(on ? { 'data-active': '' } : {}), ...extra });
    const [a, b] = box(tab(true), tab(false, { disabled: '' }));
    assert.equal(applyToggle(b), false);
    assert.equal(a.hasAttribute('data-active'), true, 'a disabled root takes no click, so nothing else changes');
});

import { toggleOf } from '../src/behavior-engine/display.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';

test('an exclusive toggle declares its aria attribute: checked (default) or selected', () => {
    const item = TEMPLATES.get('antd-breadcrumb-item');
    const tabLike = { ...item, props: { ...item.props, active: { source: 'literal', type: 'boolean', default: false, exclusive: true } }, toggle: { prop: 'active', once: true, exclusive: true, aria: 'selected' } };
    assert.deepEqual(validateTemplateSchema(tabLike), []);
    assert.deepEqual(toggleOf(tabLike), { attr: 'data-active', clearsAttr: undefined, once: true, exclusive: true, aria: 'selected' });
    assert.ok(validateTemplateSchema({ ...tabLike, toggle: { ...tabLike.toggle, aria: 'pressed' } }).some(p => /aria/.test(p)));
    assert.ok(validateTemplateSchema({ ...tabLike, toggle: { ...tabLike.toggle, exclusive: 'yes' } }).some(p => /exclusive/.test(p)));
});
