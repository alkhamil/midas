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
const FORM = [
    { id: 'formName', name: 'formName', type: 'string', scope: 'page', initial: '' },
    { id: 'formEmail', name: 'formEmail', type: 'string', scope: 'page', initial: '' },
    { id: 'editingId', name: 'editingId', type: 'string', scope: 'page', initial: '' },
    { id: 'nextId', name: 'nextId', type: 'number', scope: 'page', initial: 100 },
    { id: 'formTitle', name: 'formTitle', type: 'string', scope: 'page', initial: 'Add user' },
];
const state = cleanState({ variables: [list, ...plan.variables, ...FORM.map(normalizeStateVariable)], derived: plan.derived });

const SEL = plan.ids.selected, SEL_COUNT = plan.ids.selectedCount;
const nodes = [];
const add = (...n) => nodes.push(...n);
// ---- the Input component (the search box is an instance of it) ----
add(frame('inputM', null, 'Input', { component: true, x: -900, y: -200, w: 240, h: 36, layout: 'horizontal', padding: 10, counterAlign: 'center', fill: '#ffffff', stroke: '#C9C9D1', strokeWidth: 1, radius: 8, layoutSizingH: 'fixed', layoutSizingV: 'hug', typeable: true, inputBehavior: { typeable: { frameId: 'inputMT', inputType: 'text' } } }));
add(text('inputMT', 'inputM', 'Placeholder', 'Search users…', { fill: '#888888' }));

// ---- a Button component (the row's Delete button is an instance of it) ----
add(frame('btnM', null, 'Button', { component: true, x: -900, y: -300, layout: 'horizontal', padT: 4, padB: 4, padL: 10, padR: 10, primaryAlign: 'center', counterAlign: 'center', fill: '#FDE7E9', radius: 6, layoutSizingH: 'hug', layoutSizingV: 'hug', vars: { fill: 'vBtnFill' }, varModes: { cBtn: 'mBtnDefault' } }));
add(text('btnMT', 'btnM', 'Label', 'Delete', { fill: '#B4232A', fontWeight: 600 }));

// ---- the Drawer (opened as an overlay by Add and Edit): two inputs bound to the form State, Save and Cancel ----
const inputInDrawer = (id, label, bindTo, rules, y) => [
    frame(id, 'drawerM', label, { isInstance: true, sourceId: 'inputM', typeable: true, layout: 'horizontal', padding: 10, counterAlign: 'center', fill: '#ffffff', stroke: '#C9C9D1', strokeWidth: 1, radius: 8, layoutSizingH: 'fill', layoutSizingV: 'hug', w: 288, overrides: { layoutSizingH: true },
        inputBehavior: { typeable: { frameId: id + 'T', inputType: 'text', bindTo }, validation: { rules, trigger: 'blur' } } }),
    text(id + 'T', id, 'Placeholder', label, { sourceId: 'inputMT', fill: '#888888', overrides: { text: true } }),
];
add(frame('drawerM', null, 'Drawer', { component: true, x: -1200, y: 0, w: 320, layout: 'vertical', gap: 12, padding: 16, fill: '#ffffff', stroke: '#E4E4EA', strokeWidth: 1, radius: 12, layoutSizingH: 'fixed', layoutSizingV: 'hug', stateBind: { layers: { drawerTitle: { text: 'template' } } } }));
add(text('drawerTitle', 'drawerM', 'Title', '{formTitle}', { fontSize: 16, fontWeight: 700 }));
add(...inputInDrawer('fName', 'Name', 'formName', { required: true }, 0));
add(...inputInDrawer('fEmail', 'Email', 'formEmail', { required: true, type: 'email' }, 0));
add(frame('drawerBtns', 'drawerM', 'Buttons', { layout: 'horizontal', gap: 8, padding: 0, primaryAlign: 'end', layoutSizingH: 'fill', layoutSizingV: 'hug', w: 288 }));
add(frame('cancelM', 'drawerBtns', 'Cancel', { isInstance: true, sourceId: 'btnM', layout: 'horizontal', padT: 4, padB: 4, padL: 10, padR: 10, primaryAlign: 'center', counterAlign: 'center', fill: '#F1F1F4', radius: 6, layoutSizingH: 'hug', layoutSizingV: 'hug', vars: { fill: 'vBtnFill' }, varModes: { cBtn: 'mBtnDefault' },
    interactions: [{ id: 'ixCancel', trigger: 'onClick', actions: [{ type: 'close-overlay', close: 'current' }] }] }));
add(text('cancelT', 'cancelM', 'Label', 'Cancel', { sourceId: 'btnMT', fill: '#333333', fontWeight: 600, overrides: { text: true } }));
// Save: validate both fields, Simulated request, then the outcome rules (invalid / failed / add / update)
add(frame('saveM', 'drawerBtns', 'Save', { isInstance: true, sourceId: 'btnM', layout: 'horizontal', padT: 4, padB: 4, padL: 12, padR: 12, primaryAlign: 'center', counterAlign: 'center', fill: '#0058CA', radius: 6, layoutSizingH: 'hug', layoutSizingV: 'hug', vars: { fill: 'vPrimaryFill' }, varModes: { cPrimary: 'mPrimary' },
    interactions: [{ id: 'ixSave', trigger: 'onClick', actions: [{ type: 'validate-field', fieldId: 'fName' }, { type: 'validate-field', fieldId: 'fEmail' }, { type: 'request', delay: 400 }],
        rules: { items: [
            { id: 'rInvalid', name: 'Invalid', if: { op: 'or', args: [{ op: 'invalid', field: 'fName' }, { op: 'invalid', field: 'fEmail' }] }, actions: [{ type: 'show-feedback', kind: 'alert', level: 'error', message: 'Please fix the highlighted fields.', duration: 3000 }] },
            { id: 'rFailed', name: 'Failed', if: { op: 'compare', cmp: 'eq', a: { op: 'var', ref: '$responseKind' }, b: { op: 'value', value: 'error' } }, actions: [{ type: 'show-feedback', kind: 'alert', level: 'error', message: 'Could not save. Your data is unchanged.', duration: 4000 }] },
            { id: 'rAdd', name: 'Add', if: { op: 'compare', cmp: 'eq', a: { op: 'var', ref: 'editingId' }, b: { op: 'value', value: '' } }, actions: [
                { type: 'list-add', listId: 'users', row: { id: { op: 'var', ref: 'nextId' }, name: { op: 'var', ref: 'formName' }, email: { op: 'var', ref: 'formEmail' }, role: { op: 'value', value: 'Viewer' } } },
                { type: 'set-state', variableId: 'nextId', op: 'increment', value: { op: 'value', value: 1 } },
                { type: 'show-feedback', kind: 'message', level: 'success', message: 'Added {formName}', duration: 2500 }, { type: 'close-overlay', close: 'current' }] },
            { id: 'rEdit', name: 'Edit', if: { op: 'compare', cmp: 'ne', a: { op: 'var', ref: 'editingId' }, b: { op: 'value', value: '' } }, actions: [
                { type: 'list-update', listId: 'users', where: { field: 'id', cmp: 'eq', value: { op: 'var', ref: 'editingId' } }, set: { name: { op: 'var', ref: 'formName' }, email: { op: 'var', ref: 'formEmail' } } },
                { type: 'show-feedback', kind: 'message', level: 'success', message: 'Saved {formName}', duration: 2500 }, { type: 'close-overlay', close: 'current' }] },
        ] } }] } ));
add(text('saveT', 'saveM', 'Label', 'Save', { sourceId: 'btnMT', fill: '#ffffff', fontWeight: 600, overrides: { text: true } }));

// ---- the Table component (master) ----
add(frame('tableM', null, 'Table', {
    component: true, x: -900, y: 0, w: 520, layout: 'vertical', gap: 8, padding: 12, fill: '#ffffff', stroke: '#E4E4EA', strokeWidth: 1, radius: 10,
    layoutSizingH: 'fixed', layoutSizingV: 'hug',
    behaviors: normalizeBehaviors([
        { id: 'bRows', kind: 'has-rows', enabled: true, slots: { ...(UNMAPPED ? {} : { row: 'rowM' }), header: 'hdrM', 'cell:name': 'cName', 'cell:email': 'cEmail', 'cell:role': 'cRole', 'head:name': 'hName', 'head:email': 'hEmail', 'head:role': 'hRole' }, config: { source: 'users', idField: 'id', pageSize: 10, vars: plan.ids } },
        { id: 'bSort', kind: 'can-sort', enabled: true, slots: {}, config: {} },
        { id: 'bSearch', kind: 'can-search', enabled: true, slots: { search: 'srchM' }, config: {} },
        { id: 'bPage', kind: 'has-pagination', enabled: true, slots: { prev: 'prevM', next: 'nextM', pageLabel: 'lblM' }, config: {} },
        { id: 'bSel', kind: 'has-selection', enabled: true, slots: { selectRow: 'chkM', selectAll: 'chkAllM' }, config: {} },
        { id: 'bActions', kind: 'has-row-actions', enabled: true, slots: { rowDelete: 'delM', rowEdit: 'editM', addButton: 'addM', bulkDelete: 'bulkM', reload: 'reloadM' }, config: {} },
        { id: 'bStates', kind: 'has-data-states', enabled: true, slots: { empty: 'emptyM', emptySearch: 'noResM', loading: 'loadM' }, config: {} },
    ]),
}));
add(frame('srchM', 'tableM', 'Search', { isInstance: true, sourceId: 'inputM', typeable: true, layout: 'horizontal', padding: 10, counterAlign: 'center', fill: '#ffffff', stroke: '#C9C9D1', strokeWidth: 1, radius: 8, layoutSizingH: 'fill', layoutSizingV: 'hug', w: 496, overrides: { layoutSizingH: true } }));
add(text('srchT', 'srchM', 'Placeholder', 'Search users…', { sourceId: 'inputMT', fill: '#888888', overrides: { text: true } }));
add(frame('hdrM', 'tableM', 'Header', { layout: 'horizontal', gap: 12, padding: 0, counterAlign: 'center', layoutSizingH: 'fill', layoutSizingV: 'hug', w: 496 }));
add(frame('chkAllM', 'hdrM', 'Select all', { w: 14, h: 14, fill: '#ffffff', stroke: '#9A9AA6', strokeWidth: 1, radius: 3 }));
add(text('hName', 'hdrM', 'Name', 'Name', { fontWeight: 700 }), text('hEmail', 'hdrM', 'Email', 'Email', { fontWeight: 700 }), text('hRole', 'hdrM', 'Role', 'Role', { fontWeight: 700 }));
add(frame('rowM', 'tableM', 'Row', { layout: 'horizontal', gap: 12, padding: 4, counterAlign: 'center', layoutSizingH: 'fill', layoutSizingV: 'hug', w: 496 }));
// Delete: its own interaction (composed from existing actions): a Popconfirm; its confirm removes THIS row (by id) and says so
add(frame('delM', 'rowM', 'Delete', { isInstance: true, sourceId: 'btnM', layout: 'horizontal', padT: 4, padB: 4, padL: 10, padR: 10, primaryAlign: 'center', counterAlign: 'center', fill: '#FDE7E9', radius: 6, layoutSizingH: 'hug', layoutSizingV: 'hug', vars: { fill: 'vBtnFill' }, varModes: { cBtn: 'mBtnDefault' },
    interactions: [{ id: 'ixDel', trigger: 'onClick', actions: [{ type: 'show-feedback', kind: 'popconfirm', level: 'warning', title: 'Delete this user?', message: '{row.name} will be removed from the list.', confirmLabel: 'Delete',
        onConfirm: [{ type: 'list-delete', listId: 'users', where: { field: 'id', cmp: 'eq', value: { op: 'var', ref: '$row.id' } } }, { type: 'show-feedback', kind: 'message', level: 'success', message: 'Deleted {row.name}', duration: 2000 }] }] }] }));
add(text('delT', 'delM', 'Label', 'Delete', { sourceId: 'btnMT', fill: '#B4232A', fontWeight: 600, overrides: { text: true } }));
// Reload: a Simulated request, then the outcome: an error keeps the list, an empty answer empties it, success restores the initial data
add(frame('reloadM', 'tableM', 'Reload', { isInstance: true, sourceId: 'btnM', layout: 'horizontal', padT: 6, padB: 6, padL: 12, padR: 12, primaryAlign: 'center', counterAlign: 'center', fill: '#F1F1F4', radius: 6, layoutSizingH: 'hug', layoutSizingV: 'hug', vars: { fill: 'vBtnFill' }, varModes: { cBtn: 'mBtnDefault' },
    interactions: [{ id: 'ixReload', trigger: 'onClick', actions: [{ type: 'request', delay: 400 }],
        rules: { items: [
            { id: 'rReloadFail', name: 'Failed', if: { op: 'compare', cmp: 'eq', a: { op: 'var', ref: '$responseKind' }, b: { op: 'value', value: 'error' } }, actions: [{ type: 'show-feedback', kind: 'alert', level: 'error', message: 'Reload failed. The list is unchanged.', duration: 4000 }] },
            { id: 'rReloadEmpty', name: 'Empty', if: { op: 'compare', cmp: 'eq', a: { op: 'var', ref: '$responseKind' }, b: { op: 'value', value: 'empty' } }, actions: [{ type: 'list-clear', listId: 'users' }, { type: 'show-feedback', kind: 'message', level: 'info', message: 'The server returned no rows', duration: 2500 }] },
        ], otherwise: { actions: [{ type: 'set-state', variableId: 'users', op: 'reset' }, { type: 'set-state', variableId: 'nextId', op: 'reset' }, { type: 'show-feedback', kind: 'message', level: 'success', message: 'Reloaded', duration: 2000 }] } } }] }));
add(text('reloadT', 'reloadM', 'Label', 'Reload', { sourceId: 'btnMT', fill: '#333333', fontWeight: 600, overrides: { text: true } }));
// Edit: prefills the drawer from this row, then opens it. Add: empties the drawer and opens it.
add(frame('editM', 'rowM', 'Edit', { isInstance: true, sourceId: 'btnM', layout: 'horizontal', padT: 4, padB: 4, padL: 10, padR: 10, primaryAlign: 'center', counterAlign: 'center', fill: '#E6F0FF', radius: 6, layoutSizingH: 'hug', layoutSizingV: 'hug', vars: { fill: 'vBtnFill' }, varModes: { cBtn: 'mBtnDefault' },
    interactions: [{ id: 'ixEdit', trigger: 'onClick', actions: [
        { type: 'set-state', variableId: 'formName', op: 'set', value: { op: 'var', ref: '$row.name' } },
        { type: 'set-state', variableId: 'formEmail', op: 'set', value: { op: 'var', ref: '$row.email' } },
        { type: 'set-state', variableId: 'editingId', op: 'set', value: { op: 'var', ref: '$row.id' } },
        { type: 'set-state', variableId: 'formTitle', op: 'set', value: { op: 'value', value: 'Edit user' } },
        { type: 'open-overlay', targetComponentId: 'drawerM', position: 'center', backdrop: true, closeOnBackdrop: true }] }] }));
add(text('editT', 'editM', 'Label', 'Edit', { sourceId: 'btnMT', fill: '#0058CA', fontWeight: 600, overrides: { text: true } }));
add(frame('addM', 'tableM', 'Add', { isInstance: true, sourceId: 'btnM', layout: 'horizontal', padT: 6, padB: 6, padL: 12, padR: 12, primaryAlign: 'center', counterAlign: 'center', fill: '#0058CA', radius: 6, layoutSizingH: 'hug', layoutSizingV: 'hug', vars: { fill: 'vPrimaryFill' }, varModes: { cPrimary: 'mPrimary' },
    interactions: [{ id: 'ixAdd', trigger: 'onClick', actions: [
        { type: 'set-state', variableId: 'formName', op: 'reset' },
        { type: 'set-state', variableId: 'formEmail', op: 'reset' },
        { type: 'set-state', variableId: 'formTitle', op: 'set', value: { op: 'value', value: 'Add user' } },
        { type: 'set-state', variableId: 'editingId', op: 'set', value: { op: 'value', value: '' } },
        { type: 'open-overlay', targetComponentId: 'drawerM', position: 'center', backdrop: true, closeOnBackdrop: true }] }] }));
add(text('addT', 'addM', 'Label', 'Add user', { sourceId: 'btnMT', fill: '#ffffff', fontWeight: 600, overrides: { text: true } }));
add(frame('chkM', 'rowM', 'Checkbox', { w: 14, h: 14, fill: '#ffffff', stroke: '#9A9AA6', strokeWidth: 1, radius: 3 }));
add(text('cName', 'rowM', 'Name', 'name', { fill: '#111111' }), text('cEmail', 'rowM', 'Email', 'email', { fill: '#555555' }), text('cRole', 'rowM', 'Role', 'role', { fill: '#555555' }));
// Bulk delete: shown only while rows are selected; its Popconfirm says how many, deletes the selected ids, clears the selection and confirms.
add(frame('bulkM', 'tableM', 'Delete selected', { isInstance: true, sourceId: 'btnM', layout: 'horizontal', padT: 4, padB: 4, padL: 10, padR: 10, primaryAlign: 'center', counterAlign: 'center', fill: '#FDE7E9', radius: 6, layoutSizingH: 'hug', layoutSizingV: 'hug', vars: { fill: 'vBtnFill' }, varModes: { cBtn: 'mBtnDefault' },
    stateBind: { self: { when: { op: 'compare', cmp: 'gt', a: { op: 'var', ref: SEL_COUNT }, b: { op: 'value', value: 0 } } } },
    interactions: [{ id: 'ixBulk', trigger: 'onClick', actions: [{ type: 'request', delay: 300 }],
        rules: { items: [{ id: 'rBulkFail', name: 'Failed', if: { op: 'compare', cmp: 'eq', a: { op: 'var', ref: '$responseKind' }, b: { op: 'value', value: 'error' } }, actions: [{ type: 'show-feedback', kind: 'alert', level: 'error', message: 'Could not delete. Your data is unchanged.', duration: 4000 }] }],
            otherwise: { actions: [{ type: 'show-feedback', kind: 'popconfirm', level: 'warning', title: 'Delete {selectedCount} rows?', message: 'The selected users will be removed from the list.', confirmLabel: 'Delete',
                onConfirm: [
                    { type: 'list-delete', listId: 'users', where: { field: 'id', cmp: 'in', value: { op: 'var', ref: SEL } } },
                    { type: 'show-feedback', kind: 'message', level: 'success', message: 'Deleted {selectedCount} rows', duration: 2000 },
                    { type: 'set-state', variableId: SEL, op: 'reset' }] }] } } }] }));
add(text('bulkT', 'bulkM', 'Label', 'Delete selected', { sourceId: 'btnMT', fill: '#B4232A', fontWeight: 600, overrides: { text: true } }));
add(frame('pagerM', 'tableM', 'Pager', { layout: 'horizontal', gap: 12, padding: 0, counterAlign: 'center', primaryAlign: 'end', layoutSizingH: 'fill', layoutSizingV: 'hug', w: 496 }));
add(text('prevM', 'pagerM', 'Prev', '‹ Prev', { fill: '#0058CA' }), text('lblM', 'pagerM', 'Page label', 'Page 1 of 3', { fill: '#555555' }), text('nextM', 'pagerM', 'Next', 'Next ›', { fill: '#0058CA' }));
add(text('emptyM', 'tableM', 'Empty', 'No data yet', { fill: '#999999' }), text('noResM', 'tableM', 'No results', 'No results for this search', { fill: '#999999' }), text('loadM', 'tableM', 'Loading', 'Loading…', { fill: '#0058CA' }));

// ---- an instance of the Table on the page, with a copy of every master layer (sourceId = the master layer) ----
const copyOf = (masterId, parentId) => {
    const m = nodes.find(n => n.id === masterId);
    const kids = nodes.filter(n => n.parentId === masterId);
    add({ ...m, id: `i_${m.id}`, parentId, component: undefined, behaviors: undefined, isInstance: m.isInstance ? true : undefined, sourceId: m.id, name: m.name, overrides: { text: true, layoutSizingH: true } });
    for (const c of kids) copyOf(c.id, `i_${m.id}`);
};
add(frame('tableI', 'page', 'Table', { isInstance: true, sourceId: 'tableM', x: 20, y: 20, w: 520, layout: 'vertical', gap: 8, padding: 12, fill: '#ffffff', stroke: '#E4E4EA', strokeWidth: 1, radius: 10, layoutSizingH: 'fixed', layoutSizingV: 'hug', overrides: { layoutSizingH: true } }));
for (const c of nodes.filter(n => n.parentId === 'tableM')) copyOf(c.id, 'tableI');
// the search box is a typeable field: its text layer (in this instance) is the one typed into
const sb = nodes.find(n => n.id === 'i_srchM'); if (sb) sb.inputBehavior = { typeable: { frameId: 'i_srchT', inputType: 'text' } };
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
    state, variables: { collections: [{ id: 'cBtn', name: 'Button states', modes: [{ id: 'mBtnDefault', name: 'Default' }, { id: 'mBtnHover', name: 'Hover' }], groups: [] }, { id: 'cPrimary', name: 'Primary button', modes: [{ id: 'mPrimary', name: 'Default' }], groups: [] }], items: [{ id: 'vPrimaryFill', collectionId: 'cPrimary', name: 'primary/fill', type: 'color', description: '', hidden: false, values: { mPrimary: '#0058CA' } }, { id: 'vBtnFill', collectionId: 'cBtn', name: 'button/fill', type: 'color', description: '', hidden: false, values: { mBtnDefault: '#FDE7E9', mBtnHover: '#F5A5AB' } }] },
};
fs.writeFileSync(process.argv[2] || 'crud-test.midas', JSON.stringify(doc));
console.log('wrote', nodes.length, 'nodes; list rows', list.initial.length);
