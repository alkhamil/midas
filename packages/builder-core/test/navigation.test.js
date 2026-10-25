// Tabs and Pagination: the pure rules (clicks, disabled tabs, page clamping, page size, ellipsis, edges).
import test from 'node:test';
import assert from 'node:assert/strict';
import { activeAfterClick, pageCountOf, pageAfter, pageItems, pagerEdges, normalizeConfig, CAPABILITIES, applicability, summaryOf, SLOT_ROLES } from '../src/index.js';

test('a click makes its tab active; an unknown or disabled tab leaves the active one', () => {
    const tabs = ['a', 'b', 'c'];
    assert.equal(activeAfterClick(tabs, 'a', 'b'), 'b');
    assert.equal(activeAfterClick(tabs, 'a', 'x'), 'a');
    assert.equal(activeAfterClick(tabs, 'a', 'c', ['c']), 'a');
});

test('the page count is at least one, even with no rows', () => {
    assert.equal(pageCountOf(0, 10), 1);
    assert.equal(pageCountOf(10, 10), 1);
    assert.equal(pageCountOf(11, 10), 2);
    assert.equal(pageCountOf(25, 0), 25);             // a size of 0 is treated as 1
});

test('the page clamps when the total shrinks; a new page size goes back to page 1', () => {
    assert.equal(pageAfter(5, 10, 25), 3);            // 3 pages left
    assert.equal(pageAfter(0, 10, 25), 1);
    assert.equal(pageAfter(2, 10, 0), 1);
    assert.equal(pageAfter(4, 20, 100, { sizeChanged: true }), 1);
});

test('page numbers: all of them when few; ellipses for long ranges; the ends and the current page always shown', () => {
    assert.deepEqual(pageItems(1, 5), [1, 2, 3, 4, 5]);
    assert.deepEqual(pageItems(1, 20), [1, 2, 3, 4, 5, '…', 20]);
    assert.deepEqual(pageItems(10, 20), [1, '…', 9, 10, 11, '…', 20]);
    assert.deepEqual(pageItems(20, 20), [1, '…', 16, 17, 18, 19, 20]);
});

test('Prev and Next are disabled at the edges', () => {
    assert.deepEqual(pagerEdges(1, 3), { prevDisabled: true, nextDisabled: false });
    assert.deepEqual(pagerEdges(3, 3), { prevDisabled: false, nextDisabled: true });
    assert.deepEqual(pagerEdges(1, 1), { prevDisabled: true, nextDisabled: true });
});

test('Tabs and Pager configs are kept clean', () => {
    assert.deepEqual(normalizeConfig('has-tabs', { state: 'activeTab', junk: 1 }), { state: 'activeTab' });
    assert.deepEqual(normalizeConfig('has-pager', { vars: { page: 'p', bad: 'x' }, pageSize: 0 }), { vars: { page: 'p' }, pageSize: 10 });
});

test('the new capabilities and roles are known and summarised', () => {
    assert.equal(CAPABILITIES['has-tabs'].label, 'Has tabs');
    assert.equal(CAPABILITIES['has-pager'].label, 'Has pager');
    assert.ok(SLOT_ROLES.tab && SLOT_ROLES.panel && SLOT_ROLES.pageSize && SLOT_ROLES.jump && SLOT_ROLES.total);
    assert.equal(summaryOf({ kind: 'has-pager', config: { vars: { page: 'p' }, pageSize: 10 }, slots: {} }, id => 'Page'), 'Page State “Page” · 10 per page');
});

test('a standalone pager needs no table; Tabs need no table either', () => {
    assert.equal(applicability('has-tabs', { has: () => false }).ok, true);
    assert.equal(applicability('has-pager', { has: () => false }).ok, true);
});
