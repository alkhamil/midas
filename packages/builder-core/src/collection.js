// Collections: a List of objects shown as rows (a table, a list). The data side (columns, CSV / JSON in, generated sample rows) and the
// operations a table runs on it (search, filter, sort, paginate, select, add / update / delete). Pure and client-side: no network.
//
// A column is a field of the List's schema: { key, type, label?, options? }. The List is the data; there is no other data system.
import { coerceField, fieldDefault, schemaOf } from './state.js';

const isPlain = v => !!v && typeof v === 'object' && !Array.isArray(v);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isIsoDate = v => typeof v === 'string' && DATE_RE.test(v) && !Number.isNaN(Date.parse(v));

/** The header of a column: its label, else its key. */
export const columnLabel = f => f.label || f.key;

// ============================================================ columns from data
export const toKey = h => String(h ?? '').trim().replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '');
const TRUE_WORDS = new Set(['true', 'yes']), FALSE_WORDS = new Set(['false', 'no']);

/** The type that fits every value of a column (empty values do not count): number, boolean, date, option (a few repeated words) or string. */
export function inferType(values, rowCount = values.length) {
    const v = values.filter(x => x !== '' && x !== null && x !== undefined);
    if (!v.length) return { type: 'string' };
    if (v.every(x => typeof x === 'number' || (typeof x === 'string' && x.trim() !== '' && Number.isFinite(+x)))) return { type: 'number' };
    if (v.every(x => typeof x === 'boolean' || (typeof x === 'string' && (TRUE_WORDS.has(x.toLowerCase()) || FALSE_WORDS.has(x.toLowerCase()))))) return { type: 'boolean' };
    if (v.every(isIsoDate)) return { type: 'date' };
    const distinct = [...new Set(v.map(String))];
    if (distinct.length <= 6 && rowCount >= distinct.length * 2 && distinct.every(x => x.length <= 24)) return { type: 'option', options: distinct };
    return { type: 'string' };
}

export const castCell = (f, raw) => {
    if (raw === undefined || raw === null) return fieldDefault(f.type);
    if (f.type === 'boolean') return typeof raw === 'boolean' ? raw : TRUE_WORDS.has(String(raw).toLowerCase());
    if (f.type === 'number') return coerceField('number', raw);
    if (f.type === 'date') return isIsoDate(String(raw)) ? String(raw) : '';
    return String(raw);
};

/** Columns for rows of objects (the union of their keys, in order) with the type each one fits. */
export function inferSchema(rows) {
    const keys = [];
    for (const r of rows) if (isPlain(r)) for (const k of Object.keys(r)) if (!keys.includes(k)) keys.push(k);
    return keys.map(key => ({ key, ...inferType(rows.map(r => r?.[key]), rows.length) }));
}

// ============================================================ CSV / JSON
/** CSV text → rows of cells. Quotes, doubled quotes, line breaks inside quotes; the separator (comma, semicolon or tab) is read from the first line. */
export function parseCSV(text) {
    const src = String(text ?? '').replace(/^﻿/, '');
    const first = src.split(/\r?\n/)[0] || '';
    const sep = [',', ';', '\t'].map(c => [c, first.split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
    const out = []; let row = [], cell = '', q = false;
    for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (q) {
            if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; }
            else cell += c;
        }
        else if (c === '"' && cell === '') q = true;
        else if (c === sep) { row.push(cell); cell = ''; }
        else if (c === '\n' || c === '\r') { if (c === '\r' && src[i + 1] === '\n') i++; row.push(cell); out.push(row); row = []; cell = ''; }
        else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); out.push(row); }
    return out.filter(r => r.some(x => x.trim() !== ''));
}

/** CSV text → { schema, rows, problems }. The first line is the header. Types are inferred from the values. */
export function rowsFromCSV(text) {
    const cells = parseCSV(text), problems = [];
    if (cells.length < 1) return { schema: [], rows: [], problems: ['The file is empty.'] };
    const seen = new Set(), head = cells[0].map((h, i) => { let k = toKey(h) || `column-${i + 1}`; while (seen.has(k)) k += '_'; seen.add(k); return { key: k, label: String(h).trim() }; });
    const body = cells.slice(1);
    body.forEach((r, i) => { if (r.length !== head.length) problems.push(`Row ${i + 1} has ${r.length} cells, the header has ${head.length}.`); });
    const schema = head.map((h, c) => {
        const t = inferType(body.map(r => r[c] ?? ''), body.length), f = { key: h.key, ...t };
        if (h.label && h.label !== h.key) f.label = h.label;
        return f;
    });
    const rows = body.map(r => Object.fromEntries(schema.map((f, c) => [f.key, castCell(f, r[c])])));
    return { schema, rows, problems: problems.slice(0, 5) };
}

/** JSON text → { schema, rows, problems }: a list of objects, or an object holding one under rows / data / items. */
export function rowsFromJSON(text) {
    let data;
    try { data = JSON.parse(String(text ?? '')); }
    catch (e) { return { schema: [], rows: [], problems: [`This is not valid JSON: ${e.message}`] }; }
    const list = Array.isArray(data) ? data : ['rows', 'data', 'items'].map(k => data?.[k]).find(Array.isArray);
    if (!list) return { schema: [], rows: [], problems: ['Expected a list of objects (or an object with rows, data or items).'] };
    const objs = list.filter(isPlain);
    if (!objs.length && list.length) return { schema: [], rows: [], problems: ['The list holds no objects: each row must be an object like {"name": "Ana"}.'] };
    const schema = inferSchema(objs);
    return { schema, rows: objs.map(r => Object.fromEntries(schema.map(f => [f.key, castCell(f, r[f.key])]))), problems: list.length > objs.length ? [`${list.length - objs.length} items were not objects and were skipped.`] : [] };
}

/** Rows made to fit given columns: by key, the rest of the file's columns ignored. */
export function fitToSchema(schema, rows) {
    return rows.map(r => Object.fromEntries(schema.map(f => [f.key, castCell(f, r?.[f.key])])));
}

/** Columns and rows as CSV text. */
export function toCSV(schema, rows) {
    const esc = v => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return [schema.map(f => esc(f.key)).join(','), ...rows.map(r => schema.map(f => esc(r?.[f.key])).join(','))].join('\n');
}

// ============================================================ generated sample rows
const FIRST = ['Ana', 'Budi', 'Citra', 'Dewi', 'Eka', 'Fajar', 'Gita', 'Hadi', 'Indah', 'Joko', 'Kiki', 'Lina', 'Maya', 'Nanda', 'Oka', 'Putri', 'Rani', 'Sari', 'Tono', 'Umar', 'Vina', 'Wayan', 'Yudi', 'Zahra', 'Alex', 'Ben', 'Chloe', 'Dan', 'Emma', 'Liam'];
const LAST = ['Pratama', 'Santoso', 'Wijaya', 'Lestari', 'Hidayat', 'Kusuma', 'Saputra', 'Nugroho', 'Rahma', 'Setiawan', 'Putra', 'Wulandari', 'Gunawan', 'Halim', 'Smith', 'Chen', 'Garcia', 'Novak', 'Brown', 'Lee'];
const COMPANIES = ['Akar Inti', 'Nusa Digital', 'Bintang Logistik', 'Cakra Studio', 'Delta Retail', 'Elang Foods', 'Fokus Media', 'Garuda Labs'];
const CITIES = ['Jakarta', 'Bandung', 'Surabaya', 'Yogyakarta', 'Medan', 'Denpasar', 'Makassar', 'Semarang'];
const WORDS = ['draft', 'review', 'launch', 'invoice', 'update', 'plan', 'report', 'budget', 'design', 'sync', 'roadmap', 'feedback'];
const DEFAULT_OPTIONS = {
    role: ['Admin', 'Editor', 'Viewer', 'Manager'], status: ['Active', 'Pending', 'Disabled'], type: ['Personal', 'Business', 'Partner'],
    category: ['General', 'Billing', 'Support', 'Sales'], priority: ['Low', 'Medium', 'High'], plan: ['Free', 'Pro', 'Team'],
};

/** A small deterministic random generator (mulberry32): the same seed gives the same rows. */
export function rng(seed = 1) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, list) => list[Math.floor(r() * list.length)];
const pad = n => String(n).padStart(2, '0');
const isoDate = ms => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');

/**
 * `n` rows that look real for the columns: names, e-mails matching the name, roles and statuses from the column's options, dates
 * in the last two years, amounts with cents. `opts` = { seed, startId, today: 'YYYY-MM-DD' }.
 */
export function generateRows(schema, n, opts = {}) {
    const r = rng(opts.seed ?? 1), today = Date.parse(opts.today || '2025-01-01'), count = Math.max(0, Math.min(5000, Math.floor(n) || 0));
    const rows = [];
    for (let i = 0; i < count; i++) {
        const first = pick(r, FIRST), last = pick(r, LAST), person = `${first} ${last}`, company = pick(r, COMPANIES);
        const row = {};
        for (const f of schema) {
            const k = f.key.toLowerCase().replace(/[^a-z]/g, '');
            let v;
            if (f.type === 'number') {
                if (k === 'id' || k.endsWith('id') && k.length <= 4) v = (opts.startId ?? 1) + i;
                else if (/amount|price|total|balance|salary|revenue|cost|fee/.test(k)) v = Math.round((10 + r() * 4990) * 100) / 100;
                else if (/age/.test(k)) v = 18 + Math.floor(r() * 52);
                else if (/qty|quantity|count|stock|items/.test(k)) v = 1 + Math.floor(r() * 50);
                else if (/rating|score/.test(k)) v = Math.round(r() * 50) / 10;
                else v = Math.floor(r() * 1000);
            }
            else if (f.type === 'boolean') v = r() < (/active|enabled|verified|paid/.test(k) ? 0.75 : 0.4);
            else if (f.type === 'date') v = isoDate(today - Math.floor(r() * 730) * 86400000);
            else if (f.type === 'option') { const o = f.options?.length ? f.options : DEFAULT_OPTIONS[k] || DEFAULT_OPTIONS[Object.keys(DEFAULT_OPTIONS).find(x => k.includes(x)) || ''] || ['Option 1', 'Option 2', 'Option 3']; v = pick(r, o); }
            else if (k === 'id' || k === 'uid') v = `${(opts.startId ?? 1) + i}`;
            else if (/^(full)?name$|^customer$|^user$|^owner$|^author$/.test(k)) v = person;
            else if (k === 'firstname') v = first;
            else if (k === 'lastname' || k === 'surname') v = last;
            else if (/email/.test(k)) v = `${slug(person)}@${slug(company).split('.')[0]}.com`;
            else if (/phone|mobile|tel/.test(k)) v = `+62 8${Math.floor(10 + r() * 89)}-${Math.floor(1000 + r() * 8999)}-${Math.floor(1000 + r() * 8999)}`;
            else if (/company|organi[sz]ation|employer/.test(k)) v = company;
            else if (/city|town/.test(k)) v = pick(r, CITIES);
            else if (/country/.test(k)) v = 'Indonesia';
            else if (/title|subject|project|task/.test(k)) v = `${pick(r, WORDS)} ${pick(r, WORDS)}`.replace(/^./, c => c.toUpperCase());
            else if (/desc|note|comment|message|bio/.test(k)) v = `${pick(r, WORDS)} ${pick(r, WORDS)} ${pick(r, WORDS)}.`.replace(/^./, c => c.toUpperCase());
            else v = `${f.key} ${i + 1}`;
            row[f.key] = v;
        }
        rows.push(row);
    }
    return rows;
}

// ============================================================ sort / filter / paginate
/** 'name:desc' → { key, dir }; '' or nothing → null. */
export function parseSort(s) {
    const [key, dir] = String(s || '').split(':');
    return key ? { key, dir: dir === 'desc' ? 'desc' : 'asc' } : null;
}
export const sortText = sort => (sort?.key ? `${sort.key}:${sort.dir === 'desc' ? 'desc' : 'asc'}` : '');
/** What clicking a column header does: none → ascending → descending → none; another column starts ascending. */
export function nextSort(current, key) {
    const c = typeof current === 'string' ? parseSort(current) : current;
    if (!c || c.key !== key) return `${key}:asc`;
    return c.dir === 'asc' ? `${key}:desc` : '';
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
function compareCells(f, a, b) {
    const empty = x => x === '' || x === null || x === undefined;
    if (empty(a) || empty(b)) return empty(a) && empty(b) ? 0 : empty(a) ? 1 : -1;      // empty cells go last (flipped back for descending below)
    switch (f?.type) {
        case 'number': return (+a) - (+b);
        case 'boolean': return (a ? 1 : 0) - (b ? 1 : 0);
        case 'date': return a < b ? -1 : a > b ? 1 : 0;
        case 'option': { const o = f.options || [], i = o.indexOf(a), j = o.indexOf(b); return i >= 0 && j >= 0 && i !== j ? i - j : collator.compare(String(a), String(b)); }
        default: return collator.compare(String(a), String(b));
    }
}
/** A sorted copy. Stable (equal rows keep their order), by the type of the column; empty cells stay last in both directions. */
export function sortRows(rows, schema, sort) {
    const s = typeof sort === 'string' ? parseSort(sort) : sort;
    const f = s && schema.find(x => x.key === s.key);
    if (!f) return [...rows];
    const dir = s.dir === 'desc' ? -1 : 1;
    return rows.map((r, i) => [r, i]).sort((x, y) => {
        const a = x[0]?.[f.key], b = y[0]?.[f.key], ea = a === '' || a === null || a === undefined, eb = b === '' || b === null || b === undefined;
        if (ea || eb) return ea === eb ? x[1] - y[1] : ea ? 1 : -1;
        return compareCells(f, a, b) * dir || x[1] - y[1];
    }).map(x => x[0]);
}

/**
 * Rows that match a search text (in `columns`, or every column) and the per-column filters { key: value | [values] }.
 * Text is matched case-insensitively anywhere in the cell; a filter on an option / boolean column must equal one of its values.
 */
export function filterRows(rows, schema, { search = '', columns = [], filters = {} } = {}) {
    const q = String(search ?? '').trim().toLowerCase();
    const cols = (columns.length ? schema.filter(f => columns.includes(f.key)) : schema);
    const active = Object.entries(filters || {}).filter(([, v]) => !(v === '' || v === undefined || v === null || (Array.isArray(v) && !v.length)));
    return rows.filter(r => {
        if (q && !cols.some(f => String(r?.[f.key] ?? '').toLowerCase().includes(q))) return false;
        return active.every(([k, v]) => (Array.isArray(v) ? v : [v]).some(x => String(r?.[k]) === String(x)));
    });
}

/** One page: { rows, page, pages, total, pageSize }. The page is kept inside 1…pages (so deleting the last row of the last page lands on the new last one). pageSize ≤ 0 = everything. */
export function paginate(rows, page = 1, pageSize = 10) {
    const size = Math.floor(Number(pageSize)) > 0 ? Math.floor(Number(pageSize)) : 0, total = rows.length;
    const pages = size ? Math.max(1, Math.ceil(total / size)) : 1;
    const p = Math.min(Math.max(1, Math.floor(Number(page)) || 1), pages);
    return { rows: size ? rows.slice((p - 1) * size, p * size) : [...rows], page: p, pages, total, pageSize: size };
}

/**
 * The whole pipeline: source rows → filter → sort → page.
 * c = { search, searchColumns, filters, sort ('key:dir'), page, pageSize }
 * → { rows (this page), total (after the filter), sourceTotal, pages, page, pageSize }
 */
export function visibleRows(rows, schema, c = {}) {
    const list = Array.isArray(rows) ? rows : [];
    const filtered = filterRows(list, schema, { search: c.search, columns: c.searchColumns || [], filters: c.filters });
    const p = paginate(sortRows(filtered, schema, c.sort), c.page, c.pageSize);
    return { ...p, sourceTotal: list.length };
}

// ============================================================ selection (by row id)
export const idOf = (row, idField) => (row ? row[idField] : undefined);
/** Ids as the State keeps them: text (a List of String). */
export const idKey = v => String(v);
export function toggleId(ids, id) {
    const k = idKey(id);
    return ids.includes(k) ? ids.filter(x => x !== k) : [...ids, k];
}
/** Header checkbox: selects (or clears) the rows of the CURRENT PAGE only. Rows picked on other pages stay as they are. */
export function setPageSelection(ids, pageRows, idField, on) {
    const page = pageRows.map(r => idKey(idOf(r, idField)));
    return on ? [...ids, ...page.filter(k => !ids.includes(k))] : ids.filter(k => !page.includes(k));
}
export function pageSelectionState(ids, pageRows, idField) {
    if (!pageRows.length) return 'none';
    const n = pageRows.filter(r => ids.includes(idKey(idOf(r, idField)))).length;
    return n === 0 ? 'none' : n === pageRows.length ? 'all' : 'some';
}
/** Selected ids that still exist after rows were removed. */
export const pruneSelection = (ids, rows, idField) => { const have = new Set(rows.map(r => idKey(idOf(r, idField)))); return ids.filter(k => have.has(k)); };

// ============================================================ changing rows
/** The next free id for a column of numbers (max + 1) or text ("1", "2"…). */
export function nextId(rows, idField, type = 'number') {
    const max = rows.reduce((m, r) => { const n = Number(r?.[idField]); return Number.isFinite(n) ? Math.max(m, n) : m; }, 0);
    return type === 'number' ? max + 1 : String(max + 1);
}
/** A new row made from `values` (fields the columns do not have are dropped, missing ones get their default); a missing id is made. → the rows with it added at the end */
export function addRow(rows, schema, idField, values = {}) {
    const row = Object.fromEntries(schema.map(f => [f.key, castCell(f, values[f.key])]));
    const idCol = schema.find(f => f.key === idField);
    if (idCol && (values[idField] === undefined || values[idField] === '' || rows.some(r => idKey(r[idField]) === idKey(row[idField])))) row[idField] = nextId(rows, idField, idCol.type);
    return [...rows, row];
}
/** The row with this id updated with `patch` (its id cannot change). */
export function updateRow(rows, schema, idField, id, patch = {}) {
    return rows.map(r => {
        if (idKey(r?.[idField]) !== idKey(id)) return r;
        const next = { ...r };
        for (const f of schema) if (f.key !== idField && patch[f.key] !== undefined) next[f.key] = castCell(f, patch[f.key]);
        return next;
    });
}
export const deleteRows = (rows, idField, ids) => { const gone = new Set((Array.isArray(ids) ? ids : [ids]).map(idKey)); return rows.filter(r => !gone.has(idKey(r?.[idField]))); };

// ============================================================ the row context of a table
/** What a layer inside a row template can read: row.<field>, rowIndex (1-based, over the whole result) and isSelected. */
export function rowContext(row, index, selectedIds, idField) {
    return { row: row || {}, rowIndex: index, isSelected: !!row && (selectedIds || []).includes(idKey(row[idField])) };
}
/** The names a row context answers to in expressions: $row.<field>, $rowIndex, $isSelected. */
export const ROW_REF = { row: '$row.', index: '$rowIndex', selected: '$isSelected' };
/** { found, value } of a reference read in a row, or null when the reference is not about a row. */
export function resolveRowRef(ref, ctx) {
    if (typeof ref !== 'string') return null;
    if (ref === ROW_REF.index) return ctx ? { found: true, value: ctx.rowIndex } : { found: false };
    if (ref === ROW_REF.selected) return ctx ? { found: true, value: ctx.isSelected } : { found: false };
    if (ref.startsWith(ROW_REF.row)) {
        const k = ref.slice(ROW_REF.row.length);
        return ctx && Object.hasOwn(ctx.row, k) ? { found: true, value: ctx.row[k] } : { found: false };
    }
    return null;
}
/** The same for {placeholders} in a text: row.name, rowIndex, isSelected. */
export function resolveRowName(name, ctx) {
    if (!ctx) return null;
    const n = String(name).trim();
    if (n === 'rowIndex') return { found: true, value: ctx.rowIndex };
    if (n === 'isSelected') return { found: true, value: ctx.isSelected };
    if (n.startsWith('row.')) { const k = n.slice(4); return Object.hasOwn(ctx.row, k) ? { found: true, value: ctx.row[k] } : { found: false }; }
    return null;
}
/** The row references an editor can offer for a List: [[ref, label]]. */
export function rowRefsOf(list) {
    return [[ROW_REF.index, 'Row number'], [ROW_REF.selected, 'Row is selected'], ...schemaOf(list).map(f => [`${ROW_REF.row}${f.key}`, `Row · ${columnLabel(f)}`])];
}

// ============================================================ the State a table needs
/**
 * The State variables and derived values a table works with, as plain State the author can read: search, sort, page, pageSize,
 * selectedIds, then visibleRows (the page being shown), total (rows after the search), pageCount and selectedCount.
 * `state` = the file's State (names are kept unique), `list` = the source List, `newId()` makes ids.
 * → { variables, derived, ids: { search, sort, page, pageSize, selected, visible, total, pages, selectedCount } } (nothing is added to `state` here)
 */
export function planTableState(state, list, newId, { pageSize = 10, searchColumns = [] } = {}) {
    const taken = new Set([...(state?.variables || []), ...(state?.derived || [])].map(x => x.name.toLowerCase()));
    const name = base => { let n = base, i = 2; while (taken.has(n.toLowerCase())) n = `${base} ${i++}`; taken.add(n.toLowerCase()); return n; };
    const v = (key, base, type, initial, extra = {}) => ({ id: newId(), name: name(base), type, scope: 'page', initial, ...extra });
    const search = v('search', 'search', 'string', ''), sort = v('sort', 'sort', 'string', ''), page = v('page', 'page', 'number', 1);
    const size = v('pageSize', 'pageSize', 'number', pageSize), selected = v('selected', 'selectedIds', 'list', [], { itemType: 'string' });
    const ref = id => ({ op: 'var', ref: id }), part = p => ({ op: 'collection', part: p, list: ref(list.id), search: ref(search.id), columns: [...searchColumns], sort: ref(sort.id), page: ref(page.id), pageSize: ref(size.id) });
    const d = (base, expr) => ({ id: newId(), name: name(base), expr });
    const visible = d('visibleRows', part('rows')), total = d('total', part('total')), pages = d('pageCount', part('pages'));
    const selCount = d('selectedCount', { op: 'count', list: ref(selected.id) });
    return {
        variables: [search, sort, page, size, selected], derived: [visible, total, pages, selCount],
        ids: { search: search.id, sort: sort.id, page: page.id, pageSize: size.id, selected: selected.id, visible: visible.id, total: total.id, pages: pages.id, selectedCount: selCount.id },
    };
}
