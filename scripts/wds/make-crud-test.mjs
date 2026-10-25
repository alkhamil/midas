// Phase 4 check, step 1: a Table (component with Has rows, Can sort, Has pagination, Has selection, Has data states) placed as an
// instance on a page, over a List State of 25 generated users. node scripts/wds/make-crud-test.mjs <out.midas> [--empty] [--unmapped-row]
//   --empty         the List has no rows (checks the empty slot)
//   --unmapped-row  the row template slot is left out on purpose (checks the warning and that the behavior does not run)
import fs from 'fs';
import { generateRows, planTableState, normalizeStateVariable, cleanState, normalizeBehaviors } from '../../packages/builder-core/src/index.js';

const base = { rotation: 0, opacity: 1, visible: true, strokeWidth: 0, stroke: 'none', x: 0, y: 0 };
const frame = (id, parentId, name, extra = {}) => ({ ...base, id, type: 'frame', name, parentId, w: 100, h: 36, fill: 'none', clip: false, ...extra });
const text = (id, parentId, name, t, extra = {}) => ({ ...base, id, type: 'text', name, parentId, w: 80, h: 20, text: t, fill: '#111111', fontSize: 13, fontFamily: 'Inter', fontWeight: 500, autoW: true, lineHeight: 1.4, layoutSizingH: 'hug', layoutSizingV: 'hug', ...extra });

const schema = [
    { key: 'id', type: 'number' },
    { key: 'name', type: 'string', label: 'Name' },
    { key: 'email', type: 'string', label: 'Email' },
    { key: 'role', type: 'option', options: ['Admin', 'Editor', 'Viewer'], label: 'Role' },
];
const EMPTY = process.argv.includes('--empty'), UNMAPPED = process.argv.includes('--unmapped-row');
const list = normalizeStateVariable({ id: 'users', name: 'users', type: 'list', itemType: 'object', schema, initial: EMPTY ? [] : generateRows(schema, 25, { seed: 3, today: '2025-06-01' }) });
let k = 0;
const plan = planTableState({ variables: [list], derived: [] }, list, () => `v${++k}`, { pageSize: 10 });
const state = cleanState({ variables: [list, ...plan.variables], derived: plan.derived });

// ---- the Table component (master) ----
const nodes = [];
const add = (...n) => nodes.push(...n);
add(frame('tableM', null, 'Table', {
    component: true, x: -900, y: 0, w: 520, layout: 'vertical', gap: 8, padding: 12, fill: '#ffffff', stroke: '#E4E4EA', strokeWidth: 1, radius: 10,
    layoutSizingH: 'fixed', layoutSizingV: 'hug',
    behaviors: normalizeBehaviors([
        { id: 'bRows', kind: 'has-rows', enabled: true, slots: { ...(UNMAPPED ? {} : { row: 'rowM' }), header: 'hdrM', 'cell:name': 'cName', 'cell:email': 'cEmail', 'cell:role': 'cRole', 'head:name': 'hName', 'head:email': 'hEmail', 'head:role': 'hRole' }, config: { source: 'users', idField: 'id', pageSize: 10, vars: plan.ids } },
        { id: 'bSort', kind: 'can-sort', enabled: true, slots: {}, config: {} },
        { id: 'bPage', kind: 'has-pagination', enabled: true, slots: { prev: 'prevM', next: 'nextM', pageLabel: 'lblM' }, config: {} },
        { id: 'bSel', kind: 'has-selection', enabled: true, slots: { selectRow: 'chkM', selectAll: 'chkAllM' }, config: {} },
        { id: 'bStates', kind: 'has-data-states', enabled: true, slots: { empty: 'emptyM', emptySearch: 'noResM', loading: 'loadM' }, config: {} },
    ]),
}));
add(frame('hdrM', 'tableM', 'Header', { layout: 'horizontal', gap: 12, padding: 0, counterAlign: 'center', layoutSizingH: 'fill', layoutSizingV: 'hug', w: 496 }));
add(frame('chkAllM', 'hdrM', 'Select all', { w: 14, h: 14, fill: '#ffffff', stroke: '#9A9AA6', strokeWidth: 1, radius: 3 }));
add(text('hName', 'hdrM', 'Name', 'Name', { fontWeight: 700 }), text('hEmail', 'hdrM', 'Email', 'Email', { fontWeight: 700 }), text('hRole', 'hdrM', 'Role', 'Role', { fontWeight: 700 }));
add(frame('rowM', 'tableM', 'Row', { layout: 'horizontal', gap: 12, padding: 4, counterAlign: 'center', layoutSizingH: 'fill', layoutSizingV: 'hug', w: 496 }));
add(frame('chkM', 'rowM', 'Checkbox', { w: 14, h: 14, fill: '#ffffff', stroke: '#9A9AA6', strokeWidth: 1, radius: 3 }));
add(text('cName', 'rowM', 'Name', 'name', { fill: '#111111' }), text('cEmail', 'rowM', 'Email', 'email', { fill: '#555555' }), text('cRole', 'rowM', 'Role', 'role', { fill: '#555555' }));
add(frame('pagerM', 'tableM', 'Pager', { layout: 'horizontal', gap: 12, padding: 0, counterAlign: 'center', primaryAlign: 'end', layoutSizingH: 'fill', layoutSizingV: 'hug', w: 496 }));
add(text('prevM', 'pagerM', 'Prev', '‹ Prev', { fill: '#0058CA' }), text('lblM', 'pagerM', 'Page label', 'Page 1 of 3', { fill: '#555555' }), text('nextM', 'pagerM', 'Next', 'Next ›', { fill: '#0058CA' }));
add(text('emptyM', 'tableM', 'Empty', 'No data yet', { fill: '#999999' }), text('noResM', 'tableM', 'No results', 'No results for this search', { fill: '#999999' }), text('loadM', 'tableM', 'Loading', 'Loading…', { fill: '#0058CA' }));

// ---- an instance of the Table on the page, with a copy of every master layer (sourceId = the master layer) ----
const copyOf = (masterId, parentId) => {
    const m = nodes.find(n => n.id === masterId);
    const kids = nodes.filter(n => n.parentId === masterId);
    add({ ...m, id: `i_${m.id}`, parentId, component: undefined, behaviors: undefined, isInstance: undefined, sourceId: m.id, name: m.name, overrides: { text: true, layoutSizingH: true } });
    for (const c of kids) copyOf(c.id, `i_${m.id}`);
};
add(frame('tableI', 'page', 'Table', { isInstance: true, sourceId: 'tableM', x: 20, y: 20, w: 520, layout: 'vertical', gap: 8, padding: 12, fill: '#ffffff', stroke: '#E4E4EA', strokeWidth: 1, radius: 10, layoutSizingH: 'fixed', layoutSizingV: 'hug', overrides: { layoutSizingH: true } }));
for (const c of nodes.filter(n => n.parentId === 'tableM')) copyOf(c.id, 'tableI');
// the copies are instances' children: drop the master-only flags that copies should not carry
for (const n of nodes) if (n.id.startsWith('i_')) { delete n.component; }

// ---- the page the table sits on ----
nodes.push({ ...frame('page', null, 'Users page', { w: 600, h: 520, fill: '#f6f6f8', layout: 'vertical', gap: 12, padding: 24, layoutSizingH: 'fixed', layoutSizingV: 'fixed', stateBind: { layers: { selTxt: { text: 'template' } } } }) });
// reparent the instance under the page frame (it was added with parentId 'page' above)
const pageIdx = nodes.findIndex(n => n.id === 'page');
if (pageIdx > 0) nodes.unshift(nodes.splice(pageIdx, 1)[0]);
add(text('title', 'page', 'Title', 'Users', { fontSize: 22, fontWeight: 700 }));
add(text('selTxt', 'page', 'Selection', '{selectedCount} selected · {total} users', { fill: '#555555' }));
// the instance sits in the page's flow
const inst = nodes.find(n => n.id === 'tableI');
inst.parentId = 'page';

const doc = {
    format: 'midas', version: 1, behaviorVersion: 2, name: 'CRUD test', pageId: 'p1',
    pages: [{ id: 'p1', name: 'Page 1', nodes, parentId: null }], tokens: {}, guideStyles: [], created: Date.now(), assets: {},
    state, variables: { collections: [], items: [] },
};
fs.writeFileSync(process.argv[2] || 'crud-test.midas', JSON.stringify(doc));
console.log('wrote', nodes.length, 'nodes; list rows', list.initial.length);
