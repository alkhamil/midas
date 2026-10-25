// Select logic: options, value (one pick or a list of picks), search, chips and validation. Pure: the popup that draws it lives in
// Preview. The same functions drive a standalone Dropdown (its own items, no value).
import { validateByRules } from './validate.js';

/** The options of a Select or Dropdown: [{ value, label, disabled? }]. */
export function normalizeOptions(raw) {
    const seen = new Set(), out = [];
    for (const o of Array.isArray(raw) ? raw : []) {
        const value = o && typeof o === 'object' ? o.value : o;
        if (value === undefined || value === null || value === '') continue;
        const v = String(value);
        if (seen.has(v)) continue;
        seen.add(v);
        out.push({ value: v, label: String(o?.label ?? v), ...(o?.disabled ? { disabled: true } : {}) });
    }
    return out;
}

/** "a, b, c" or "a=Alpha, b=Beta" → options (what the options box of the editor accepts). */
export function parseOptions(text) {
    return normalizeOptions(String(text ?? '').split(',').map(p => p.trim()).filter(Boolean).map(p => { const i = p.indexOf('='); return i > 0 ? { value: p.slice(0, i).trim(), label: p.slice(i + 1).trim() } : { value: p }; }));
}
export const optionsText = options => (options || []).map(o => (o.label === o.value ? o.value : `${o.value}=${o.label}`)).join(', ');

/** Options whose label contains the query (case does not matter). An empty query keeps everything. */
export function filterOptions(options, query) {
    const q = String(query ?? '').trim().toLowerCase();
    return q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
}

/** The value of a Select: '' (nothing) or one value in single mode, a list in multiple mode. */
export const emptyValue = mode => (mode === 'multiple' ? [] : '');
export const toValue = (mode, v) => (mode === 'multiple' ? (Array.isArray(v) ? v.map(String) : v ? [String(v)] : []) : Array.isArray(v) ? String(v[0] ?? '') : String(v ?? ''));
export const hasValue = value => (Array.isArray(value) ? value.length > 0 : String(value ?? '') !== '');

/**
 * Picking an option. Single: it becomes the value and the popup closes (picking the same one again keeps it).
 * Multiple: it is toggled in the list and the popup stays open. A disabled option does nothing.
 * → { value, closes, changed }
 */
export function pickOption(mode, current, option) {
    const cur = toValue(mode, current);
    if (!option || option.disabled) return { value: cur, closes: false, changed: false };
    if (mode === 'multiple') {
        const next = cur.includes(option.value) ? cur.filter(x => x !== option.value) : [...cur, option.value];
        return { value: next, closes: false, changed: true };
    }
    return { value: option.value, closes: true, changed: cur !== option.value };
}

/** A chip's remove (multiple), or the clear icon. */
export function removeValue(mode, current, value) {
    if (mode !== 'multiple') return emptyValue(mode);
    return toValue(mode, current).filter(x => x !== String(value));
}

/** The labels of what is picked, in the order of the picks (a pick that is no longer an option keeps its value as label). */
export function selectedLabels(options, value) {
    const by = new Map(options.map(o => [o.value, o.label]));
    return (Array.isArray(value) ? value : hasValue(value) ? [value] : []).map(v => by.get(String(v)) ?? String(v));
}

/** What the value slot shows: the label (single) or the labels joined (when there are no chips). */
export function valueText(options, value) { return selectedLabels(options, value).join(', '); }

/**
 * The look of each row of the popup: 'disabled', 'selected', 'hover' (the row under the pointer) or 'default'.
 * `rows` are the options after the search; `hover` the index in `rows` or -1.
 */
export function itemStates(rows, value, hover = -1) {
    const picked = new Set((Array.isArray(value) ? value : hasValue(value) ? [value] : []).map(String));
    return rows.map((o, i) => (o.disabled ? 'disabled' : picked.has(o.value) ? 'selected' : i === hover ? 'hover' : 'default'));
}

/** Search shows the `empty` slot when the search leaves nothing. */
export const showsEmpty = (options, query) => filterOptions(options, query).length === 0;

/** Select rules (required, min / max / len picks) through the shared validator. → { valid, reason?, message? } */
export function validateSelection(rules, value, label = 'This field', opts = {}) {
    return validateByRules({ ...(rules || {}) }, value, { label, ...opts });
}
