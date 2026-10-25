// The evaluation context Preview reads bindings from: the current State values plus the derived values computed from them.
// Pure (no DOM). One per Preview; `reset()` is what happens when Preview opens and when its Reset button is pressed.
import { checkValue, initialValues, interpolate, schemaOf } from './state.js';
import { resolveRowRef, resolveRowName } from './collection.js';
import { evaluateState } from './expr.js';

const clone = v => (v === undefined ? undefined : structuredClone(v));

export function createEvalCtx(state) {
    const st = state && Array.isArray(state.variables) ? state : { variables: [], derived: [] };
    const byId = new Map(st.variables.map(v => [v.id, v]));
    let values = initialValues(st);
    let derived = evaluateState(st, values);
    // What Preview itself knows (a request in progress, the last response): read-only for the design, set by the host.
    const extras = { loading: false, response: '', responseKind: '' };
    const recompute = () => { derived = evaluateState(st, values); };
    const builtin = ref => ref === '$loading' ? { found: true, value: extras.loading } : ref === '$response' ? { found: true, value: extras.response } : ref === '$formValid' ? { found: true, value: extras.formValid } : ref === '$isDirty' ? { found: true, value: !!extras.isDirty } : ref === '$responseKind' ? { found: true, value: extras.responseKind } : null;
    const api = {
        state: st,
        has: id => values.has(id) || (st.derived || []).some(d => d.id === id),
        /** The current value of a state variable or a derived variable (undefined when unknown or broken). */
        get: id => (values.has(id) ? values.get(id) : derived.values.get(id)),
        /** 'state' | 'derived' | null */
        kind: id => (byId.has(id) ? 'state' : (st.derived || []).some(d => d.id === id) ? 'derived' : null),
        /** Set a state variable. Derived variables are read-only. → { ok } or { ok: false, error } (nothing changes on an error). */
        set(id, value) {
            const v = byId.get(id);
            if (!v) return { ok: false, error: (st.derived || []).some(d => d.id === id) ? 'A derived value cannot be set.' : 'Unknown variable.' };
            const c = checkValue(v, value);
            if (!c.ok) return c;
            values.set(id, clone(value));
            recompute();
            return { ok: true };
        },
        /** The initial value of a state variable (a copy). */
        initial: id => clone(byId.get(id)?.initial),
        /** Back to the initial values: every variable (Preview open, Reset) or only the ones of scope page (leaving a page). */
        reset(scopes = ['page', 'app']) {
            const fresh = initialValues(st);
            for (const v of st.variables) if (scopes.includes(v.scope)) values.set(v.id, fresh.get(v.id));
            recompute();
        },
        /** The error of a derived variable (a loop, an unknown variable…), else null. */
        error: id => derived.errors.get(id) || null,
        /** Values the host provides: { loading, response, responseKind }. Read in expressions as $loading, $response, $responseKind. */
        setExtra(key, value) { extras[key] = value; },
        extra: key => extras[key],
        /** { found, value } of a variable by its name (case does not matter), or of a $builtin. Used by {placeholders}. */
        lookupName(name, row) {
            const b = builtin(name) || resolveRowName(name, row);
            if (b) return b;
            const n = String(name).toLowerCase();
            const v = st.variables.find(x => x.name.toLowerCase() === n) || (st.derived || []).find(x => x.name.toLowerCase() === n);
            return v && !api.error(v.id) ? { found: true, value: api.get(v.id) } : { found: false };
        },
        /** A text with {placeholders} filled in. */
        interpolate: (text, row) => interpolate(text, name => api.lookupName(name, row)),
        /**
         * What expressions read: states, derived values and $builtins. `fieldValid(layerId)` → boolean | undefined is supplied by the
         * host for conditions (derived values cannot depend on a field). `opts.row` = the row context inside a table row
         * (rowContext() of collection.js): $row.<field>, $rowIndex and $isSelected are then readable.
         */
        env(opts = {}) {
            return {
                fieldValid: opts.fieldValid,
                schemaOf: ref => schemaOf(byId.get(ref)),
                resolve: ref => {
                    const rr = resolveRowRef(ref, opts.row);
                    if (rr) return rr;
                    const b = builtin(ref);
                    if (b) return b;
                    if (!api.has(ref)) return { found: false };
                    const err = api.error(ref);
                    return err ? { found: true, error: err } : { found: true, value: api.get(ref) };
                },
            };
        },
    };
    return api;
}
