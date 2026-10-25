// Derived values: structured JSON expressions over state. No eval, no code strings: every node is { op, ...args } built
// from dropdown sentences in the editor. Pure.
//
//   { op: 'value', value }                    a literal
//   { op: 'var', ref }                        a state variable or another derived variable (by id)
//   { op: 'count', list }                     how many rows
//   { op: 'sum', list, field? }               total of a field (or of a list of numbers)
//   { op: 'filter', list, field?, cmp, value } rows whose field compares to value (value is an expression)
//   { op: 'length', of }                      characters of a text, rows of a list
//   { op: 'isEmpty', of }                     nothing, empty text, empty list
//   { op: 'equals', a, b }
//   { op: 'compare', cmp, a, b }              eq ne gt gte lt lte contains startsWith endsWith
//   { op: 'and' | 'or', args: [expr] }        { op: 'not', arg }
//   { op: 'collection', part: 'rows' | 'total' | 'pages', list, search?, columns?, sort?, page?, pageSize? }
//                                             a table's rows: the list searched, sorted and cut into a page (made by the Table preset)
import { truthy, schemaOf } from './state.js';
import { visibleRows } from './collection.js';

export const COMPARATORS = [
    { id: 'eq', label: 'is' },
    { id: 'ne', label: 'is not' },
    { id: 'gt', label: 'is greater than' },
    { id: 'gte', label: 'is at least' },
    { id: 'lt', label: 'is less than' },
    { id: 'lte', label: 'is at most' },
    { id: 'contains', label: 'contains' },
    { id: 'startsWith', label: 'starts with' },
    { id: 'endsWith', label: 'ends with' },
];
const CMP_IDS = new Set(COMPARATORS.map(c => c.id));

/** The operations the editor offers, in the order of its picker. `kind` is what they produce. */
export const OPERATIONS = [
    { id: 'count', label: 'Number of rows in', kind: 'number' },
    { id: 'sum', label: 'Total of', kind: 'number' },
    { id: 'filter', label: 'Rows of', kind: 'list' },
    { id: 'length', label: 'Length of', kind: 'number' },
    { id: 'isEmpty', label: 'Is empty', kind: 'boolean' },
    { id: 'equals', label: 'Equals', kind: 'boolean' },
    { id: 'compare', label: 'Compare', kind: 'boolean' },
    { id: 'and', label: 'All of', kind: 'boolean' },
    { id: 'or', label: 'Any of', kind: 'boolean' },
    { id: 'not', label: 'Not', kind: 'boolean' },
    { id: 'valid', label: 'Field is valid', kind: 'boolean' },
    { id: 'invalid', label: 'Field is invalid', kind: 'boolean' },
    { id: 'collection', label: 'Rows of a table', kind: 'list', hidden: true },
    { id: 'var', label: 'A variable', kind: 'any' },
    { id: 'value', label: 'A fixed value', kind: 'any' },
];

class ExprError extends Error {}
const fail = msg => { throw new ExprError(msg); };
const isPlain = v => !!v && typeof v === 'object' && !Array.isArray(v);
const numeric = v => typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v) ? +v : null);

function deepEqual(a, b) {
    if (a === b) return true;
    if (a === null || a === undefined || b === null || b === undefined) return (a ?? null) === (b ?? null);
    if (typeof a === 'object' && typeof b === 'object') return JSON.stringify(a) === JSON.stringify(b);
    return false;
}

/** One comparison. Numbers compare as numbers (also "12" with 12); everything else as text; contains also looks inside lists. */
export function compareValues(cmp, a, b) {
    if (!CMP_IDS.has(cmp)) fail(`Unknown comparison “${cmp}”.`);
    if (cmp === 'eq') return deepEqual(a, b) || (numeric(a) !== null && numeric(a) === numeric(b));
    if (cmp === 'ne') return !compareValues('eq', a, b);
    if (cmp === 'contains') {
        if (Array.isArray(a)) return a.some(x => deepEqual(x, b));
        return String(a ?? '').toLowerCase().includes(String(b ?? '').toLowerCase());
    }
    if (cmp === 'startsWith') return String(a ?? '').toLowerCase().startsWith(String(b ?? '').toLowerCase());
    if (cmp === 'endsWith') return String(a ?? '').toLowerCase().endsWith(String(b ?? '').toLowerCase());
    const x = numeric(a), y = numeric(b), [p, q] = x !== null && y !== null ? [x, y] : [String(a ?? ''), String(b ?? '')];
    return cmp === 'gt' ? p > q : cmp === 'gte' ? p >= q : cmp === 'lt' ? p < q : p <= q;
}

const cellOf = (row, field) => (field ? (isPlain(row) ? row[field] : undefined) : row);

function ev(e, env) {
    if (!isPlain(e)) fail('An expression is missing.');
    const list = x => { const v = ev(x, env); if (!Array.isArray(v)) fail('A list is expected here.'); return v; };
    switch (e.op) {
        case 'value': return e.value;
        case 'var': {
            const r = env.resolve(e.ref);
            if (!r?.found) fail('This variable does not exist.');
            if (r.error) fail(r.error);
            return r.value;
        }
        case 'count': return list(e.list).length;
        case 'sum': return list(e.list).reduce((s, row) => { const n = numeric(cellOf(row, e.field)); return n === null ? s : s + n; }, 0);
        case 'filter': { const want = ev(e.value, env); return list(e.list).filter(row => compareValues(e.cmp, cellOf(row, e.field), want)); }
        case 'collection': {
            const rows = list(e.list), schema = env.schemaOf?.(e.list?.op === 'var' ? e.list.ref : '') || [];
            const opt = (x, d) => (isPlain(x) ? ev(x, env) : d);
            const r = visibleRows(rows, schema, { search: opt(e.search, ''), searchColumns: Array.isArray(e.columns) ? e.columns : [], sort: opt(e.sort, ''), page: opt(e.page, 1), pageSize: opt(e.pageSize, 10) });
            return e.part === 'total' ? r.total : e.part === 'pages' ? r.pages : r.rows;
        }
        case 'length': { const v = ev(e.of, env); return Array.isArray(v) || typeof v === 'string' ? v.length : fail('A text or a list is expected here.'); }
        case 'isEmpty': { const v = ev(e.of, env); return v === null || v === undefined || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && !v.length) || (isPlain(v) && !Object.keys(v).length); }
        case 'equals': return compareValues('eq', ev(e.a, env), ev(e.b, env));
        case 'compare': return compareValues(e.cmp, ev(e.a, env), ev(e.b, env));
        case 'and': return (e.args || []).every(a => truthy(ev(a, env)));
        case 'or': return (e.args || []).some(a => truthy(ev(a, env)));
        case 'not': return !truthy(ev(e.arg, env));
        case 'valid': case 'invalid': {
            if (typeof env.fieldValid !== 'function') fail('Field validity is only available in conditions.');
            const r = env.fieldValid(e.field);
            if (r === undefined || r === null) fail('Choose a field.');
            return e.op === 'valid' ? !!r : !r;
        }
        default: return fail(`Unknown operation “${e.op}”.`);
    }
}

/**
 * Evaluate one expression. `env.resolve(ref)` → { found, value?, error? }.
 * → { ok: true, value } or { ok: false, error } (the error is shown on the variable, never thrown).
 */
export function evaluate(expr, env) {
    try { return { ok: true, value: ev(expr, env) }; }
    catch (err) { if (err instanceof ExprError) return { ok: false, error: err.message }; throw err; }
}

/** Every variable id an expression reads. */
export function refsOf(expr, out = new Set()) {
    if (!isPlain(expr)) return out;
    if (expr.op === 'var' && expr.ref) out.add(expr.ref);
    for (const k of ['list', 'of', 'a', 'b', 'arg', 'value', 'search', 'sort', 'page', 'pageSize'])
        if (isPlain(expr[k])) refsOf(expr[k], out);
    for (const a of Array.isArray(expr.args) ? expr.args : []) refsOf(a, out);
    return out;
}

/**
 * All derived values for the given state values. `values`: Map(state id → value).
 * → { values: Map(derived id → value), errors: Map(derived id → message) }. A derived that reads itself, directly or through
 * others, gets "Circular" on every variable of the loop and no value.
 */
export function evaluateState(state, values) {
    const derived = new Map((state?.derived || []).map(d => [d.id, d]));
    const out = { values: new Map(), errors: new Map() };
    const stack = [];
    const resolve = ref => {
        if (values.has(ref)) return { found: true, value: values.get(ref) };
        if (!derived.has(ref)) return { found: false };
        const r = compute(ref);
        return r.ok ? { found: true, value: r.value } : { found: true, error: r.error };
    };
    const compute = id => {
        if (out.values.has(id)) return { ok: true, value: out.values.get(id) };
        if (out.errors.has(id)) return { ok: false, error: out.errors.get(id) };
        const at = stack.indexOf(id);
        if (at >= 0) {
            const loop = stack.slice(at);
            const msg = `Circular: ${[...loop, id].map(i => derived.get(i)?.name || i).join(' → ')}`;
            for (const i of loop) out.errors.set(i, msg);
            return { ok: false, error: msg };
        }
        stack.push(id);
        const r = evaluate(derived.get(id).expr, { resolve, schemaOf: ref => schemaOf((state.variables || []).find(v => v.id === ref)) });
        stack.pop();
        if (out.errors.has(id)) return { ok: false, error: out.errors.get(id) };     // marked as part of a loop while evaluating
        if (r.ok) out.values.set(id, r.value); else out.errors.set(id, r.error);
        return r;
    };
    for (const id of derived.keys()) compute(id);
    return out;
}

/** Problems of an expression that can be seen without running it: unknown operation, missing part, unknown variable. */
export function validateExpr(expr, knownRefs) {
    const errors = [];
    const walk = (e, path) => {
        if (!isPlain(e)) { errors.push(`${path}: missing`); return; }
        if (!OPERATIONS.some(o => o.id === e.op)) { errors.push(`${path}: unknown operation “${e.op}”`); return; }
        if ((e.op === 'valid' || e.op === 'invalid') && !e.field) errors.push(path + ': choose a field');
        if (e.op === 'var' && !knownRefs.has(e.ref)) errors.push(`${path}: unknown variable`);
        if ((e.op === 'filter' || e.op === 'compare') && !CMP_IDS.has(e.cmp)) errors.push(`${path}: unknown comparison`);
        const need = { collection: ['list'], count: ['list'], sum: ['list'], filter: ['list', 'value'], length: ['of'], isEmpty: ['of'], equals: ['a', 'b'], compare: ['a', 'b'], not: ['arg'] }[e.op] || [];
        for (const k of need) walk(e[k], `${path}.${k}`);
        if (e.op === 'and' || e.op === 'or') (e.args || []).forEach((a, i) => walk(a, `${path}.args[${i}]`));
    };
    walk(expr, 'expression');
    return errors;
}

const V = ref => ({ op: 'var', ref });
const LIT = value => ({ op: 'value', value });
/** A fresh expression of one operation, with its parts filled so it is valid at once (the editor shows it, the user edits it). */
export function defaultExpr(op, firstRef = '') {
    switch (op) {
        case 'count': return { op, list: V(firstRef) };
        case 'sum': return { op, list: V(firstRef), field: '' };
        case 'filter': return { op, list: V(firstRef), field: '', cmp: 'eq', value: LIT('') };
        case 'length': case 'isEmpty': return { op, of: V(firstRef) };
        case 'equals': return { op, a: V(firstRef), b: LIT('') };
        case 'compare': return { op, cmp: 'eq', a: V(firstRef), b: LIT('') };
        case 'and': case 'or': return { op, args: [{ op: 'compare', cmp: 'eq', a: V(firstRef), b: LIT('') }] };
        case 'not': return { op, arg: V(firstRef) };
        case 'valid': case 'invalid': return { op, field: '' };
        case 'var': return V(firstRef);
        default: return LIT('');
    }
}

/** The part of an expression at `path` ('list', 'args.0.a' or ['args', 0, 'a']); '' / [] is the whole expression. */
export function getAt(expr, path) {
    const keys = Array.isArray(path) ? path : String(path || '').split('.').filter(Boolean);
    let cur = expr;
    for (const k of keys) { if (cur === undefined || cur === null) return undefined; cur = cur[k]; }
    return cur;
}
/** A copy of `expr` with `node` put at `path` (undefined removes an item of an `args` list). The input is not changed. */
export function setAt(expr, path, node) {
    const keys = Array.isArray(path) ? path : String(path || '').split('.').filter(Boolean);
    if (!keys.length) return node;
    const [k, ...rest] = keys;
    const copy = Array.isArray(expr) ? [...expr] : { ...(expr || {}) };
    if (rest.length) copy[k] = setAt(copy[k], rest, node);
    else if (node === undefined && Array.isArray(copy)) copy.splice(Number(k), 1);
    else copy[k] = node;
    return copy;
}

/** An expression in words ("attempts is at least 5"), for one-line summaries. */
export function describeExpr(e, nameOf = x => x, fieldName = x => x) {
    const d = x => describeExpr(x, nameOf, fieldName);
    const cmp = id => COMPARATORS.find(c => c.id === id)?.label || id;
    switch (e?.op) {
        case 'var': return nameOf(e.ref) || '…';
        case 'value': return typeof e.value === 'string' ? (e.value === '' ? '“”' : `“${e.value}”`) : String(e.value);
        case 'count': return `rows in ${d(e.list)}`;
        case 'collection': return `${e.part === 'total' ? 'number of matching rows' : e.part === 'pages' ? 'number of pages' : 'rows on the page'} of ${d(e.list)}`;
        case 'sum': return `total of ${e.field ? e.field + ' in ' : ''}${d(e.list)}`;
        case 'filter': return `${d(e.list)} where ${e.field || 'value'} ${cmp(e.cmp)} ${d(e.value)}`;
        case 'length': return `length of ${d(e.of)}`;
        case 'isEmpty': return `${d(e.of)} is empty`;
        case 'equals': return `${d(e.a)} is ${d(e.b)}`;
        case 'compare': return `${d(e.a)} ${cmp(e.cmp)} ${d(e.b)}`;
        case 'and': return (e.args || []).map(d).join(' and ') || '…';
        case 'or': return (e.args || []).map(d).join(' or ') || '…';
        case 'not': return `not ${d(e.arg)}`;
        case 'valid': return `${fieldName(e.field) || '…'} is valid`;
        case 'invalid': return `${fieldName(e.field) || '…'} is invalid`;
        default: return '…';
    }
}
