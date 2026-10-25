// The evaluation context Preview reads bindings from: the current State values plus the derived values computed from them.
// Pure (no DOM). One per Preview; `reset()` is what happens when Preview opens and when its Reset button is pressed.
import { checkValue, initialValues } from './state.js';
import { evaluateState } from './expr.js';

const clone = v => (v === undefined ? undefined : structuredClone(v));

export function createEvalCtx(state) {
    const st = state && Array.isArray(state.variables) ? state : { variables: [], derived: [] };
    const byId = new Map(st.variables.map(v => [v.id, v]));
    let values = initialValues(st);
    let derived = evaluateState(st, values);
    const recompute = () => { derived = evaluateState(st, values); };
    return {
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
        /** Back to the initial values: every variable (Preview open, Reset) or only the ones of scope page (leaving a page). */
        reset(scopes = ['page', 'app']) {
            const fresh = initialValues(st);
            for (const v of st.variables) if (scopes.includes(v.scope)) values.set(v.id, fresh.get(v.id));
            recompute();
        },
        /** The error of a derived variable (a loop, an unknown variable…), else null. */
        error: id => derived.errors.get(id) || null,
    };
}
