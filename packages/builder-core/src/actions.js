// Actions on State, feedback and simulated requests, and the runner that plays an interaction (if → actions → rules).
// Pure: everything outside State (navigating, opening an overlay, drawing) goes through the `host` the caller supplies, so the
// same code runs in Preview and in tests.
import { evaluate, compareValues } from './expr.js';
import { coerceField, coerceTo, schemaOf, scenariosOf, DEFAULT_SCENARIOS } from './state.js';
import { selectRule, testCondition } from './rules.js';
import { normalizeFeedbackMotion } from './feedbackMotion.js';

const isPlain = v => !!v && typeof v === 'object' && !Array.isArray(v);
const lit = value => ({ op: 'value', value });

export const STATE_ACTIONS = [
    { id: 'set-state', label: 'Set State' },
    { id: 'list-add', label: 'Add row to list' },
    { id: 'list-update', label: 'Update rows of list' },
    { id: 'list-delete', label: 'Delete rows of list' },
    { id: 'list-clear', label: 'Clear list' },
    { id: 'show-feedback', label: 'Show feedback' },
    { id: 'validate-field', label: 'Check field' },
    { id: 'submit-form', label: 'Submit form' },
    { id: 'reset-form', label: 'Reset form' },
    { id: 'request', label: 'Simulated request' },
];
export const STATE_ACTION_IDS = new Set(STATE_ACTIONS.map(a => a.id));
export const SET_OPS = [
    { id: 'set', label: 'Set to' }, { id: 'increment', label: 'Increase by' }, { id: 'decrement', label: 'Decrease by' },
    { id: 'toggle', label: 'Toggle' }, { id: 'reset', label: 'Reset to initial' },
];
export const FEEDBACK_KINDS = [
    { id: 'alert', label: 'Alert' }, { id: 'message', label: 'Message' }, { id: 'modal', label: 'Modal' },
    { id: 'drawer', label: 'Drawer' }, { id: 'popconfirm', label: 'Popconfirm' }, { id: 'notification', label: 'Notification' },
];
export const FEEDBACK_LEVELS = ['success', 'error', 'warning', 'info'];
export const FEEDBACK_POSITIONS = [
    { id: 'top', label: 'Top' }, { id: 'top-right', label: 'Top right' }, { id: 'bottom', label: 'Bottom' },
    { id: 'center', label: 'Center' }, { id: 'right', label: 'Right (drawer)' },
];
const BLOCKING_KINDS = new Set(['modal', 'popconfirm']);

/** The placements a feedback component can take: the same list as an Open dropdown, so both read the same way. */
export const PLACEMENTS = [
    'top-start', 'top', 'top-end', 'right-start', 'right', 'right-end',
    'bottom-start', 'bottom', 'bottom-end', 'left-start', 'left', 'left-end',
];

/** The old names of a feedback position, as they map onto a placement. */
const LEGACY_FEEDBACK_POSITION = { top: 'top', 'top-right': 'top-end', bottom: 'bottom', center: 'center', right: 'right' };

const expr = (v, fallback) => (isPlain(v) && typeof v.op === 'string' ? structuredClone(v) : fallback);
const where = w => (isPlain(w) && w.field !== undefined && w.cmp ? { field: String(w.field), cmp: String(w.cmp), value: expr(w.value, lit('')) } : undefined);
const exprMap = m => Object.fromEntries(Object.entries(isPlain(m) ? m : {}).filter(([k]) => k).map(([k, v]) => [k, expr(v, lit(''))]));

/**
 * The part of an action `type` that belongs to this module, as the file keeps it. `normalizeList` normalizes a list of actions
 * (a confirmation runs actions of its own), supplied by behavior.js.
 */
export function normalizeStateAction(type, a, normalizeList) {
    const out = {};
    switch (type) {
        case 'set-state': {
            out.variableId = a?.variableId ? String(a.variableId) : '';
            out.op = SET_OPS.some(o => o.id === a?.op) ? a.op : 'set';
            if (out.op === 'set' || out.op === 'increment' || out.op === 'decrement') out.value = expr(a?.value, lit(out.op === 'set' ? '' : 1));
            break;
        }
        case 'list-add': out.listId = a?.listId ? String(a.listId) : ''; out.row = exprMap(a?.row); break;
        case 'list-update': out.listId = a?.listId ? String(a.listId) : ''; { const w = where(a?.where); if (w) out.where = w; } out.set = exprMap(a?.set); break;
        case 'list-delete': out.listId = a?.listId ? String(a.listId) : ''; { const w = where(a?.where); if (w) out.where = w; } break;
        case 'list-clear': out.listId = a?.listId ? String(a.listId) : ''; break;
        case 'validate-field': out.fieldId = a?.fieldId ? String(a.fieldId) : ''; break;
        case 'request': {
            const d = Number(a?.delay);
            out.delay = Number.isFinite(d) ? Math.min(10000, Math.max(0, Math.round(d))) : 800;
            break;
        }
        case 'show-feedback': {
            out.kind = FEEDBACK_KINDS.some(k => k.id === a?.kind) ? a.kind : 'alert';
            out.level = FEEDBACK_LEVELS.includes(a?.level) ? a.level : 'info';
            out.message = String(a?.message ?? '');
            if (a?.title) out.title = String(a.title);
            out.position = PLACEMENTS.includes(a?.position) || a?.position === 'center' ? a.position : LEGACY_FEEDBACK_POSITION[a?.position] || (out.kind === 'drawer' ? 'right' : out.kind === 'modal' || out.kind === 'popconfirm' ? 'center' : out.kind === 'message' ? 'top' : 'top-end');   // notification: top-right too
            const d = Number(a?.duration);
            out.duration = Number.isFinite(d) ? Math.min(60000, Math.max(0, Math.round(d))) : (out.kind === 'alert' || out.kind === 'message' || out.kind === 'notification' ? 3000 : 0);
            out.blocking = typeof a?.blocking === 'boolean' ? a.blocking : BLOCKING_KINDS.has(out.kind);
            if (a?.componentId) out.componentId = String(a.componentId);       // overrides the file's Convention for this one action
            if (a?.confirmLabel) out.confirmLabel = String(a.confirmLabel);
            out.motion = normalizeFeedbackMotion(a?.motion, out.kind);
            if ((out.kind === 'modal' || out.kind === 'popconfirm') && Array.isArray(a?.onConfirm) && a.onConfirm.length) out.onConfirm = normalizeList(a.onConfirm);
            if (normalizeAppearance(a?.appearance)) out.appearance = normalizeAppearance(a.appearance);
            // Offset from the edge of the frame for its position, and the copy placed on the canvas for this action.
            if (isPlain(a?.offset)) { const ox = Number(a.offset.x) || 0, oy = Number(a.offset.y) || 0; if (ox || oy) out.offset = { x: ox, y: oy }; }
            if (a?.overlayInstanceId) out.overlayInstanceId = String(a.overlayInstanceId);
            if (a?.anchorFrameId) out.anchorFrameId = String(a.anchorFrameId);
            break;
        }
        default: break;
    }
    return out;
}

/** An action in words, for one-line summaries. `nameOf(id)` → the variable's name. */
export function describeAction(a, nameOf = id => id) {
    switch (a?.type) {
        case 'set-state': return `${SET_OPS.find(o => o.id === a.op)?.label || 'Set'} ${nameOf(a.variableId) || '…'}`;
        case 'list-add': return `Add row to ${nameOf(a.listId) || '…'}`;
        case 'list-update': return `Update rows of ${nameOf(a.listId) || '…'}`;
        case 'list-delete': return `Delete rows of ${nameOf(a.listId) || '…'}`;
        case 'list-clear': return `Clear ${nameOf(a.listId) || '…'}`;
        case 'show-feedback': return `Show ${a.kind}${a.message ? `: ${a.message.slice(0, 24)}` : ''}`;
        case 'validate-field': return 'Check field';
        case 'submit-form': return 'Submit form';
        case 'reset-form': return 'Reset form';
        case 'request': return 'Simulated request';
        default: return a?.type || '';
    }
}

// ---------- running State actions ----------
const evalIn = (e, env) => { const r = evaluate(e, env); if (!r.ok) throw new Error(r.error); return r.value; };
const matches = (w, row, env, kind) => {
    if (!w) return true;
    const cell = kind === 'object' ? row?.[w.field] : row;
    return compareValues(w.cmp, cell, evalIn(w.value, env));
};

/**
 * Apply one State action to an evaluation context (`ev`, see evalctx.js). `env` is what expressions read.
 * → { ok: true } or { ok: false, error } (the State is left as it was).
 */
export function runStateAction(a, ev, env) {
    try {
        const id = a.type === 'set-state' ? a.variableId : a.listId;
        const v = ev.state.variables.find(x => x.id === id);
        if (!v) return { ok: false, error: 'Choose a State variable.' };
        const apply = value => { const r = ev.set(v.id, value); if (!r.ok) throw new Error(r.error); };
        if (a.type === 'set-state') {
            const cur = ev.get(v.id);
            if (a.op === 'reset') return apply(ev.initial(v.id)), { ok: true };
            if (a.op === 'toggle') { if (v.type !== 'boolean') throw new Error('Toggle needs a Boolean.'); return apply(!cur), { ok: true }; }
            const raw = evalIn(a.value, env);
            if (a.op === 'set') { const c = coerceTo(v, raw); if (c === undefined) throw new Error(`Cannot put that value into ${v.name}.`); return apply(c), { ok: true }; }
            if (v.type !== 'number') throw new Error('Increase / decrease needs a Number.');
            const by = coerceTo(v, raw);
            if (by === undefined) throw new Error('Increase by needs a number.');
            return apply(a.op === 'increment' ? cur + by : cur - by), { ok: true };
        }
        if (v.type !== 'list') throw new Error(`${v.name} is not a List.`);
        const rows = [...(ev.get(v.id) || [])], kind = v.itemType || 'object', schema = schemaOf(v);
        if (a.type === 'list-clear') return apply([]), { ok: true };
        if (a.type === 'list-add') {
            const row = kind === 'object' ? Object.fromEntries(schema.map(f => [f.key, a.row?.[f.key] ? coerceField(f.type, evalIn(a.row[f.key], env)) : coerceField(f.type, undefined)])) : coerceField(kind, a.row?.value ? evalIn(a.row.value, env) : undefined);
            return apply([...rows, row]), { ok: true };
        }
        if (a.type === 'list-delete') return apply(rows.filter(r => !matches(a.where, r, env, kind))), { ok: true };
        if (a.type === 'list-update') {
            const next = rows.map(r => {
                if (!matches(a.where, r, env, kind)) return r;
                if (kind !== 'object') return a.set?.value ? coerceField(kind, evalIn(a.set.value, env)) : r;
                const copy = { ...r };
                for (const f of schema) if (a.set?.[f.key]) copy[f.key] = coerceField(f.type, evalIn(a.set[f.key], env));
                return copy;
            });
            return apply(next), { ok: true };
        }
        return { ok: false, error: 'Unknown action.' };
    } catch (err) { return { ok: false, error: err.message }; }
}

// ---------- feedback ----------
/**
 * Appearance pinned on an action: the modes of the component's collections and the values of its variant properties.
 * A value is a fixed string, or { stateId } to read a State at runtime. Empty entries mean "Default (as designed)" and are dropped.
 * → { modes?, variants? } or undefined when nothing is pinned.
 */
export function normalizeAppearance(x) {
    if (!isPlain(x)) return undefined;
    const pick = m => Object.fromEntries(Object.entries(isPlain(m) ? m : {}).flatMap(([k, v]) => {
        if (isPlain(v) && typeof v.stateId === 'string' && v.stateId) return [[k, { stateId: v.stateId }]];
        return typeof v === 'string' && v !== '' ? [[k, v]] : [];
    }));
    const modes = pick(x.modes), variants = pick(x.variants);
    if (!Object.keys(modes).length && !Object.keys(variants).length) return undefined;
    return { ...(Object.keys(modes).length ? { modes } : {}), ...(Object.keys(variants).length ? { variants } : {}) };
}
/** The pinned appearance with its State bindings read now: a State that holds nothing (or '') falls back to the default. */
export function resolveAppearance(ap, ev) {
    if (!ap) return undefined;
    const read = m => Object.fromEntries(Object.entries(m || {}).flatMap(([k, v]) => {
        const val = typeof v === 'string' ? v : ev.get(v.stateId);
        return val === undefined || val === null || val === '' ? [] : [[k, String(val)]];
    }));
    const modes = read(ap.modes), variants = read(ap.variants);
    if (!Object.keys(modes).length && !Object.keys(variants).length) return undefined;
    return { modes, variants };
}
/** What the host should draw for a show-feedback action: the message with {placeholders} filled. */
export function resolveFeedback(a, ev) {
    return { kind: a.kind, level: a.level, componentId: a.componentId || '', title: ev.interpolate(a.title || ''), message: ev.interpolate(a.message || ''), position: a.position, placement: a.position, offset: a.offset, anchorFrameId: a.anchorFrameId, duration: a.duration, blocking: !!a.blocking, confirmLabel: a.confirmLabel || '', onConfirm: a.onConfirm || null, motion: normalizeFeedbackMotion(a.motion, a.kind), appearance: resolveAppearance(a.appearance, ev) };
}

// ---------- scenarios ----------
/** The outcome a simulated request ends with: the active scenario of the file (the first one when none is active). */
export function resolveOutcome(state, activeId) {
    const list = scenariosOf(state);
    return list.find(s => s.id === activeId) || list[0] || DEFAULT_SCENARIOS[0];
}
/** The wait of a request: its own delay, times 3 when Slow is on. */
export const requestDelay = (a, slow) => (Number.isFinite(a?.delay) ? a.delay : 800) * (slow ? 3 : 1);

// ---------- running an interaction ----------
/**
 * Play one interaction: its `if`, then its actions in order, then its rules (first match, else "otherwise").
 * host = {
 *   ev            evaluation context (evalctx.js)
 *   env()         expressions' environment (with fieldValid)
 *   perform(a)    run any other action (navigate, overlays, set mode, change variant…)
 *   feedback(f)   draw feedback (resolveFeedback output)
 *   validateField(id)   check a field and show its error; → boolean
 *   request(a)    → Promise of the outcome { id, name, kind }
 *   changed()     State or look changed: redraw
 *   warn(msg)     something is misconfigured (a condition that cannot be evaluated, a State action without a variable)
 * }
 * → { ran: boolean, rule?: name, via?: 'rule' | 'otherwise' }
 */
export async function runInteraction(it, host) {
    const test = cond => { const r = testCondition(cond, host.env()); if (!r.ok) { host.warn?.(r.error); return false; } return r.value; };
    if (it.if && !test(it.if)) return { ran: false };
    await runActions(it.actions || [], host);
    const pick = selectRule(it.rules, test);
    if (!pick) return { ran: true };
    await runActions(pick.actions, host);
    return { ran: true, via: pick.via, rule: pick.rule?.name };
}

export async function runActions(actions, host) {
    for (const a of actions) {
        if (a.type === 'request') {
            host.ev.setExtra('loading', true);
            host.changed?.();
            let outcome;
            try { outcome = await host.request(a); }
            finally { host.ev.setExtra('loading', false); }
            host.ev.setExtra('response', outcome?.name || '');
            host.ev.setExtra('responseKind', outcome?.kind || '');
            host.changed?.();
        }
        else if (a.type === 'show-feedback') host.feedback(resolveFeedback(a, host.ev));
        else if (a.type === 'validate-field') { host.validateField(a.fieldId); host.changed?.(); }
        else if (a.type === 'submit-form') { host.submitForm(a); host.changed?.(); }
        else if (a.type === 'reset-form') { host.resetForm(a); host.changed?.(); }
        else if (STATE_ACTION_IDS.has(a.type)) {
            const r = runStateAction(a, host.ev, host.env());
            if (!r.ok) host.warn?.(r.error);
            host.changed?.();
        }
        else await host.perform(a);
    }
}

/**
 * Does a layer carry interactions of its own? Preview wires a click, hover or press on such a layer even when it is not an instance
 * (a plain frame with On click works like a Button instance). Without this, the interaction is silently never played.
 */
export const hasOwnInteractions = node => Array.isArray(node?.interactions) && node.interactions.length > 0;
