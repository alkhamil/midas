// Rules: an ordered list of named rules on an interaction. The first enabled rule whose condition holds runs its actions, then
// nothing else is looked at; if none holds, the optional "otherwise" runs. Pure.
//   rules = { items: [{ id, name, enabled, if?, actions }], otherwise?: { actions } }
import { evaluate } from './expr.js';
import { truthy } from './state.js';

const isPlain = v => !!v && typeof v === 'object' && !Array.isArray(v);

/** Rules as the file keeps them. `normalizeActions` normalizes a list of actions (passed in: behavior.js owns it). */
export function normalizeRules(raw, normalizeActions) {
    if (!isPlain(raw)) return undefined;
    const seen = new Set(), items = [];
    for (const [i, r] of (Array.isArray(raw.items) ? raw.items : []).entries()) {
        if (!isPlain(r)) continue;
        let id = typeof r.id === 'string' && r.id ? r.id : `r${i + 1}`;
        while (seen.has(id)) id += '_';
        seen.add(id);
        items.push({ id, name: String(r.name ?? `Rule ${i + 1}`).trim() || `Rule ${i + 1}`, enabled: r.enabled !== false, ...(isPlain(r.if) ? { if: structuredClone(r.if) } : {}), actions: normalizeActions(r.actions) });
    }
    const otherwise = isPlain(raw.otherwise) ? { actions: normalizeActions(raw.otherwise.actions) } : undefined;
    return items.length || otherwise ? { items, ...(otherwise ? { otherwise } : {}) } : undefined;
}

/** Does a condition hold? → { ok, value } or { ok: false, error }. No condition = always. */
export function testCondition(cond, env) {
    if (!isPlain(cond)) return { ok: true, value: true };
    const r = evaluate(cond, env);
    return r.ok ? { ok: true, value: truthy(r.value) } : r;
}

/**
 * Which rule runs. `test(cond)` → boolean (a broken condition counts as "no": the host reports it).
 * → { via: 'rule', rule } | { via: 'otherwise', rule: null, actions } | null
 */
export function selectRule(rules, test) {
    if (!rules) return null;
    for (const rule of rules.items || [])
        if (rule.enabled !== false && (!rule.if || test(rule.if))) return { via: 'rule', rule, actions: rule.actions };
    return rules.otherwise ? { via: 'otherwise', rule: null, actions: rules.otherwise.actions } : null;
}

/** One line for the rule list: "If Attempts is at least 5 → 2 actions". `describe(cond)` writes a condition in words. */
export function ruleSummary(rule, describe) {
    const n = rule.actions.length;
    return `${rule.if ? `If ${describe(rule.if)}` : 'Always'} → ${n} ${n === 1 ? 'action' : 'actions'}`;
}
