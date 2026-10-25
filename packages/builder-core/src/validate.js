// Form validation shared by the Studio preview and the generated code. The generated pages use react-hook-form rules
// with the base project's `validation.*` messages; this module reproduces the same rules, order and wording so the
// preview shows exactly what the app will show. Rule order follows react-hook-form: required → min/max → maxLength →
// minLength → pattern → validate.
import { isNumericField, parseRules, titleCase } from './model.js';

/** English wording, identical to `validation.*` in the base project's general.json. */
export const VALIDATION_MESSAGES = {
    required: ({ label }) => `${label} is required.`,
    minLength: ({ label, count }) => `${label} must be at least ${count} characters.`,
    maxLength: ({ label, count }) => `${label} cannot be greater than ${count} characters.`,
    minValue: ({ label, count }) => `${label} must be at least ${count}.`,
    maxValue: ({ label, count }) => `${label} cannot be greater than ${count}.`,
    email: () => 'Email format is invalid.',
    pattern: ({ label }) => `${label} format is invalid.`,
    noEmoticon: () => 'Emoticon is not allowed.',
};
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMOTICON_RE = /\p{Extended_Pictographic}/u;
const empty = v => v === undefined || v === null || String(v).trim() === '';
export const fieldLabelOf = f => f.label || titleCase(f.name);

/** Rules that apply to a field in a form (booleans have none; `password` is only required when creating). */
export function activeRules(field, mode) {
    const r = parseRules(field);
    const textual = !isNumericField(field) && field.type !== 'boolean';
    return {
        required: r.required && textual && !(field.type === 'password' && mode === 'edit'),
        min: r.min !== '' && Number.isFinite(Number(r.min)) ? Number(r.min) : null,
        max: r.max !== '' && Number.isFinite(Number(r.max)) ? Number(r.max) : null,
        email: r.email && textual, pattern: textual ? r.pattern : '', noEmoticon: r.noEmoticon && textual,
        numeric: isNumericField(field),
    };
}

/** First error message of a field (or undefined). */
export function validateField(field, value, mode = 'create') {
    const label = fieldLabelOf(field);
    const r = activeRules(field, mode);
    if (r.required && empty(value)) return VALIDATION_MESSAGES.required({ label });
    if (empty(value)) return undefined;
    const str = String(value);
    if (r.numeric) {
        if (r.min !== null && Number(value) < r.min) return VALIDATION_MESSAGES.minValue({ label, count: r.min });
        if (r.max !== null && Number(value) > r.max) return VALIDATION_MESSAGES.maxValue({ label, count: r.max });
        return undefined;
    }
    if (r.max !== null && str.length > r.max) return VALIDATION_MESSAGES.maxLength({ label, count: r.max });
    if (r.min !== null && str.length < r.min) return VALIDATION_MESSAGES.minLength({ label, count: r.min });
    if (r.email && !EMAIL_RE.test(str)) return VALIDATION_MESSAGES.email({ label });
    if (r.pattern) {
        try { if (!new RegExp(r.pattern).test(str)) return VALIDATION_MESSAGES.pattern({ label }); }
        catch { /* invalid regex is reported by the config validator */ }
    }
    if (r.noEmoticon && EMOTICON_RE.test(str)) return VALIDATION_MESSAGES.noEmoticon({ label });
    return undefined;
}

/** { fieldName: message } for every invalid field. */
export function validateValues(fields, values, mode = 'create') {
    const errors = {};
    for (const f of fields) {
        const msg = validateField(f, values[f.name], mode);
        if (msg) errors[f.name] = msg;
    }
    return errors;
}

/**
 * Ant Design style field rules, evaluated with the same wording as the generated forms.
 *   rules = { required, type: 'string' | 'email' | 'number' | 'integer' | 'url', min, max, len, pattern, message? }
 * min / max / len are a number of characters for text, a size for a number, a count of picks for a list (a multiple Select).
 * `touched`: the field had a value once; `strict`: an empty required field is wrong even if nobody touched it (a submit).
 * → { valid: true } or { valid: false, reason, message } (reason: required, email, number, integer, url, min, max, len, pattern)
 */
export function validateByRules(rules = {}, value, { label = 'This field', touched = true, strict = false } = {}) {
    const r = rules || {}, own = text => (r.message ? String(r.message) : text);
    const bad = (reason, message) => ({ valid: false, reason, message: own(message) });
    const list = Array.isArray(value);
    const isEmpty = list ? value.length === 0 : String(value ?? '').trim() === '';
    if (isEmpty) return r.required && (strict || touched) ? bad('required', VALIDATION_MESSAGES.required({ label })) : { valid: true };
    const text = list ? '' : String(value).trim();
    if (!list) {
        if (r.type === 'email' && !EMAIL_RE.test(text)) return bad('email', VALIDATION_MESSAGES.email({ label }));
        if (r.type === 'url' && !/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(text)) return bad('url', `${label} must be a valid URL.`);
        if ((r.type === 'number' || r.type === 'integer') && !Number.isFinite(Number(text))) return bad('number', `${label} must be a number.`);
        if (r.type === 'integer' && !Number.isInteger(Number(text))) return bad('integer', `${label} must be a whole number.`);
    }
    const numeric = !list && (r.type === 'number' || r.type === 'integer');
    const size = list ? value.length : numeric ? Number(text) : text.length;
    const unit = list ? ' items' : numeric ? '' : ' characters';
    const num = v => (v === undefined || v === null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
    const min = num(r.min), max = num(r.max), len = num(r.len);
    if (len !== null && size !== len) return bad('len', `${label} must be exactly ${len}${unit}.`);
    if (min !== null && size < min) return bad('min', numeric ? VALIDATION_MESSAGES.minValue({ label, count: min }) : `${label} must be at least ${min}${unit}.`);
    if (max !== null && size > max) return bad('max', numeric ? VALIDATION_MESSAGES.maxValue({ label, count: max }) : `${label} cannot be more than ${max}${unit}.`);
    if (r.pattern && !list) {
        try { if (!new RegExp(r.pattern).test(text)) return bad('pattern', VALIDATION_MESSAGES.pattern({ label })); }
        catch { /* an invalid pattern is reported where the rule is edited */ }
    }
    return { valid: true };
}

/**
 * One input of a screen, as Preview sees it: its type (text / email / number / password), whether it is required, its value.
 * The same rules as the generated forms; `rules` adds the Ant style rules of the Has validation capability.
 * → { valid: true } or { valid: false, reason: 'required' | 'email' | 'number' | 'rule' | …, message }
 */
export function validateInput({ inputType = 'text', required = false, label = 'This field', rules } = {}, value, opts = {}) {
    const type = inputType === 'email' ? 'email' : inputType === 'number' ? 'number' : undefined;
    const r = validateByRules({ ...(rules || {}), required: required || !!rules?.required, type: rules?.type || type }, value, { label, ...opts });
    return r.valid || r.reason === 'required' || r.reason === 'email' || r.reason === 'number' ? r : { ...r, reason: 'rule' };
}

/** The type a field rule can ask for. */
export const RULE_TYPES = ['string', 'email', 'number', 'integer', 'url'];
/** Ant style field rules as the file keeps them: required, type, min, max, len, pattern, message (nothing else). */
export function normalizeFieldRules(r = {}) {
    const out = {};
    if (r?.required) out.required = true;
    if (RULE_TYPES.includes(r?.type) && r.type !== 'string') out.type = r.type;
    for (const k of ['min', 'max', 'len']) { const n = r?.[k] === '' || r?.[k] === undefined || r?.[k] === null ? NaN : Number(r[k]); if (Number.isFinite(n)) out[k] = n; }
    if (typeof r?.pattern === 'string' && r.pattern) out.pattern = r.pattern;
    if (typeof r?.message === 'string' && r.message) out.message = r.message;
    return out;
}
/** Is a pattern a regular expression JavaScript can read? → null, or what is wrong with it (the editor says so before Preview has to). */
export function patternProblem(pattern) {
    if (!pattern) return null;
    try { new RegExp(pattern); return null; } catch (e) { return String(e.message).replace(/^Invalid regular expression: /, ''); }
}
