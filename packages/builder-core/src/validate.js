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
 * One input of a screen, as Preview sees it: its type (text / email / number / password), whether it is required, its value.
 * The same rules as the generated forms (validateField), so Preview and the app agree.
 * `touched`: the field had text once; `strict`: an empty required field is wrong even if nobody touched it (a submit).
 * → { valid: true } or { valid: false, reason: 'required' | 'email' | 'number' | 'rule', message }
 */
export function validateInput({ inputType = 'text', required = false, label = 'This field' } = {}, value, { touched = true, strict = false } = {}) {
    const t = String(value ?? '').trim();
    const field = { name: 'input', label, type: inputType === 'number' ? 'number' : 'string', required, rules: inputType === 'email' ? ['email'] : [] };
    if (!t) {
        if (required && (strict || touched)) return { valid: false, reason: 'required', message: validateField(field, '') };
        return { valid: true };
    }
    if (inputType === 'number' && !Number.isFinite(Number(t))) return { valid: false, reason: 'number', message: `${label} must be a number.` };
    const message = validateField(field, t);
    return message ? { valid: false, reason: inputType === 'email' ? 'email' : 'rule', message } : { valid: true };
}
