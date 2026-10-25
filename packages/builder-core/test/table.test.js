// Table behaviors: capabilities and slots, the model Preview draws, the State writes of each click, auto-suggested mapping.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeBehaviors, resolveBehaviors, normalizeOverrides, slotIssues, applicability, summaryOf, planPreset, PRESETS, PRESET_MAP, CAPABILITIES,
    tableBehaviors, tableRoles, tableView, sortWrites, pageWrites, searchWrites, toggleRowWrites, selectPageWrites, rowCtxOf, cellBinds,
    suggestColumnSlots, suggestSlots, cleanConvention, createEvalCtx, planTableState, normalizeStateVariable, cleanState, generateRows,
} from '../src/index.js';

const schema = [{ key: 'id', type: 'number' }, { key: 'name', type: 'string', label: 'Full name' }, { key: 'email', type: 'string', label: 'E-mail' }, { key: 'role', type: 'option', options: ['Admin', 'Editor', 'Viewer'] }];
function setup({ n = 25, pageSize = 10, slots = {}, extraKinds = true } = {}) {
    let k = 0;
    const list = normalizeStateVariable({ id: 'users', name: 'users', type: 'list', itemType: 'object', schema, initial: generateRows(schema, n, { seed: 2 }) });
    const plan = planTableState({ variables: [list], derived: [] }, list, () => `v${++k}`, { pageSize });
    const state = cleanState({ variables: [list, ...plan.variables], derived: plan.derived });
    const mk = (kind, extra = {}) => ({ kind, enabled: true, slots: {}, config: {}, ...extra });
    const behaviors = normalizeBehaviors([
        mk('has-rows', { slots: { row: 'row', header: 'hdr', 'cell:name': 'cName', 'cell:email': 'cEmail', 'head:name': 'hName', ...slots }, config: { source: 'users', idField: 'id', pageSize, vars: plan.ids } }),
        ...(extraKinds ? [mk('can-sort'), mk('can-search', { slots: { search: 'q' } }), mk('has-pagination', { slots: { prev: 'prev', next: 'next', pageLabel: 'lbl' } }), mk('has-selection', { slots: { selectRow: 'chk', selectAll: 'chkAll' } }), mk('has-data-states', { slots: { empty: 'empty', emptySearch: 'noRes', loading: 'load' } })] : []),
    ]);
    return { ev: createEvalCtx(state), by: tableBehaviors(behaviors), ids: plan.ids, behaviors, state };
}
const apply = (ev, writes) => { for (const x of writes) assert.equal(ev.set(x.id, x.value).ok, true); };

test('table capabilities: slots, dynamic column slots, config, overrides and the Table preset', () => {
    assert.ok(['has-rows', 'can-sort', 'can-search', 'has-pagination', 'has-selection', 'has-row-actions', 'has-data-states'].every(k => CAPABILITIES[k]));
    const [b] = normalizeBehaviors([{ kind: 'has-rows', slots: { row: 'r', 'cell:name': 'c1', 'head:Full-name': 'h1', 'cell:bad key': 'x', junk: 'y' }, config: { source: 'u', pageSize: '25', vars: { visible: 'd1', nope: 'z' }, searchColumns: ['name', 3] } }]);
    assert.deepEqual(b.slots, { row: 'r', 'cell:name': 'c1', 'head:Full-name': 'h1' });
    assert.deepEqual(b.config, { source: 'u', idField: 'id', pageSize: 25, vars: { visible: 'd1' }, searchColumns: ['name', '3'] });
    assert.deepEqual(normalizeBehaviors([{ kind: 'can-sort', slots: { 'cell:name': 'x' } }])[0].slots, {});          // dynamic slots belong to Has rows only
    assert.equal(normalizeBehaviors([{ kind: 'has-rows', config: { pageSize: -3 } }])[0].config.pageSize, 10);
    assert.deepEqual(normalizeOverrides({ a: { slots: { 'cell:name': 'z', nope: 'q' } } }), { a: { slots: { 'cell:name': 'z' } } });
    const merged = resolveBehaviors([{ id: 'a', kind: 'has-rows', slots: { row: 'r', 'cell:name': 'c' } }], { a: { slots: { 'cell:name': 'c2' } } });
    assert.equal(merged[0].slots['cell:name'], 'c2');
    const plan = planPreset('table');
    assert.deepEqual(plan.behaviors.map(x => x.kind), ['has-rows', 'can-sort', 'can-search', 'has-pagination', 'has-selection', 'has-row-actions', 'has-data-states']);
    assert.equal(PRESET_MAP.table.family, 'Data');
    assert.ok(PRESETS.find(p => p.id === 'table').match.includes('table'));
});

test('Has rows needs a List and a row template; the others need Has rows', () => {
    assert.deepEqual(applicability('has-rows', { layers: [], hasList: false }), { ok: false, reason: 'It needs a List State with the rows (Variables → State → List).' });
    assert.equal(applicability('has-rows', { layers: [], hasList: true, has: () => false }).ok, true);
    assert.match(applicability('can-sort', { layers: [], has: () => false }).reason, /needs Has rows/);
    assert.equal(applicability('can-sort', { layers: [], has: k => k === 'has-rows' }).ok, true);
    const rows = normalizeBehaviors([{ kind: 'has-rows', slots: {}, config: {} }])[0];
    assert.deepEqual(slotIssues(rows).map(i => i.role), ['row', 'source']);
    const ok = normalizeBehaviors([{ kind: 'has-rows', slots: { row: 'r' }, config: { source: 'u', vars: { visible: 'd' } } }])[0];
    assert.deepEqual(slotIssues(ok), []);
    assert.match(summaryOf(ok, id => (id === 'u' ? 'users' : id)), /Rows of “users” · 10 per page/);
});

test('roles: every mapped layer knows what it is', () => {
    const { by } = setup();
    const roles = tableRoles(by);
    assert.equal(roles.get('row'), 'row'); assert.equal(roles.get('cName'), 'cell:name'); assert.equal(roles.get('hName'), 'head:name');
    assert.equal(roles.get('prev'), 'prev'); assert.equal(roles.get('chk'), 'selectRow'); assert.equal(roles.get('noRes'), 'emptySearch'); assert.equal(roles.get('q'), 'search');
    assert.equal(tableBehaviors([{ kind: 'can-sort', enabled: true }]), null);
    assert.equal(tableBehaviors([{ kind: 'has-rows', enabled: false }]), null);
});

test('the model of a table: the first page, totals, columns with their layers', () => {
    const { ev, by } = setup();
    const m = tableView(by, ev);
    assert.equal(m.ok, true);
    assert.equal(m.rows.length, 10); assert.equal(m.total, 25); assert.equal(m.pages, 3); assert.equal(m.page, 1); assert.equal(m.rowOffset, 0); assert.equal(m.sourceTotal, 25);
    assert.deepEqual(m.columns.map(c => [c.key, c.label, c.cell, c.head]), [['id', 'id', '', ''], ['name', 'Full name', 'cName', 'hName'], ['email', 'E-mail', 'cEmail', ''], ['role', 'role', '', '']]);
    assert.deepEqual(cellBinds(m), { cName: { text: 'name' }, cEmail: { text: 'email' } });
    assert.equal(m.empty, ''); assert.equal(m.pageState, 'none'); assert.equal(m.flags.sort && m.flags.search && m.flags.pagination && m.flags.selection && m.flags.states, true);
    assert.equal(rowCtxOf(m, m.rows[3], 3).rowIndex, 4);
});

test('clicking a header: ascending, descending, none, and back to page 1', () => {
    const { ev, by, ids } = setup();
    apply(ev, pageWrites(tableView(by, ev), 2));                                   // page 3
    assert.equal(tableView(by, ev).page, 3);
    apply(ev, sortWrites(tableView(by, ev), 'name'));
    let m = tableView(by, ev);
    assert.equal(m.sort, 'name:asc'); assert.equal(m.page, 1);
    const names = m.rows.map(r => r.name), all = [...ev.get('users')].map(r => r.name).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    assert.deepEqual(names, all.slice(0, 10));
    apply(ev, sortWrites(m, 'name')); assert.equal(tableView(by, ev).sort, 'name:desc');
    apply(ev, sortWrites(tableView(by, ev), 'name')); assert.equal(tableView(by, ev).sort, '');
    apply(ev, sortWrites(tableView(by, ev), 'email')); assert.equal(ev.get(ids.sort), 'email:asc');
});

test('pagination: next / previous stay inside the pages; a page past the end is pulled back', () => {
    const { ev, by } = setup();
    apply(ev, pageWrites(tableView(by, ev), -1)); assert.equal(tableView(by, ev).page, 1);
    apply(ev, pageWrites(tableView(by, ev), 1)); apply(ev, pageWrites(tableView(by, ev), 1)); apply(ev, pageWrites(tableView(by, ev), 1));
    let m = tableView(by, ev);
    assert.equal(m.page, 3); assert.equal(m.rows.length, 5); assert.equal(m.rowOffset, 20);
    assert.equal(rowCtxOf(m, m.rows[0], 0).rowIndex, 21);
    apply(ev, pageWrites(m, 2, false)); assert.equal(tableView(by, ev).page, 2);   // go to page 2
});

test('search filters, counts and goes back to page 1; no results is told apart from no data', () => {
    const { ev, by } = setup();
    apply(ev, pageWrites(tableView(by, ev), 2));
    const pick = ev.get('users')[7].name.split(' ')[0];
    apply(ev, searchWrites(tableView(by, ev), pick.toUpperCase()));
    let m = tableView(by, ev);
    assert.equal(m.page, 1); assert.ok(m.total >= 1 && m.total < 25); assert.equal(m.empty, '');
    assert.ok(m.rows.every(r => Object.values(r).some(v => String(v).toLowerCase().includes(pick.toLowerCase()))));
    apply(ev, searchWrites(m, 'zzzzzz'));
    m = tableView(by, ev);
    assert.equal(m.rows.length, 0); assert.equal(m.empty, 'search'); assert.equal(m.total, 0); assert.equal(m.pages, 1);
    assert.equal(tableView(by, ev, { forceEmpty: true }).empty, 'data');
    const none = setup({ n: 0 });
    assert.equal(tableView(none.by, none.ev).empty, 'data');                         // a List with no rows at all
});

test('selection: a row checkbox toggles by id; the header checkbox is for the current page only', () => {
    const { ev, by, ids } = setup();
    let m = tableView(by, ev);
    apply(ev, toggleRowWrites(m, m.rows[1]));
    m = tableView(by, ev);
    assert.equal(m.pageState, 'some'); assert.deepEqual(m.selected, [String(m.rows[1].id)]);
    apply(ev, selectPageWrites(m));
    m = tableView(by, ev);
    assert.equal(m.pageState, 'all'); assert.equal(ev.get(ids.selectedCount), 10);
    apply(ev, pageWrites(m, 1));
    m = tableView(by, ev);
    assert.equal(m.pageState, 'none'); assert.equal(ev.get(ids.selectedCount), 10);   // page 2 starts unselected, page 1 keeps its picks
    apply(ev, selectPageWrites(m)); assert.equal(ev.get(ids.selectedCount), 20);
    apply(ev, selectPageWrites(tableView(by, ev))); assert.equal(ev.get(ids.selectedCount), 10);    // all selected: clears this page only
    assert.equal(rowCtxOf(tableView(by, ev), tableView(by, ev).rows[0], 0).isSelected, false);
});

test('a table that is not set up says what is missing instead of guessing', () => {
    const { ev, by } = setup();
    by['has-rows'].config.source = '';
    assert.match(tableView(by, ev).issues[0], /not set or is gone/);
    by['has-rows'].config.source = 'users'; by['has-rows'].config.vars = {};
    assert.match(tableView(by, ev).issues[0], /Set up table State/);
    by['has-rows'].config.vars = { visible: 'nope' };
    assert.match(tableView(by, ev).issues[0], /Set up table State/);
});

test('auto-suggest: a layer named like a column (its key or header text) is proposed for it; one layer per column', () => {
    const cols = [{ key: 'name', label: 'Full name' }, { key: 'email', label: 'E-mail' }, { key: 'role', label: 'role' }, { key: 'createdAt', label: 'Created' }];
    const layers = [{ id: 'a', name: 'Full name', type: 'text' }, { id: 'b', name: 'Email', type: 'text' }, { id: 'c', name: 'Role cell', type: 'frame' }, { id: 'd', name: 'Created', type: 'text' }, { id: 'e', name: 'Actions', type: 'frame' }, { id: 'f', name: 'Name', type: 'text' }];
    const got = Object.fromEntries(suggestColumnSlots(cols, layers).map(s => [s.key, s.layerId]));
    assert.deepEqual(got, { name: 'a', email: 'b', role: 'c', createdAt: 'd' });
    assert.deepEqual(suggestColumnSlots(cols, layers, new Set(['a', 'b'])).map(s => s.key).sort(), ['createdAt', 'name', 'role']);          // taken layers are left alone (name falls to "Name")
    assert.deepEqual(suggestColumnSlots([{ key: 'zzz' }], layers), []);
});

test('auto-suggest of the other table slots uses the Convention', () => {
    const roles = ['row', 'header', 'search', 'prev', 'next', 'pageLabel', 'selectAll', 'selectRow', 'rowDelete', 'rowEdit', 'addButton', 'empty', 'emptySearch', 'loading'].map(role => ({ role, kind: 'any' }));
    const layers = [{ id: '1', name: 'Table row', type: 'frame' }, { id: '2', name: 'Header', type: 'frame' }, { id: '3', name: 'Search', type: 'frame' }, { id: '4', name: 'Previous', type: 'frame' }, { id: '5', name: 'Next', type: 'frame' }, { id: '6', name: 'Page label', type: 'text' }, { id: '7', name: 'Select all', type: 'frame' }, { id: '8', name: 'Row checkbox', type: 'frame' }, { id: '9', name: 'Delete', type: 'frame' }, { id: '10', name: 'Edit', type: 'frame' }, { id: '11', name: 'Add', type: 'frame' }, { id: '12', name: 'Empty', type: 'frame' }, { id: '13', name: 'Loading', type: 'frame' }];
    const got = Object.fromEntries(suggestSlots(roles, layers, cleanConvention({})).map(s => [s.role, s.layerId]));
    assert.deepEqual(got, { row: '1', header: '2', search: '3', prev: '4', next: '5', pageLabel: '6', selectAll: '7', selectRow: '8', rowDelete: '9', rowEdit: '10', addButton: '11', empty: '12', loading: '13' });
});
