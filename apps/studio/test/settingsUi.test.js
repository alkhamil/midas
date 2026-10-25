// Behavior settings window: Convention edits and what the three tabs draw.
import test from 'node:test';
import assert from 'node:assert/strict';
import { editConvention, resetConvention, tokenRows, settingsWindowHtml, tokenTableHtml } from '../src/engine/settingsUi.js';
import { cleanConvention, DEFAULT_CONVENTION } from '../src/engine/behavior.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ctx = conv => ({ esc, convention: cleanConvention(conv), componentButton: (p, v, l) => `<btn data-p="${p}" data-v="${v}">${l}</btn>` });
const ui = (o = {}) => ({ tab: 'slots', q: '', adding: '', expanded: new Set(), ...o });

test('adding a name normalizes it, ignores a duplicate, and keeps the rest', () => {
    let c = editConvention({}, { op: 'add', group: 'slots', key: 'value', word: 'Email Address' });
    assert.ok(c.slots.value.includes('email address'));
    assert.deepEqual(c.slots.value.slice(0, 5), DEFAULT_CONVENTION.slots.value);
    c = editConvention(c, { op: 'add', group: 'slots', key: 'value', word: 'EMAIL address' });
    assert.equal(c.slots.value.filter(w => w === 'email address').length, 1);
    assert.deepEqual(editConvention(c, { op: 'add', group: 'slots', key: 'value', word: '   ' }).slots.value, c.slots.value);
});

test('removing a name drops it; an emptied role falls back to its defaults; unknown roles change nothing', () => {
    let c = editConvention({}, { op: 'remove', group: 'states', key: 'error', word: 'invalid' });
    assert.deepEqual(c.states.error, ['error', 'danger']);
    for (const w of ['error', 'danger']) c = editConvention(c, { op: 'remove', group: 'states', key: 'error', word: w });
    assert.deepEqual(c.states.error, DEFAULT_CONVENTION.states.error);
    assert.deepEqual(editConvention({}, { op: 'add', group: 'slots', key: 'nope', word: 'x' }), cleanConvention({}));
});

test('reset only touches the tab it is on: the feedback mapping survives a slots reset', () => {
    const c = { slots: { value: ['mine'] }, states: { error: ['bad'] }, feedback: { alert: 'comp1' } };
    assert.deepEqual(resetConvention(c, 'slots').slots, DEFAULT_CONVENTION.slots);
    assert.equal(resetConvention(c, 'slots').feedback.alert, 'comp1');
    assert.deepEqual(resetConvention(c, 'slots').states.error, ['bad']);
    assert.deepEqual(resetConvention(c, 'states').states, DEFAULT_CONVENTION.states);
    assert.equal(resetConvention(c, 'feedback').feedback.alert, '');
    assert.deepEqual(resetConvention(c, 'feedback').slots.value, ['mine']);
});

test('search finds a role or one of its names', () => {
    const c = cleanConvention({});
    assert.deepEqual(tokenRows(c, 'slots', 'placeholder'), ['placeholder']);
    assert.ok(tokenRows(c, 'slots', 'dismiss').includes('close'));
    assert.equal(tokenRows(c, 'slots', '').length, Object.keys(c.slots).length);
    assert.deepEqual(tokenRows(c, 'slots', 'zzzz'), []);
});

test('Slots tab: a compact row per role, 3 tokens and +N, a + button, a search box, one line of help', () => {
    const h = settingsWindowHtml(ctx({}), ui());
    assert.match(h, /data-bhs-tab="slots"/);
    assert.match(h, /data-bhs-q/);
    assert.equal((h.match(/class="bhs-help"/g) || []).length, 1);
    const value = h.match(/<div class="bhs-row[^"]*"><span class="bhs-role" title="value">[\s\S]*?<\/span><\/div>/)[0];
    assert.equal((value.match(/data-bhs-rm=/g) || []).length, 3);          // value has 5 names: 3 shown
    assert.match(value, />\+2</);
    assert.match(value, /data-bhs-add="slots\.value"/);
    // expanded: all 5 and a way back
    const open = tokenTableHtml(ctx({}), ui({ expanded: new Set(['slots.value']) }));
    assert.match(open.match(/title="value">[\s\S]*?<\/span><\/div>/)[0], /less/);
    // tokens carry their name in a tooltip, and the add field replaces the + while typing
    assert.match(h, /title="value: click to remove"/);
    assert.match(tokenTableHtml(ctx({}), ui({ adding: 'slots.value' })), /data-bhs-new="slots\.value"/);
});

test('States tab uses the same table; the search narrows it', () => {
    const h = settingsWindowHtml(ctx({}), ui({ tab: 'states', q: 'load' }));
    assert.match(h, /data-bhs-rm="states\.loading\|busy"/);
    assert.doesNotMatch(h, /data-bhs-rm="states\.hover/);
    assert.match(settingsWindowHtml(ctx({}), ui({ tab: 'states', q: 'zzz' })), /Nothing matches/);
});

test('Feedback tab: one row per kind, a built-in badge until a component is mapped, no search box', () => {
    const h = settingsWindowHtml(ctx({ feedback: { modal: 'm1' } }), ui({ tab: 'feedback' }));
    for (const k of ['Alert', 'Message', 'Notification', 'Modal', 'Drawer', 'Popconfirm']) assert.match(h, new RegExp(`<b>${k}</b>`));
    assert.equal((h.match(/bhs-badge/g) || []).length, 5);                  // Modal is mapped
    assert.match(h, /data-p="convention\.feedback\.modal" data-v="m1"/);
    assert.doesNotMatch(h, /data-bhs-q/);
});

test('every tab ends with Reset to defaults for that tab, and names are escaped', () => {
    for (const tab of ['slots', 'states', 'feedback']) assert.match(settingsWindowHtml(ctx({}), ui({ tab })), new RegExp(`data-bh-scope="${tab}">Reset ${tab} to defaults`));
    const evil = settingsWindowHtml(ctx({ slots: { value: ['<img onerror=1>'] } }), ui());
    assert.doesNotMatch(evil, /<img/);
});
