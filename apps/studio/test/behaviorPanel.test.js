// Behavior tab panel: rows, section headers and the window shell (only the HTML they draw).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { itemRow, sectionBlock, windowHtml, splitOpen, ROW_ICON } from '../src/engine/behaviorPanelUi.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const icon = name => `<i data-i="${name}"></i>`;

test('splitOpen: "kind:key" (the key may hold colons)', () => {
    assert.deepEqual(splitOpen('interaction:i1'), { kind: 'interaction', key: 'i1' });
    assert.deepEqual(splitOpen('add:'), { kind: 'add', key: '' });
    assert.deepEqual(splitOpen('state:a:b'), { kind: 'state', key: 'a:b' });
    assert.deepEqual(splitOpen(''), { kind: '', key: '' });
});

test('an item row is one line: icon, name, summary; it opens its window', () => {
    const h = itemRow({ esc, icon, ic: 'play', name: 'On click', summary: 'Navigate → Home', open: 'interaction:i1' });
    assert.match(h, /data-bhw-open="interaction:i1"/);
    assert.match(h, /On click/);
    assert.match(h, /Navigate → Home/);
    assert.match(h, /data-i="play"/);
    assert.doesNotMatch(h, /bh-item-warn/);
    assert.doesNotMatch(h, /<form|<select|<input type="text"/);          // no forms inline
});

test('a warning shows as a mark with the reason; a toggle and a remove button live in the hover actions', () => {
    const h = itemRow({ esc, icon, ic: 'text', name: 'Can type', summary: 'Text', warn: 'Value is not set.', open: 'cap:can-type', toggle: { path: 'behaviors.0.enabled' }, remove: '<button data-bh-act="del-cap">x</button>' });
    assert.match(h, /class="bh-item-warn" title="Value is not set\."/);
    assert.match(h, /<span class="bh-item-acts"><input type="checkbox" data-bh-path="behaviors\.0\.enabled" data-bh-kind="bool" checked/);
    assert.match(h, /data-bh-act="del-cap"/);
});

test('an off item is dimmed, an inverted toggle (validation "off") is marked, a row without a window is static', () => {
    const off = itemRow({ esc, icon, ic: 'checkSquare', name: 'Has validation', summary: 'Required', on: false, toggle: { path: 'input.validation.off', invert: true } });
    assert.match(off, /class="bh-item off static /);
    assert.match(off, /data-bh-invert="1"/);
    assert.doesNotMatch(off, /checked/);
});

test('names and summaries are escaped', () => {
    const h = itemRow({ esc, icon, ic: 'play', name: '<b>x</b>', summary: 'a "q" & b', open: 'interaction:1' });
    assert.doesNotMatch(h, /<b>x<\/b>/);
    assert.match(h, /a &quot;q&quot; &amp; b/);
});

test('a section has a header with +, rows, or an empty hint', () => {
    const rows = [itemRow({ esc, icon, ic: 'play', name: 'A', summary: 'a', open: 'interaction:1' })];
    const s = sectionBlock({ esc, icon, title: 'Interactions', add: 'new-interaction:', addTitle: 'Add interaction', rows });
    assert.match(s, /section-heading"><span>Interactions<\/span>/);
    assert.match(s, /data-bhw-open="new-interaction:"/);
    assert.match(s, /bh-items/);
    const e = sectionBlock({ esc, icon, title: 'Behavior', add: 'add:', empty: 'Nothing yet.' });
    assert.match(e, /Nothing yet\./);
    assert.doesNotMatch(e, /bh-items/);
});

test('the window has a title bar with close (and back when drilled in) over a scrolling body', () => {
    const w = windowHtml({ esc, icon, title: 'On click', body: '<p>x</p>' });
    assert.match(w, /data-vw-drag/);
    assert.match(w, /data-bhw-close/);
    assert.doesNotMatch(w, /data-bhw-back/);
    assert.match(w, /<div class="bh-win-body"><p>x<\/p><\/div>/);
    assert.match(windowHtml({ esc, icon, title: 'Rules', back: true, body: '' }), /data-bhw-back/);
});

test('every kind of row has an icon', () => {
    for (const k of ['interaction', 'can-type', 'has-validation', 'has-options', 'opens-popup', 'shows-items', 'has-loading', 'show-feedback', 'state', 'repeat', 'bind']) assert.ok(ROW_ICON[k], k);
});

test('the Behavior tab no longer draws forms inline: Convention and feedback components moved into Behavior settings', () => {
    const src = fs.readFileSync(new URL('../src/engine/midas.js', import.meta.url), 'utf8');
    const start = src.indexOf('function prototypeHtml()'), end = src.indexOf('// ----- the window', start);
    const panel = src.slice(start, end);
    assert.ok(start > 0 && end > start);
    assert.doesNotMatch(panel, /conventionHtml|settingsHtml|componentButton|bhInteractionRows/);
});
