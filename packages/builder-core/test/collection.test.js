// Collections: columns, CSV / JSON in, generated rows, filter / sort / paginate, selection, row changes, the row context.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    parseCSV, rowsFromCSV, rowsFromJSON, inferSchema, fitToSchema, toCSV, generateRows, rng, parseSort, sortText, nextSort, sortRows, filterRows, paginate, visibleRows,
    toggleId, setPageSelection, pageSelectionState, pruneSelection, addRow, updateRow, deleteRows, nextId, rowContext, resolveRowRef, resolveRowName, rowRefsOf, planTableState,
    normalizeStateVariable, cleanState, columnLabel,
} from '../src/index.js';

const schema = [{ key: 'id', type: 'number' }, { key: 'name', type: 'string' }, { key: 'role', type: 'option', options: ['Admin', 'Editor', 'Viewer'] }, { key: 'active', type: 'boolean' }, { key: 'createdAt', type: 'date' }, { key: 'amount', type: 'number' }];
const rows = [
    { id: 1, name: 'Ana Pratama', role: 'Editor', active: true, createdAt: '2024-03-01', amount: 120.5 },
    { id: 2, name: 'budi Santoso', role: 'Admin', active: false, createdAt: '2023-12-15', amount: 9 },
    { id: 3, name: 'Citra Wijaya', role: 'Viewer', active: true, createdAt: '2024-03-01', amount: 1200 },
    { id: 4, name: 'Dewi Lestari', role: 'Admin', active: true, createdAt: '', amount: 45 },
    { id: 5, name: 'Eka Hidayat', role: 'Editor', active: false, createdAt: '2022-01-09', amount: 45 },
];

// ---------------- columns, import, generate ----------------
test('schema fields keep their label and options (and nothing else)', () => {
    const v = normalizeStateVariable({ id: 'u', name: 'Users', type: 'list', itemType: 'object', schema: [{ key: 'role', type: 'option', options: ['a', 'a', 'b'], label: ' Role ', junk: 1 }, { key: 'n', type: 'number', options: ['x'] }], initial: [] });
    assert.deepEqual(v.schema, [{ key: 'role', type: 'option', label: 'Role', options: ['a', 'b'] }, { key: 'n', type: 'number' }]);
    assert.equal(columnLabel(v.schema[0]), 'Role');
    assert.equal(columnLabel(v.schema[1]), 'n');
    assert.deepEqual(cleanState({ variables: [v], derived: [] }).variables[0].schema, v.schema);        // idempotent
});

test('CSV: quotes, doubled quotes, line breaks in a cell, other separators', () => {
    assert.deepEqual(parseCSV('a,b\n1,"x, y"\r\n2,"he said ""hi"""\n'), [['a', 'b'], ['1', 'x, y'], ['2', 'he said "hi"']]);
    assert.deepEqual(parseCSV('a;b\n1;2'), [['a', 'b'], ['1', '2']]);
    assert.deepEqual(parseCSV('a\tb\n1\t2'), [['a', 'b'], ['1', '2']]);
    assert.deepEqual(parseCSV('a,b\n"line\nbreak",2'), [['a', 'b'], ['line\nbreak', '2']]);
    assert.deepEqual(parseCSV(''), []);
});

test('CSV import infers number, boolean, date, option and string columns; headers become keys and labels', () => {
    const text = 'id,Full name,Role,Active,Created at,Amount\n1,Ana,Admin,true,2024-01-02,10.5\n2,Budi,Editor,false,2024-02-03,20\n3,Citra,Admin,yes,2024-03-04,30\n4,Dewi,Editor,no,2024-04-05,40';
    const r = rowsFromCSV(text);
    assert.deepEqual(r.schema.map(f => [f.key, f.type]), [['id', 'number'], ['Full-name', 'string'], ['Role', 'option'], ['Active', 'boolean'], ['Created-at', 'date'], ['Amount', 'number']]);
    assert.equal(r.schema[1].label, 'Full name');
    assert.deepEqual(r.schema[2].options, ['Admin', 'Editor']);
    assert.deepEqual(r.rows[2], { id: 3, 'Full-name': 'Citra', Role: 'Admin', Active: true, 'Created-at': '2024-03-04', Amount: 30 });
    assert.deepEqual(r.problems, []);
    assert.match(rowsFromCSV('a,b\n1,2,3').problems[0], /Row 1 has 3 cells/);
    assert.deepEqual(rowsFromCSV('').rows, []);
});

test('JSON import: a list, or an object holding one; bad input says why', () => {
    const r = rowsFromJSON('[{"name":"Ana","age":31,"vip":true},{"name":"Budi","age":"40"}]');
    assert.deepEqual(r.schema.map(f => [f.key, f.type]), [['name', 'string'], ['age', 'number'], ['vip', 'boolean']]);
    assert.deepEqual(r.rows[1], { name: 'Budi', age: 40, vip: false });
    assert.equal(rowsFromJSON('{"data":[{"a":1}]}').rows.length, 1);
    assert.match(rowsFromJSON('{oops').problems[0], /not valid JSON/);
    assert.match(rowsFromJSON('{"x":1}').problems[0], /list of objects/);
    assert.match(rowsFromJSON('[1,2]').problems[0], /objects/);
    assert.match(rowsFromJSON('[{"a":1}, 5]').problems[0], /1 items were not objects/);
});

test('rows made to fit given columns; CSV out', () => {
    assert.deepEqual(fitToSchema([{ key: 'name', type: 'string' }, { key: 'n', type: 'number' }], [{ name: 'A', n: '7', extra: 1 }, {}]), [{ name: 'A', n: 7 }, { name: '', n: 0 }]);
    assert.match(toCSV(schema, rows.slice(0, 2)), /^id,name,role,active,createdAt,amount\n1,Ana Pratama,Editor,true,2024-03-01,120.5/);
    assert.equal(toCSV([{ key: 'a', type: 'string' }], [{ a: 'x,"y"' }]), 'a\n"x,""y"""');
});

test('generated rows: right count, types, options, ids, realistic and deterministic', () => {
    const cols = [{ key: 'id', type: 'number' }, { key: 'name', type: 'string' }, { key: 'email', type: 'string' }, { key: 'role', type: 'option', options: ['Admin', 'Editor', 'Viewer'] }, { key: 'status', type: 'option', options: [] }, { key: 'createdAt', type: 'date' }, { key: 'amount', type: 'number' }, { key: 'active', type: 'boolean' }];
    const a = generateRows(cols, 25, { seed: 7, today: '2025-06-01' }), b = generateRows(cols, 25, { seed: 7, today: '2025-06-01' });
    assert.equal(a.length, 25);
    assert.deepEqual(a, b);
    assert.notDeepEqual(a, generateRows(cols, 25, { seed: 8, today: '2025-06-01' }));
    assert.deepEqual(a.map(r => r.id), Array.from({ length: 25 }, (_, i) => i + 1));
    for (const r of a) {
        assert.ok(['Admin', 'Editor', 'Viewer'].includes(r.role));
        assert.ok(['Active', 'Pending', 'Disabled'].includes(r.status));
        assert.match(r.email, /^[a-z]+\.[a-z]+@[a-z]+\.com$/);
        assert.equal(r.email.split('@')[0], r.name.toLowerCase().replace(/ /g, '.'));       // the e-mail matches the name
        assert.match(r.createdAt, /^\d{4}-\d{2}-\d{2}$/);
        assert.ok(r.createdAt <= '2025-06-01' && r.createdAt >= '2023-05-31');
        assert.ok(r.amount >= 10 && r.amount <= 5000 && Math.abs(Math.round(r.amount * 100) - r.amount * 100) < 1e-6);
        assert.equal(typeof r.active, 'boolean');
    }
    assert.equal(generateRows(cols, 0).length, 0);
    assert.equal(generateRows(cols, 6000).length, 5000);
    assert.equal(generateRows(cols, 3, { startId: 100 })[2].id, 102);
    const next = rng(3), x = next(), y = next();
    assert.ok(x >= 0 && x < 1 && x !== y);
});

test('inferSchema takes the union of keys', () => {
    assert.deepEqual(inferSchema([{ a: 1 }, { b: 'x' }]).map(f => f.key), ['a', 'b']);
});

// ---------------- sort ----------------
test('click on a header cycles ascending, descending, none; another column starts ascending', () => {
    assert.equal(nextSort('', 'name'), 'name:asc');
    assert.equal(nextSort('name:asc', 'name'), 'name:desc');
    assert.equal(nextSort('name:desc', 'name'), '');
    assert.equal(nextSort('name:desc', 'role'), 'role:asc');
    assert.deepEqual(parseSort('amount:desc'), { key: 'amount', dir: 'desc' });
    assert.equal(parseSort(''), null);
    assert.equal(sortText({ key: 'a', dir: 'desc' }), 'a:desc');
});

test('sort by type: numbers as numbers, text ignoring case, dates, booleans, options in their order', () => {
    const ids = s => sortRows(rows, schema, s).map(r => r.id);
    assert.deepEqual(ids('amount:asc'), [2, 4, 5, 1, 3]);                  // 9 < 45 = 45 < 120.5 < 1200 (not text order)
    assert.deepEqual(ids('amount:desc'), [3, 1, 4, 5, 2]);                 // ties keep their order (stable) in both directions
    assert.deepEqual(ids('name:asc'), [1, 2, 3, 4, 5]);                    // "budi" sits between Ana and Citra
    assert.deepEqual(ids('name:desc'), [5, 4, 3, 2, 1]);
    assert.deepEqual(ids('createdAt:asc'), [5, 2, 1, 3, 4]);               // the empty date goes last
    assert.deepEqual(ids('createdAt:desc'), [1, 3, 2, 5, 4]);              // ties keep their order; the empty date is still last
    assert.deepEqual(ids('active:asc'), [2, 5, 1, 3, 4]);
    assert.deepEqual(ids('role:asc'), [2, 4, 1, 5, 3]);                    // Admin, Editor, Viewer: the order of the options
    assert.deepEqual(ids(''), [1, 2, 3, 4, 5]);
    assert.deepEqual(ids('nope:asc'), [1, 2, 3, 4, 5]);                    // an unknown column leaves the order alone
    assert.equal(rows[0].id, 1);                                           // the source is not changed
});

test('numbers in text sort naturally (item 2 before item 10)', () => {
    const s = [{ key: 't', type: 'string' }], r = [{ t: 'item 10' }, { t: 'item 2' }, { t: 'item 1' }];
    assert.deepEqual(sortRows(r, s, 't:asc').map(x => x.t), ['item 1', 'item 2', 'item 10']);
});

// ---------------- filter ----------------
test('search finds text anywhere in the chosen columns (or all), ignoring case', () => {
    assert.deepEqual(filterRows(rows, schema, { search: 'ANA' }).map(r => r.id), [1]);
    assert.deepEqual(filterRows(rows, schema, { search: 'admin' }).map(r => r.id), [2, 4]);
    assert.deepEqual(filterRows(rows, schema, { search: 'admin', columns: ['name'] }).map(r => r.id), []);
    assert.deepEqual(filterRows(rows, schema, { search: '  ' }).length, 5);
    assert.deepEqual(filterRows(rows, schema, { search: '45' }).map(r => r.id), [4, 5]);
    assert.deepEqual(filterRows(rows, schema, { search: 'zzz' }), []);
});

test('column filters: one value or several, combined with the search', () => {
    assert.deepEqual(filterRows(rows, schema, { filters: { role: 'Admin' } }).map(r => r.id), [2, 4]);
    assert.deepEqual(filterRows(rows, schema, { filters: { role: ['Admin', 'Viewer'] } }).map(r => r.id), [2, 3, 4]);
    assert.deepEqual(filterRows(rows, schema, { filters: { role: 'Admin', active: true } }).map(r => r.id), [4]);
    assert.deepEqual(filterRows(rows, schema, { search: 'dewi', filters: { role: 'Editor' } }), []);
    assert.equal(filterRows(rows, schema, { filters: { role: '' } }).length, 5);
});

// ---------------- paginate ----------------
test('pages: slices, the last page is shorter, the page stays inside 1 to pages', () => {
    const list = Array.from({ length: 25 }, (_, i) => ({ i }));
    assert.deepEqual([paginate(list, 1, 10).rows.length, paginate(list, 3, 10).rows.length, paginate(list, 3, 10).pages], [10, 5, 3]);
    assert.equal(paginate(list, 99, 10).page, 3);
    assert.equal(paginate(list, 0, 10).page, 1);
    assert.equal(paginate(list, -4, 10).page, 1);
    assert.equal(paginate(list, 'x', 10).page, 1);
    assert.deepEqual(paginate([], 5, 10), { rows: [], page: 1, pages: 1, total: 0, pageSize: 10 });
    assert.equal(paginate(list, 1, 0).rows.length, 25);                    // page size 0 = everything
    assert.equal(paginate(list, 2, 25).page, 1);
    // deleting the only row of the last page lands on the new last page
    const after = list.slice(0, 20);
    assert.deepEqual([paginate(after, 3, 10).page, paginate(after, 3, 10).rows.length], [2, 10]);
});

test('visibleRows: filter, then sort, then page; reports the totals the table shows', () => {
    const many = generateRows(schema, 25, { seed: 5, today: '2025-01-01' });
    const v = visibleRows(many, schema, { sort: 'amount:desc', page: 2, pageSize: 10 });
    assert.equal(v.rows.length, 10); assert.equal(v.total, 25); assert.equal(v.pages, 3); assert.equal(v.sourceTotal, 25);
    assert.deepEqual(v.rows, sortRows(many, schema, 'amount:desc').slice(10, 20));
    // search narrows the total, and a page past the end is pulled back
    const s = visibleRows(many, schema, { search: 'admin', page: 9, pageSize: 10 });
    assert.equal(s.total, many.filter(r => r.role === 'Admin').length);
    assert.equal(s.page, 1);
    assert.deepEqual(visibleRows(many, schema, { search: 'zzz' }).rows, []);
    assert.equal(visibleRows(null, schema).sourceTotal, 0);
});

// ---------------- selection ----------------
test('selection by id: toggle, select all on the current page only, state of the header checkbox', () => {
    const page1 = rows.slice(0, 3), page2 = rows.slice(3);
    let sel = [];
    assert.equal(pageSelectionState(sel, page1, 'id'), 'none');
    sel = toggleId(sel, 2);
    assert.deepEqual(sel, ['2']);
    assert.equal(pageSelectionState(sel, page1, 'id'), 'some');
    sel = setPageSelection(sel, page1, 'id', true);
    assert.deepEqual([...sel].sort(), ['1', '2', '3']);
    assert.equal(pageSelectionState(sel, page1, 'id'), 'all');
    assert.equal(pageSelectionState(sel, page2, 'id'), 'none');            // page 2 is untouched
    assert.deepEqual(setPageSelection(sel, page2, 'id', true).sort(), ['1', '2', '3', '4', '5']);
    assert.deepEqual(setPageSelection(sel, page1, 'id', false), []);
    assert.deepEqual(setPageSelection(['9'], page1, 'id', false), ['9']);   // another page's pick stays
    assert.deepEqual(toggleId(['2'], 2), []);
    assert.equal(pageSelectionState(['1'], [], 'id'), 'none');
    assert.deepEqual(pruneSelection(['1', '2', '9'], rows, 'id'), ['1', '2']);
});

// ---------------- add / update / delete ----------------
test('add: missing and clashing ids get the next free one; fields the columns lack are dropped', () => {
    const next = addRow(rows, schema, 'id', { name: 'Fajar', role: 'Viewer', junk: 1, amount: '12' });
    assert.equal(next.length, 6);
    assert.deepEqual(next[5], { id: 6, name: 'Fajar', role: 'Viewer', active: false, createdAt: '', amount: 12 });
    assert.equal(addRow(rows, schema, 'id', { id: 3, name: 'x' })[5].id, 6);        // 3 is taken
    assert.equal(addRow(rows, schema, 'id', { id: 50, name: 'x' })[5].id, 50);
    assert.equal(rows.length, 5);
    assert.equal(nextId([], 'id'), 1);
    assert.equal(nextId(rows, 'id', 'string'), '6');
});

test('update changes only that row and never its id; delete removes by id (one or many)', () => {
    const u = updateRow(rows, schema, 'id', 2, { name: 'Budi S', id: 99, amount: '15' });
    assert.deepEqual(u[1], { ...rows[1], name: 'Budi S', amount: 15 });
    assert.deepEqual(u.filter((r, i) => i !== 1), rows.filter((r, i) => i !== 1));
    assert.deepEqual(updateRow(rows, schema, 'id', 77, { name: 'x' }), rows);
    assert.deepEqual(deleteRows(rows, 'id', 3).map(r => r.id), [1, 2, 4, 5]);
    assert.deepEqual(deleteRows(rows, 'id', ['1', 5]).map(r => r.id), [2, 3, 4]);
    assert.deepEqual(deleteRows(rows, 'id', []).length, 5);
});

// ---------------- row context ----------------
test('row context: row.<field>, rowIndex, isSelected for references and {placeholders}', () => {
    const ctx = rowContext(rows[0], 1, ['1', '3'], 'id');
    assert.deepEqual(ctx, { row: rows[0], rowIndex: 1, isSelected: true });
    assert.equal(rowContext(rows[1], 2, ['1'], 'id').isSelected, false);
    assert.deepEqual(resolveRowRef('$row.name', ctx), { found: true, value: 'Ana Pratama' });
    assert.deepEqual(resolveRowRef('$row.nope', ctx), { found: false });
    assert.deepEqual(resolveRowRef('$rowIndex', ctx), { found: true, value: 1 });
    assert.deepEqual(resolveRowRef('$isSelected', ctx), { found: true, value: true });
    assert.deepEqual(resolveRowRef('$row.name', null), { found: false });
    assert.equal(resolveRowRef('something', ctx), null);
    assert.deepEqual(resolveRowName('row.name', ctx), { found: true, value: 'Ana Pratama' });
    assert.deepEqual(resolveRowName(' rowIndex ', ctx), { found: true, value: 1 });
    assert.deepEqual(resolveRowName('isSelected', ctx), { found: true, value: true });
    assert.equal(resolveRowName('total', ctx), null);
    assert.equal(resolveRowName('row.name', null), null);
    assert.deepEqual(rowRefsOf({ type: 'list', itemType: 'object', schema: [{ key: 'name', type: 'string', label: 'Full name' }] }).map(x => x[0]), ['$rowIndex', '$isSelected', '$row.name']);
});

// ---------------- the State of a table ----------------
test('a table gets plain State: search, sort, page, pageSize, selection; derived rows and totals', () => {
    let n = 0;
    const list = normalizeStateVariable({ id: 'users', name: 'users', type: 'list', itemType: 'object', schema, initial: rows });
    const state = { variables: [list], derived: [] };
    const plan = planTableState(state, list, () => `x${++n}`, { pageSize: 2 });
    assert.deepEqual(plan.variables.map(v => v.name), ['search', 'sort', 'page', 'pageSize', 'selectedIds']);
    assert.deepEqual(plan.derived.map(v => v.name), ['visibleRows', 'total', 'pageCount', 'selectedCount']);
    assert.equal(plan.variables[3].initial, 2);
    const full = cleanState({ variables: [list, ...plan.variables], derived: plan.derived });
    assert.equal(full.variables.length, 6);
    assert.equal(full.derived.length, 4);
    // a second table does not clash with the names of the first
    const again = planTableState(full, list, () => `y${++n}`);
    assert.deepEqual(again.variables.map(v => v.name), ['search 2', 'sort 2', 'page 2', 'pageSize 2', 'selectedIds 2']);
});
