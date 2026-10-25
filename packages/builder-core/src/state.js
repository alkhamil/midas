// State: the values a page changes while it runs (a typed text, a list of rows, a chosen option). Separate from Tokens
// (design variables with modes). Pure: nothing here touches the DOM or the editor.
//
// A state variable: { id, name, type, initial, scope, description?, options?, itemType?, schema? }
//   a field of a schema: { key, type, label?, options? }  (options: only for type 'option'; label: the header of a column in a table)
//   type    string | number | boolean | option | list | object | date | file
//   scope   'page' (default) | 'app' (kept across pages)
//   option  options: the fixed values ['draft', 'sent']; initial is one of them
//   list    itemType: string | number | boolean | date | object; for 'object' items, schema names the fields
//   object  schema: [{ key, type }]
//   date    'YYYY-MM-DD' or ''      file  null or { name, size, type }

export const STATE_TYPES = [
    { id: 'string', label: 'String' },
    { id: 'number', label: 'Number' },
    { id: 'boolean', label: 'Boolean' },
    { id: 'option', label: 'Option' },
    { id: 'list', label: 'List' },
    { id: 'object', label: 'Object' },
    { id: 'date', label: 'Date' },
    { id: 'file', label: 'File' },
];
export const STATE_TYPE_IDS = STATE_TYPES.map(t => t.id);
/** What a field of an object or a list row may hold. */
export const STATE_FIELD_TYPES = ['string', 'number', 'boolean', 'option', 'date', 'color'];
export const LIST_ITEM_TYPES = ['object', 'string', 'number', 'boolean', 'date'];
export const STATE_SCOPES = [{ id: 'page', label: 'Page' }, { id: 'app', label: 'App (all pages)' }];
export const DEFAULT_SCHEMA = [{ key: 'label', type: 'string' }, { key: 'value', type: 'string' }];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isPlain = v => !!v && typeof v === 'object' && !Array.isArray(v);
const isDate = v => v === '' || (typeof v === 'string' && DATE_RE.test(v) && !Number.isNaN(Date.parse(v)));
const clone = v => (v === undefined ? undefined : structuredClone(v));

export function fieldDefault(type) {
    return type === 'number' ? 0 : type === 'boolean' ? false : type === 'color' ? '#d9d9d9' : '';
}

/** Fields of a variable: the schema of an object, or of the rows of a list of objects. Empty for everything else. */
export function schemaOf(v) {
    if (!v || (v.type !== 'object' && !(v.type === 'list' && (v.itemType || 'object') === 'object'))) return [];
    return Array.isArray(v.schema) && v.schema.length ? v.schema : DEFAULT_SCHEMA;
}

/** 'name:string, price:number' → [{ key, type }] (what the fields box of the editor accepts). */
export function parseSchema(text) {
    const seen = new Set(), out = [];
    for (const part of String(text || '').split(',')) {
        const [k, t] = part.split(':').map(s => s.trim());
        const key = String(k || '').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '');
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push({ key, type: STATE_FIELD_TYPES.includes(t) ? t : 'string' });
    }
    return out;
}
export const schemaText = schema => (schema || []).map(f => `${f.key}:${f.type}`).join(', ');

function checkField(type, v) {
    if (type === 'number') return typeof v === 'number' && Number.isFinite(v);
    if (type === 'boolean') return typeof v === 'boolean';
    if (type === 'date') return isDate(v);
    return typeof v === 'string';
}
function checkRow(schema, row) {
    if (!isPlain(row)) return 'A row must be an object.';
    for (const f of schema)
        if (row[f.key] !== undefined && !checkField(f.type, row[f.key])) return `Field “${f.key}” must be a ${f.type}.`;
    return null;
}

/** Is `value` a legal value of the variable? → { ok } or { ok: false, error } (plain words, shown next to the variable). */
export function checkValue(v, value) {
    const bad = error => ({ ok: false, error });
    switch (v?.type) {
        case 'string': return typeof value === 'string' ? { ok: true } : bad('Expected text.');
        case 'number': return typeof value === 'number' && Number.isFinite(value) ? { ok: true } : bad('Expected a number.');
        case 'boolean': return typeof value === 'boolean' ? { ok: true } : bad('Expected true or false.');
        case 'option': return (v.options || []).includes(value) ? { ok: true } : bad('Pick one of the options.');
        case 'date': return isDate(value) ? { ok: true } : bad('Expected a date like 2025-01-31.');
        case 'file': return value === null || (isPlain(value) && typeof value.name === 'string') ? { ok: true } : bad('Expected a file or nothing.');
        case 'object': { const e = checkRow(schemaOf(v), value); return e ? bad(e) : { ok: true }; }
        case 'list': {
            if (!Array.isArray(value)) return bad('Expected a list.');
            const kind = v.itemType || 'object', schema = schemaOf(v);
            for (let i = 0; i < value.length; i++) {
                const e = kind === 'object' ? checkRow(schema, value[i]) : checkField(kind, value[i]) ? null : `Item ${i + 1} must be a ${kind}.`;
                if (e) return bad(`Row ${i + 1}: ${e}`);
            }
            return { ok: true };
        }
        default: return bad('Unknown type.');
    }
}

/** The value of a type before anyone sets it. */
export function defaultValue(v) {
    switch (v?.type) {
        case 'number': return 0;
        case 'boolean': return false;
        case 'option': return v.options?.[0] ?? '';
        case 'list': return [];
        case 'object': return Object.fromEntries(schemaOf(v).map(f => [f.key, fieldDefault(f.type)]));
        case 'file': return null;
        default: return '';
    }
}

/** Rows made to fit the schema: missing fields get their default, rows that are not objects are dropped. */
export function fitRows(v, rows) {
    if (!Array.isArray(rows)) return [];
    const kind = v.itemType || 'object';
    if (kind !== 'object') return rows.filter(x => checkField(kind, x));
    const schema = schemaOf(v);
    return rows.filter(isPlain).map(r => Object.fromEntries(schema.map(f => [f.key, checkField(f.type, r[f.key]) ? r[f.key] : fieldDefault(f.type)])));
}

/** A variable as the editor and the file keep it: unknown fields dropped, the initial value legal. null when it is not a variable. */
export function normalizeStateVariable(raw) {
    if (!raw || typeof raw.id !== 'string' || !raw.id || !STATE_TYPE_IDS.includes(raw.type)) return null;
    const v = { id: raw.id, name: String(raw.name ?? 'State').trim() || 'State', type: raw.type, scope: raw.scope === 'app' ? 'app' : 'page' };
    if (raw.description) v.description = String(raw.description);
    if (v.type === 'option') v.options = [...new Set((Array.isArray(raw.options) ? raw.options : []).map(String).filter(Boolean))];
    if (v.type === 'option' && !v.options.length) v.options = ['option-1', 'option-2'];
    if (v.type === 'list') v.itemType = LIST_ITEM_TYPES.includes(raw.itemType) ? raw.itemType : 'object';
    if (v.type === 'object' || (v.type === 'list' && v.itemType === 'object')) {
        const seen = new Set(), schema = [];
        for (const f of Array.isArray(raw.schema) ? raw.schema : []) {
            if (!f || typeof f.key !== 'string' || !f.key || seen.has(f.key)) continue;
            seen.add(f.key);
            const type = STATE_FIELD_TYPES.includes(f.type) ? f.type : 'string', field = { key: f.key, type };
            if (typeof f.label === 'string' && f.label.trim()) field.label = f.label.trim();
            if (type === 'option') field.options = [...new Set((Array.isArray(f.options) ? f.options : []).map(String).filter(Boolean))];
            schema.push(field);
        }
        v.schema = schema.length ? schema : DEFAULT_SCHEMA.map(f => ({ ...f }));
    }
    let initial = clone(raw.initial);
    if (v.type === 'list') initial = fitRows(v, initial);
    else if (v.type === 'object') initial = isPlain(initial) ? Object.fromEntries(v.schema.map(f => [f.key, checkField(f.type, initial[f.key]) ? initial[f.key] : fieldDefault(f.type)])) : defaultValue(v);
    else if (!checkValue(v, initial).ok) initial = defaultValue(v);
    v.initial = initial;
    return v;
}

/** A derived variable: read-only, its value is `expr` (see expr.js) evaluated over the state. */
export function normalizeDerived(raw) {
    if (!raw || typeof raw.id !== 'string' || !raw.id) return null;
    const d = { id: raw.id, name: String(raw.name ?? 'Derived').trim() || 'Derived', expr: isPlain(raw.expr) ? clone(raw.expr) : { op: 'value', value: '' } };
    if (raw.description) d.description = String(raw.description);
    return d;
}

/** The whole `doc.data.state`: ids unique across variables and derived, unknown fields dropped. Idempotent. */
export function cleanState(raw) {
    const seen = new Set(), variables = [], derived = [];
    for (const r of Array.isArray(raw?.variables) ? raw.variables : []) {
        const v = normalizeStateVariable(r);
        if (v && !seen.has(v.id)) { seen.add(v.id); variables.push(v); }
    }
    for (const r of Array.isArray(raw?.derived) ? raw.derived : []) {
        const d = normalizeDerived(r);
        if (d && !seen.has(d.id)) { seen.add(d.id); derived.push(d); }
    }
    const scenarios = normalizeScenarios(raw?.scenarios);
    return scenarios.length ? { variables, derived, scenarios } : { variables, derived };
}

/** Initial values of every state variable as a fresh Map(id → value). `scopes`: only these scopes (default both). */
export function initialValues(state, scopes = ['page', 'app']) {
    const out = new Map();
    for (const v of state?.variables || []) if (scopes.includes(v.scope)) out.set(v.id, clone(v.initial));
    return out;
}

/** A value as plain text for a Text binding: lists show their size, objects their JSON, nothing shows nothing. */
export function formatValue(value) {
    if (value === undefined || value === null) return '';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (Array.isArray(value)) return String(value.length);
    if (typeof value === 'object') return value.name !== undefined && Object.keys(value).length <= 3 ? String(value.name) : JSON.stringify(value);
    return String(value);
}

/** Truthiness used by visibility bindings and and / or / not. Empty text, an empty list and 0 are "no". */
export function truthy(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0 && !Number.isNaN(value);
    if (typeof value === 'string') return value.trim() !== '';
    if (Array.isArray(value)) return value.length > 0;
    if (isPlain(value)) return Object.keys(value).length > 0;
    return false;
}

/** A name nobody else in the state uses: 'Count' → 'Count 2'. */
export function uniqueStateName(state, name, exceptId) {
    const taken = new Set([...(state?.variables || []), ...(state?.derived || [])].filter(x => x.id !== exceptId).map(x => x.name.toLowerCase()));
    if (!taken.has(String(name).toLowerCase())) return name;
    let i = 2;
    while (taken.has(`${name} ${i}`.toLowerCase())) i++;
    return `${name} ${i}`;
}

// ---------- text templates: "Active: {activeCount}" ----------
const PLACEHOLDER_RE = /\{([^{}]+)\}/g;

/** The names inside {…} of a text, trimmed, in order, without repeats. */
export function placeholdersOf(template) {
    const out = [];
    for (const m of String(template ?? '').matchAll(PLACEHOLDER_RE)) { const n = m[1].trim(); if (n && !out.includes(n)) out.push(n); }
    return out;
}

/**
 * Fill the {name} placeholders of a text. `lookup(name)` → { found, value }. A name that is not found stays as it is, so a typo
 * is visible in Preview instead of turning into an empty string.
 */
export function interpolate(template, lookup) {
    return String(template ?? '').replace(PLACEHOLDER_RE, (whole, raw) => {
        const r = lookup(raw.trim());
        return r?.found ? formatValue(r.value) : whole;
    });
}

// ---------- values written by actions ----------
/** A value made to fit the variable's type, or `undefined` when it cannot (a text that is not a number into a Number…). */
export function coerceTo(v, value) {
    switch (v?.type) {
        case 'number': { const n = typeof value === 'number' ? value : (typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN); return Number.isFinite(n) ? n : undefined; }
        case 'boolean': return truthy(value);
        case 'string': return value === undefined || value === null ? '' : typeof value === 'object' ? undefined : String(value);
        case 'option': return (v.options || []).includes(String(value)) ? String(value) : undefined;
        case 'date': return checkValue(v, value).ok ? value : undefined;
        default: return checkValue(v, value).ok ? clone(value) : undefined;
    }
}
export function coerceField(type, value) {
    if (type === 'number') { const n = typeof value === 'number' ? value : (typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN); return Number.isFinite(n) ? n : fieldDefault(type); }
    if (type === 'boolean') return truthy(value);
    if (type === 'date') return isDate(value) ? value : '';
    return value === undefined || value === null ? fieldDefault(type) : String(value);
}

// ---------- scenarios (Preview only): the outcomes a Simulated request can have ----------
export const SCENARIO_KINDS = ['success', 'error', 'empty'];
export const DEFAULT_SCENARIOS = [
    { id: 'success', name: 'Success', kind: 'success' },
    { id: 'error', name: 'Error', kind: 'error' },
    { id: 'empty', name: 'Empty', kind: 'empty' },
];
export function normalizeScenarios(raw) {
    const seen = new Set(), out = [];
    for (const s of Array.isArray(raw) ? raw : []) {
        if (!s || typeof s.id !== 'string' || !s.id || seen.has(s.id)) continue;
        seen.add(s.id);
        out.push({ id: s.id, name: String(s.name ?? 'Outcome').trim() || 'Outcome', kind: SCENARIO_KINDS.includes(s.kind) ? s.kind : 'error' });
    }
    return out;
}
/** The scenarios of a file: its own, else the three defaults. */
export const scenariosOf = state => (state?.scenarios?.length ? state.scenarios : DEFAULT_SCENARIOS);

/** Values Preview provides on its own (not State): usable in conditions and templates, read-only. */
export const BUILTINS = [
    { id: '$loading', name: 'Request in progress', type: 'boolean' },
    { id: '$response', name: 'Last response', type: 'string' },
    { id: '$responseKind', name: 'Last response type', type: 'string' },
    { id: '$formValid', name: 'Form valid (last submit)', type: 'boolean' },
    { id: '$isDirty', name: 'Form changed', type: 'boolean' },
];
