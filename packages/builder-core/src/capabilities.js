// Capabilities: what a component CAN do (type, validate, offer options, open a popup, be clicked, load, show feedback) and the role
// slots each one needs (value, placeholder, popup, item…). A preset is only a bundle of capabilities. Pure.
//
// Where it is kept:
//   Can type and Has validation   live in `inputBehavior` + `typeable` (older files already have them): they are views here
//   On click                      is the `onClick` interaction (nothing new is stored)
//   Has options, Opens popup, Shows items, Has loading, Show feedback
//                                 are entries of `node.behaviors` on the master component: [{ id, kind, enabled, slots, config }]
// An instance inherits them and stores only what it changes: `node.behaviorOverrides = { [id]: { enabled?, slots?, config? } }`.
import { INPUT_TYPE_MAP, PLACEMENTS, normalizePlacement } from './behavior.js';
import { normalizeOptions } from './select.js';
import { normalizeFieldRules } from './validate.js';

export const SLOT_ROLES = {
    value: { label: 'Value', kind: 'text', hint: 'The text that shows what was typed or picked' },
    placeholder: { label: 'Placeholder', kind: 'text', hint: 'Shown while there is no value' },
    label: { label: 'Label', kind: 'text', hint: 'The text of an item' },
    message: { label: 'Message', kind: 'text', hint: 'The text of a message or an error' },
    title: { label: 'Title', kind: 'text', hint: 'The title of a message' },
    chip: { label: 'Chip', kind: 'frame', hint: 'One pick of a multiple Select (it repeats once per pick)' },
    remove: { label: 'Remove icon', kind: 'any', hint: 'The icon in a chip that removes it' },
    popup: { label: 'Popup', kind: 'component', hint: 'The component that opens below (a Dropdown Menu)' },
    item: { label: 'Item', kind: 'frame', hint: 'One row of the list (it repeats once per option)' },
    search: { label: 'Search', kind: 'any', hint: 'The search field of the popup' },
    empty: { label: 'Empty', kind: 'any', hint: 'Shown when a search finds nothing' },
    icon: { label: 'Icon', kind: 'any', hint: 'An icon' },
    close: { label: 'Close', kind: 'any', hint: 'The button that closes it' },
    confirm: { label: 'Confirm', kind: 'any', hint: 'The button that runs “When confirmed” (OK) and closes it' },
    cancel: { label: 'Cancel', kind: 'any', hint: 'The button that only closes it' },
};

export const CAPABILITY_GROUPS = ['Input', 'Action', 'Data', 'Feedback'];
const slot = (role, required = false) => ({ role, required });

/** `backing`: where the data is kept ('behaviors' = node.behaviors, otherwise an older field that is reused). */
export const CAPABILITIES = {
    'can-type': { group: 'Input', label: 'Can type', backing: 'inputBehavior', one: true, slots: [slot('value', true)], events: ['onChange', 'onSearch', 'onSubmit'], blurb: 'People type in it. The text of the value layer is its placeholder.' },
    'has-validation': { group: 'Input', label: 'Has validation', backing: 'inputBehavior', one: true, slots: [], events: ['onFinish', 'onFinishFailed'], needs: ['can-type', 'has-options'], blurb: 'Checks what was entered (required, format, length…).' },
    'has-options': { group: 'Data', label: 'Has options', backing: 'behaviors', one: true, slots: [slot('value', true), slot('placeholder'), slot('chip'), slot('remove')], events: ['onChange', 'onSearch'], blurb: 'Owns a list of options and the picked value (a Select).' },
    'shows-items': { group: 'Data', label: 'Shows items', backing: 'behaviors', one: true, slots: [slot('item', true), slot('label', true), slot('search'), slot('empty')], events: ['onChange'], blurb: 'Draws a list of items (a Dropdown Menu).' },
    'opens-popup': { group: 'Action', label: 'Opens popup', backing: 'behaviors', one: true, slots: [slot('popup', true)], events: ['onOpenChange'], blurb: 'Opens another component below it.' },
    'on-click': { group: 'Action', label: 'On click', backing: 'interactions', one: true, slots: [], events: ['onClick'], blurb: 'Does something when it is clicked.' },
    'has-loading': { group: 'Action', label: 'Has loading', backing: 'behaviors', one: true, slots: [slot('icon')], events: [], needs: ['on-click'], states: ['loading'], blurb: 'Switches to its loading state while a request runs.' },
    'show-feedback': { group: 'Feedback', label: 'Show feedback', backing: 'behaviors', one: true, slots: [slot('message', true), slot('title'), slot('icon'), slot('close'), slot('confirm'), slot('cancel')], events: [], blurb: 'Is drawn when a “Show feedback” action runs.' },
};
export const CAPABILITY_IDS = Object.keys(CAPABILITIES);
export const BEHAVIOR_KINDS = CAPABILITY_IDS.filter(k => CAPABILITIES[k].backing === 'behaviors');

// ---------- configuration ----------
const FEEDBACK_KIND_IDS = ['alert', 'message', 'notification', 'modal', 'drawer', 'popconfirm'];
const LEVELS = ['success', 'error', 'warning', 'info'];

/** The config of a capability as the file keeps it: unknown keys dropped, values legal. */
export function normalizeConfig(kind, c = {}) {
    switch (kind) {
        case 'has-options': return {
            mode: c.mode === 'multiple' ? 'multiple' : 'single', showSearch: !!c.showSearch, allowClear: !!c.allowClear,
            options: normalizeOptions(c.options), ...(c.bindTo ? { bindTo: String(c.bindTo) } : {}),
        };
        case 'shows-items': return { options: normalizeOptions(c.options) };
        case 'opens-popup': return { placement: normalizePlacement(c.placement, 'bottom-start'), matchWidth: c.matchWidth !== false, trigger: c.trigger === 'hover' ? 'hover' : 'click' };
        case 'has-loading': return { state: typeof c.state === 'string' && c.state.trim() ? c.state.trim() : 'loading' };
        case 'show-feedback': {
            const types = {};
            for (const l of LEVELS) if (typeof c.types?.[l] === 'string' && c.types[l]) types[l] = c.types[l];
            return { kind: FEEDBACK_KIND_IDS.includes(c.kind) ? c.kind : 'alert', ...(Object.keys(types).length ? { types } : {}) };
        }
        default: return {};
    }
}

// ---------- behaviors ----------
/** Entries of `node.behaviors`: unknown kinds dropped, one per kind, slots and config cleaned. */
export function normalizeBehaviors(list) {
    const seen = new Set(), ids = new Set(), out = [];
    for (const [i, b] of (Array.isArray(list) ? list : []).entries()) {
        if (!b || !BEHAVIOR_KINDS.includes(b.kind) || seen.has(b.kind)) continue;
        seen.add(b.kind);
        let id = typeof b.id === 'string' && b.id ? b.id : `b${i + 1}${b.kind}`;
        while (ids.has(id)) id += '_';
        ids.add(id);
        const slots = {};
        for (const def of CAPABILITIES[b.kind].slots) if (typeof b.slots?.[def.role] === 'string' && b.slots[def.role]) slots[def.role] = b.slots[def.role];
        out.push({ id, kind: b.kind, enabled: b.enabled !== false, slots, config: normalizeConfig(b.kind, b.config), ...(b.preset ? { preset: String(b.preset) } : {}) });
    }
    return out;
}

/** What an instance changes: { [behavior id]: { enabled?, slots?, config? } } (nothing else). */
export function normalizeOverrides(raw) {
    const out = {};
    for (const [id, o] of Object.entries(raw && typeof raw === 'object' ? raw : {})) {
        const e = {};
        if (typeof o?.enabled === 'boolean') e.enabled = o.enabled;
        if (o?.slots && typeof o.slots === 'object') { const s = {}; for (const [k, v] of Object.entries(o.slots)) if (SLOT_ROLES[k] && typeof v === 'string') s[k] = v; if (Object.keys(s).length) e.slots = s; }
        if (o?.config && typeof o.config === 'object' && !Array.isArray(o.config)) e.config = structuredClone(o.config);
        if (Object.keys(e).length) out[id] = e;
    }
    return out;
}

/** The behaviors an instance really has: the master's, with the instance's overrides on top (a slot override of '' clears it). */
export function resolveBehaviors(base, overrides) {
    const ov = normalizeOverrides(overrides);
    return normalizeBehaviors(base).map(b => {
        const o = ov[b.id];
        if (!o) return b;
        const slots = { ...b.slots };
        for (const [k, v] of Object.entries(o.slots || {})) { if (v) slots[k] = v; else delete slots[k]; }
        return { ...b, enabled: o.enabled ?? b.enabled, slots, config: normalizeConfig(b.kind, { ...b.config, ...(o.config || {}) }) };
    });
}

/** The layer a role is mapped to (or null). */
export const slotOf = (behavior, role) => behavior?.slots?.[role] || null;

/**
 * The slots a capability still needs: [{ role, why }]. Behavior that depends on them must not run (and says why).
 * `exists(layerId)` tells whether a mapped layer is still there.
 */
export function slotIssues(behavior, exists = () => true) {
    const out = [];
    for (const def of CAPABILITIES[behavior.kind]?.slots || []) {
        const id = behavior.slots?.[def.role];
        // A multiple Select draws its pick as chips: its value layer is then optional.
        const required = def.required && !(behavior.kind === 'has-options' && def.role === 'value' && behavior.config?.mode === 'multiple' && behavior.slots?.chip);
        if (required && !id) out.push({ role: def.role, why: `${SLOT_ROLES[def.role].label} is not set.` });
        else if (id && def.role !== 'popup' && !exists(id)) out.push({ role: def.role, why: `The layer for ${SLOT_ROLES[def.role].label} is gone.` });
    }
    return out;
}

// ---------- applicability ----------
/**
 * Does a capability make sense here? ctx = { layers: [{ id, name, type }], hasState(name), has(kind) }.
 * → { ok } or { ok: false, reason }
 */
export function applicability(kind, ctx) {
    const def = CAPABILITIES[kind];
    if (!def) return { ok: false, reason: 'Unknown capability.' };
    if (def.one && ctx.has?.(kind)) return { ok: false, reason: 'Already added.' };
    const text = (ctx.layers || []).some(l => l.type === 'text');
    if ((kind === 'can-type' || kind === 'has-options' || kind === 'show-feedback') && !text) return { ok: false, reason: 'It needs a text layer inside.' };
    if (kind === 'shows-items' && !text) return { ok: false, reason: 'It needs a text layer for the label of an item.' };
    if (def.needs && !def.needs.some(k => ctx.has?.(k))) return { ok: false, reason: `It needs ${def.needs.map(k => CAPABILITIES[k].label).join(' or ')} first.` };
    if (def.states?.length && !def.states.every(s => ctx.hasState?.(s))) return { ok: false, reason: `It needs a “${def.states.join(', ')}” mode in a states collection.` };
    return { ok: true };
}

// ---------- summaries ----------
/** One line for a collapsed section. `nameOf(id)` → the name of a layer or component. */
export function summaryOf(b, nameOf = id => id) {
    const c = b.config || {};
    switch (b.kind) {
        case 'has-options': return `${c.mode === 'multiple' ? 'Multiple' : 'Single'} · ${c.options.length} option${c.options.length === 1 ? '' : 's'}${c.showSearch ? ' · search' : ''}${c.bindTo ? ' · bound to State' : ''}`;
        case 'shows-items': return c.options?.length ? `${c.options.length} own item${c.options.length === 1 ? '' : 's'}` : 'Items come from the Select';
        case 'opens-popup': return b.slots.popup ? `Opens “${nameOf(b.slots.popup)}” ${String(c.placement || 'bottom-start').split('-')[0]}${c.matchWidth ? ', same width' : ''}` : 'No popup component yet';
        case 'has-loading': return `Switches to “${c.state}” while a request runs`;
        case 'show-feedback': return `${c.kind}${c.types ? ' · type from the ' + (Object.keys(c.types).length) + ' mapped levels' : ' · type from its modes'}`;
        default: return CAPABILITIES[b.kind]?.label || b.kind;
    }
}
/** One line for Can type / Has validation, from `inputBehavior`. */
export function inputSummary(kind, ib) {
    const t = ib?.typeable || {}, v = ib?.validation || {}, r = v.rules || {};
    if (kind === 'can-type') return `${INPUT_TYPE_MAP[t.inputType]?.label || 'Text'}${t.frameId ? '' : ' · pick the value layer'}`;
    const parts = [];
    if (v.required || r.required) parts.push('Required');
    if (r.type) parts.push(`${r.type} format`);
    if (r.len != null) parts.push(`exactly ${r.len}`);
    if (r.min != null) parts.push(`min ${r.min}`);
    if (r.max != null) parts.push(`max ${r.max}`);
    if (r.pattern) parts.push('pattern');
    return parts.length ? parts.join(', ') : 'No rules yet';
}

// ---------- presets (Ant Design naming) ----------
/**
 * A preset is a bundle: capabilities (with config), plus events and interactions to start from. No component logic is hardcoded.
 * `match` = words in a component name that suggest it.
 */
const T = (inputType, extra = {}) => ({ kind: 'can-type', config: { inputType, ...extra } });
export const PRESETS = [
    { id: 'button', family: 'Trigger', label: 'Button', match: ['button', 'btn'], caps: [{ kind: 'on-click' }, { kind: 'has-loading' }], events: ['onClick'] },
    { id: 'float-button', family: 'Trigger', label: 'FloatButton', match: ['float button', 'fab'], caps: [{ kind: 'on-click' }, { kind: 'has-loading' }], events: ['onClick'] },
    { id: 'input', family: 'Text entry', label: 'Input', match: ['input', 'text field', 'textfield', 'field'], caps: [T('text'), { kind: 'has-validation', config: { rules: {} } }], events: ['onChange'] },
    { id: 'input-textarea', family: 'Text entry', label: 'Input.TextArea', match: ['textarea', 'text area'], caps: [T('text', { multiline: true }), { kind: 'has-validation', config: { rules: {} } }], events: ['onChange'] },
    { id: 'input-password', family: 'Text entry', label: 'Input.Password', match: ['password'], caps: [T('password'), { kind: 'has-validation', config: { rules: { required: true } } }], events: ['onChange'] },
    { id: 'input-search', family: 'Text entry', label: 'Input.Search', match: ['search'], caps: [T('search')], events: ['onSearch', 'onChange'] },
    { id: 'input-number', family: 'Text entry', label: 'InputNumber', match: ['input number', 'number', 'stepper', 'quantity'], caps: [T('number'), { kind: 'has-validation', config: { rules: { type: 'number' } } }], events: ['onChange'] },
    { id: 'auto-complete', family: 'Text entry', label: 'AutoComplete', match: ['autocomplete', 'auto complete', 'combobox'], caps: [T('text'), { kind: 'has-options', config: { mode: 'single', showSearch: true, options: [] } }, { kind: 'opens-popup', config: {} }], events: ['onSearch', 'onChange'] },
    { id: 'select', family: 'Choice', label: 'Select', match: ['select', 'dropdown field', 'picker'], caps: [{ kind: 'has-options', config: { mode: 'single', options: [] } }, { kind: 'opens-popup', config: {} }, { kind: 'has-validation', config: { rules: {} } }], events: ['onChange', 'onOpenChange'] },
    { id: 'select-multiple', family: 'Choice', label: 'Select mode="multiple"', match: ['multi select', 'multiselect', 'tags'], caps: [{ kind: 'has-options', config: { mode: 'multiple', showSearch: true, options: [] } }, { kind: 'opens-popup', config: {} }, { kind: 'has-validation', config: { rules: {} } }], events: ['onChange', 'onOpenChange'] },
    { id: 'dropdown-menu', family: 'Choice', label: 'Dropdown (menu)', match: ['dropdown menu', 'menu', 'dropdown', 'list'], caps: [{ kind: 'shows-items', config: { options: [] } }], events: ['onChange'] },
    { id: 'radio', family: 'Choice', label: 'Radio', match: ['radio'], caps: [{ kind: 'on-click' }], interactions: [{ trigger: 'onClick', actions: [{ type: 'set-selected', mode: 'exclusive' }] }], events: ['onChange'] },
    { id: 'checkbox', family: 'Choice', label: 'Checkbox', match: ['checkbox', 'check box'], caps: [{ kind: 'on-click' }], interactions: [{ trigger: 'onClick', actions: [{ type: 'set-selected', mode: 'toggle' }] }], events: ['onChange'] },
    { id: 'switch', family: 'Choice', label: 'Switch', match: ['switch', 'toggle'], caps: [{ kind: 'on-click' }], interactions: [{ trigger: 'onClick', actions: [{ type: 'set-selected', mode: 'toggle' }] }], events: ['onChange'] },
    { id: 'segmented', family: 'Choice', label: 'Segmented', match: ['segmented', 'tabs', 'tab'], caps: [{ kind: 'on-click' }], interactions: [{ trigger: 'onClick', actions: [{ type: 'set-selected', mode: 'exclusive' }] }], events: ['onChange'] },
    { id: 'alert', family: 'Feedback', label: 'Alert', match: ['alert', 'banner'], caps: [{ kind: 'show-feedback', config: { kind: 'alert' } }] },
    { id: 'message', family: 'Feedback', label: 'Message', match: ['message', 'toast', 'snackbar'], caps: [{ kind: 'show-feedback', config: { kind: 'message' } }] },
    { id: 'notification', family: 'Feedback', label: 'Notification', match: ['notification'], caps: [{ kind: 'show-feedback', config: { kind: 'notification' } }] },
    { id: 'modal', family: 'Feedback', label: 'Modal', match: ['modal', 'dialog'], caps: [{ kind: 'show-feedback', config: { kind: 'modal' } }] },
    { id: 'drawer', family: 'Feedback', label: 'Drawer', match: ['drawer', 'sheet', 'side panel'], caps: [{ kind: 'show-feedback', config: { kind: 'drawer' } }] },
    { id: 'popconfirm', family: 'Feedback', label: 'Popconfirm', match: ['popconfirm', 'confirm'], caps: [{ kind: 'show-feedback', config: { kind: 'popconfirm' } }] },
];
export const PRESET_FAMILIES = ['Trigger', 'Text entry', 'Choice', 'Feedback'];
export const PRESET_MAP = Object.fromEntries(PRESETS.map(p => [p.id, p]));

/**
 * What applying a preset adds: { behaviors: [{ kind, config, preset }], input: { typeable?, validation? } | null,
 * interactions: [...], events }. The caller writes it (and skips what the component already has).
 */
export function planPreset(id) {
    const p = PRESET_MAP[id];
    if (!p) return null;
    const behaviors = [], plan = { behaviors, input: null, interactions: (p.interactions || []).map(i => structuredClone(i)), events: p.events || [], preset: id };
    for (const c of p.caps) {
        if (c.kind === 'can-type') (plan.input ||= {}).typeable = { inputType: INPUT_TYPE_MAP[c.config?.inputType] ? c.config.inputType : 'text', ...(c.config?.multiline ? { multiline: true } : {}) };
        else if (c.kind === 'has-validation') (plan.input ||= {}).validation = { rules: normalizeFieldRules(c.config?.rules), trigger: 'blur' };
        else if (BEHAVIOR_KINDS.includes(c.kind)) behaviors.push({ kind: c.kind, config: normalizeConfig(c.kind, c.config), preset: id });
    }
    return plan;
}

// ---------- feedback type ----------
const LEVEL_WORDS = { success: ['success', 'succeeded', 'ok', 'done', 'positive'], error: ['error', 'danger', 'failed', 'fail', 'negative', 'critical'], warning: ['warning', 'warn', 'caution'], info: ['info', 'information', 'neutral', 'notice'] };
/**
 * Which of a component's `values` (variant values, or the modes of a type collection) stands for a level (success, error, warning, info).
 * `explicit` = the config's own mapping { level: value }, which always wins. → the value, or null.
 */
export function matchLevel(values, level, explicit) {
    const list = values || [];
    if (explicit?.[level] && list.includes(explicit[level])) return explicit[level];
    const words = LEVEL_WORDS[level] || [level];
    const norm = v => String(v).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return list.find(v => words.includes(norm(v))) ?? list.find(v => words.some(w => norm(v).split(' ').includes(w))) ?? null;
}
/** How many of the four levels a set of values can draw. */
export const levelsCovered = values => ['success', 'error', 'warning', 'info'].filter(l => matchLevel(values, l)).length;
