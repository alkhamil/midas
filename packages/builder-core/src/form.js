// Form container: the fields of a frame, one validation pass on submit, the dirty state, and reset. Pure: no layers, no drawing.
// A field is { id, label, rules, value, initial, include? }. The fields come in the order of the form (the first invalid one gets focus).
import { validateByRules } from './validate.js';

const same = (a, b) => JSON.stringify(a ?? '') === JSON.stringify(b ?? '');

/**
 * Submit: every included field is checked in one pass (strict: an empty required field is wrong).
 * → { valid, errors: { [id]: message }, firstInvalid: id or null }. A valid form gives onFinish, an invalid one onFinishFailed.
 */
export function submitForm(fields) {
    const errors = {};
    let firstInvalid = null;
    for (const f of fields) {
        if (f.include === false) continue;
        const r = validateByRules(f.rules || {}, f.value ?? '', { label: f.label || f.id, touched: true, strict: true });
        if (!r.valid) {
            errors[f.id] = r.message;
            firstInvalid ??= f.id;
        }
    }
    return { valid: firstInvalid === null, errors, firstInvalid };
}

/** The outcome event of a submit: onFinish when valid, onFinishFailed when not. */
export const outcomeOf = result => (result.valid ? 'onFinish' : 'onFinishFailed');

/** Dirty: some included field has a value different from its initial one (Save is enabled only then). */
export const isDirty = fields => fields.some(f => f.include !== false && !same(f.value, f.initial));

/** Reset: every field back to its initial value, and no error state left. */
export const resetForm = fields => fields.map(f => ({ ...f, value: f.initial, error: undefined }));
