// A table as Preview runs it: which layers play which role, the model of what is shown right now (rows of this page, totals, selection)
// and the State writes each click makes. Pure: the host (Preview) draws the model and applies the writes to its State.
import { columnLabel, nextSort, parseSort, pageSelectionState, rowContext, setPageSelection, toggleId, idKey, idOf } from './collection.js';
import { schemaOf } from './state.js';

export const TABLE_KINDS = ['has-rows', 'can-sort', 'can-search', 'has-pagination', 'has-selection', 'has-row-actions', 'has-data-states'];

/** The enabled table behaviors of a component, by kind: { 'has-rows': b, 'can-sort': b, … } (null when it has no rows behavior). */
export function tableBehaviors(behaviors) {
    const by = {};
    for (const b of behaviors || []) if (b.enabled && TABLE_KINDS.includes(b.kind)) by[b.kind] = b;
    return by['has-rows'] ? by : null;
}

/** Role of each layer a table behavior maps: Map(layer id → 'row' | 'header' | 'cell:<field>' | 'head:<field>' | 'prev' …). */
export function tableRoles(by) {
    const roles = new Map();
    for (const b of Object.values(by || {})) {
        for (const [slot, id] of Object.entries(b.slots || {})) {
            if (!id) continue;
            const m = /^(cell|head)\.(.+)$/.exec(slot);
            roles.set(id, m ? `${m[1]}:${m[2]}` : slot);
        }
    }
    return roles;
}

/**
 * What the table shows now. `ev` = the evaluation context (State + derived), `by` = tableBehaviors(), `run` = what only Preview knows:
 * { loading, forceEmpty }.
 * → { ok, issues, schema, idField, vars, rows, rowOffset, page, pages, total, sourceTotal, search, sort, selected, pageState,
 *     columns: [{ key, label, type, cell, head }], empty: 'data' | 'search' | '', loading, flags }
 */
export function tableView(by, ev, run = {}) {
    const hb = by?.['has-rows'], issues = [];
    if (!hb) return { ok: false, issues: ['No Has rows behavior.'] };
    const cfg = hb.config, vars = cfg.vars || {}, list = cfg.source && ev.state.variables.find(v => v.id === cfg.source);
    if (!list) issues.push('The List the rows come from is not set or is gone.');
    else if (!vars.visible || !ev.has(vars.visible)) issues.push('The table has no State yet: use “Set up table State” in Has rows.');
    else if (ev.error(vars.visible)) issues.push(ev.error(vars.visible));
    if (!hb.slots.row) issues.push('The row template is not set.');
    const schema = list ? schemaOf(list) : [];
    if (issues.length) return { ok: false, issues, schema };
    const rows = ev.get(vars.visible) || [], source = ev.get(list.id) || [];
    const get = (id, d) => (id && ev.has(id) ? ev.get(id) : d);
    const page = Math.min(Math.max(1, Math.floor(Number(get(vars.page, 1))) || 1), Math.max(1, Number(get(vars.pages, 1)) || 1));
    const size = Math.floor(Number(get(vars.pageSize, cfg.pageSize))) || 0;
    const search = String(get(vars.search, '') ?? ''), selected = (get(vars.selected, []) || []).map(String);
    const total = Number(get(vars.total, rows.length)) || 0;
    const effective = run.forceEmpty ? [] : rows;
    const columns = schema.map(f => ({ key: f.key, label: columnLabel(f), type: f.type, cell: hb.slots[`cell:${f.key}`] || '', head: hb.slots[`head:${f.key}`] || '' }));
    return {
        ok: true, issues: [], schema, idField: cfg.idField, vars, rows: effective, rowOffset: size ? (page - 1) * size : 0, page, pages: Number(get(vars.pages, 1)) || 1, total: run.forceEmpty ? 0 : total,
        sourceTotal: run.forceEmpty ? 0 : source.length, search, sort: String(get(vars.sort, '') ?? ''), selected, size,
        pageState: pageSelectionState(selected, effective, cfg.idField), columns, loading: !!run.loading,
        empty: effective.length ? '' : (run.forceEmpty || !source.length ? 'data' : 'search'),
        flags: { sort: !!by['can-sort'], search: !!by['can-search'], pagination: !!by['has-pagination'], selection: !!by['has-selection'], actions: !!by['has-row-actions'], states: !!by['has-data-states'] },
    };
}

// ---- the State writes of each click: [{ id, value }] (applied by the host; nothing here touches State) ----
const w = (id, value) => (id ? [{ id, value }] : []);
/** Click on a column header: ascending, descending, none. Another sort goes back to the first page. */
export const sortWrites = (m, field) => [...w(m.vars.sort, nextSort(m.sort, field)), ...w(m.vars.page, 1)];
/** Previous / next page (delta -1 / +1) or a given page; stays inside 1 to pages. */
export const pageWrites = (m, to, relative = true) => w(m.vars.page, Math.min(Math.max(1, (relative ? m.page : 0) + to), m.pages));
/** Typing in the search box: the text, and back to page 1. */
export const searchWrites = (m, text) => [...w(m.vars.search, String(text ?? '')), ...w(m.vars.page, 1)];
/** A row checkbox. */
export const toggleRowWrites = (m, row) => w(m.vars.selected, toggleId(m.selected, idOf(row, m.idField)));
/** The header checkbox: selects the rows of THIS PAGE, or clears them when they are all selected. */
export const selectPageWrites = m => w(m.vars.selected, setPageSelection(m.selected, m.rows, m.idField, m.pageState !== 'all'));
/** The row context of row `i` of the page. */
export const rowCtxOf = (m, row, i) => rowContext(row, m.rowOffset + i + 1, m.selected, m.idField);
export const sortOf = m => parseSort(m.sort);
export { idKey };

/** The State a table row's cell layer binds: { layerId: { text: field } } for every mapped cell (the host resolves a frame to its first text). */
export function cellBinds(m, textLayerOf = id => id) {
    const out = {};
    for (const c of m.columns) if (c.cell) out[textLayerOf(c.cell)] = { text: c.key };
    return out;
}
