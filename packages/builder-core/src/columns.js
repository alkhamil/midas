// Editing the columns and data of a List (what the Data window does). Pure.
import { castCell, fitToSchema, toKey } from './collection.js';

const FIELD_TYPES = ['string', 'number', 'boolean', 'option', 'date', 'color'];

/** A column key nobody uses yet: 'column' → 'column-2'. */
export function uniqueKey(schema, base) {
    const have = new Set(schema.map(f => f.key));
    const root = toKey(base) || 'column';
    let k = root, i = 2;
    while (have.has(k)) k = `${root}-${i++}`;
    return k;
}

/**
 * One edit of the columns of a List. `data` = { schema, rows } → a new { schema, rows }, the rows kept in step with the columns:
 *   { op: 'add' }                   a text column at the end        { op: 'del', key }   (the last column stays)
 *   { op: 'rename', key, value }    rows follow the new key         { op: 'type', key, value }  cells are converted
 *   { op: 'label', key, value }     header text ('' = the key)      { op: 'options', key, value: 'a, b' }   for an option column
 *   { op: 'move', key, value: -1 | 1 }  one place left / right
 */
export function editColumns({ schema, rows }, edit) {
    const sc = schema.map(f => ({ ...f }));
    let rs = rows.map(r => ({ ...r }));
    const at = sc.findIndex(f => f.key === edit.key);
    switch (edit.op) {
        case 'add': { const key = uniqueKey(sc, 'column'); sc.push({ key, type: 'string' }); rs = rs.map(r => ({ ...r, [key]: '' })); break; }
        case 'del':
            if (at >= 0 && sc.length > 1) { sc.splice(at, 1); rs = rs.map(r => Object.fromEntries(Object.entries(r).filter(([k]) => k !== edit.key))); }
            break;
        case 'rename': {
            const key = toKey(edit.value);
            if (at < 0 || !key || (key !== edit.key && sc.some(f => f.key === key))) break;
            sc[at].key = key;
            rs = rs.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k === edit.key ? key : k, v])));
            break;
        }
        case 'type': {
            if (at < 0) break;
            const f = sc[at];
            f.type = FIELD_TYPES.includes(edit.value) ? edit.value : 'string';
            if (f.type === 'option') f.options = f.options?.length ? f.options : [...new Set(rs.map(r => String(r[f.key] ?? '')).filter(Boolean))].slice(0, 12);
            else delete f.options;
            rs = rs.map(r => ({ ...r, [f.key]: castCell(f, r[f.key]) }));
            break;
        }
        case 'label':
            if (at >= 0) { const l = String(edit.value ?? '').trim(); if (l && l !== sc[at].key) sc[at].label = l; else delete sc[at].label; }
            break;
        case 'options':
            if (at >= 0 && sc[at].type === 'option') sc[at].options = [...new Set(String(edit.value ?? '').split(',').map(x => x.trim()).filter(Boolean))];
            break;
        case 'move': { const to = at + (edit.value < 0 ? -1 : 1); if (at >= 0 && to >= 0 && to < sc.length) [sc[at], sc[to]] = [sc[to], sc[at]]; break; }
        default: break;
    }
    return { schema: sc, rows: rs };
}

/**
 * The data of an import put into a List. `keepColumns`: the List's own columns stay and the file's cells are matched by key; otherwise
 * the file's columns replace them. `append`: the rows come after the current ones (fitted to the columns that remain).
 */
export function importInto(current, parsed, { keepColumns = false, append = false } = {}) {
    const schema = keepColumns ? current.schema : parsed.schema;
    const fresh = keepColumns ? fitToSchema(schema, parsed.rows) : parsed.rows;
    const base = append ? fitToSchema(schema, current.rows) : [];
    return { schema, rows: [...base, ...fresh] };
}
