// The Data window of a List State: what the grid draws.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dataWindowHtml } from '../src/engine/dataUi.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const list = { id: 'u', name: 'users', type: 'list', itemType: 'object', schema: [{ key: 'id', type: 'number' }, { key: 'name', type: 'string', label: 'Full name' }, { key: 'role', type: 'option', options: ['Admin', 'Editor'] }, { key: 'active', type: 'boolean' }, { key: 'at', type: 'date' }], initial: [{ id: 1, name: 'Ana', role: 'Admin', active: true, at: '2024-01-02' }, { id: 2, name: '<b>x</b>', role: 'Editor', active: false, at: '' }] };
const ui = (o = {}) => ({ import: null, generate: 25, ...o });

test('one header block per column (name, type, header text, options for an option column) and one cell editor per type', () => {
    const h = dataWindowHtml({ esc }, list, ui());
    assert.equal((h.match(/data-dw-f="rename"/g) || []).length, 5);
    assert.equal((h.match(/data-dw-f="type"/g) || []).length, 5);
    assert.equal((h.match(/data-dw-f="options"/g) || []).length, 1);                      // only the option column
    assert.match(h, /data-dw-f="label" data-dw-key="name" value="Full name"/);
    assert.match(h, /<input type="number"[^>]*data-dw-cell="0\|id"/);
    assert.match(h, /<input type="checkbox" data-dw-cell="0\|active"[^>]* checked/);
    assert.match(h, /<input type="date" data-dw-cell="0\|at"/);
    assert.match(h, /<select data-dw-cell="1\|role"[^>]*>[\s\S]*?<option value="Editor" selected>/);
    assert.equal((h.match(/data-dw-act="del-row"/g) || []).length, 2);
    assert.match(h, /2 rows · 5 columns/);
});

test('values are escaped; the last column cannot be removed; an empty list says what to do', () => {
    assert.doesNotMatch(dataWindowHtml({ esc }, list, ui()), /<b>x<\/b>/);
    const one = dataWindowHtml({ esc }, { ...list, schema: [{ key: 'a', type: 'string' }], initial: [] }, ui());
    assert.match(one, /data-dw-act="del-col" data-dw-key="a" disabled/);
    assert.match(one, /No rows yet/);
});

test('the toolbar: rows, columns, generate N, clear, import, export; the import panel shows its note', () => {
    const h = dataWindowHtml({ esc }, list, ui({ generate: 40 }));
    for (const a of ['add-row', 'add-col', 'generate', 'clear', 'import-open', 'export']) assert.match(h, new RegExp(`data-dw-act="${a}"`));
    assert.match(h, /data-dw-n value="40"/);
    assert.doesNotMatch(h, /data-dw-text/);
    const imp = dataWindowHtml({ esc }, list, ui({ import: { kind: 'json', text: '[1]', keep: true, append: false, ok: false, note: 'The list holds no objects' } }));
    assert.match(imp, /data-dw-text/);
    assert.match(imp, /class="dw-note bad">The list holds no objects/);
    assert.match(imp, /name="dw-cols" data-dw-opt="keep" value="1" checked/);
    assert.match(imp, /accept="\.json/);
});
