// Model perilaku (tab "Behavior") Midas: state mapping ke variable collection, interaction (trigger + action),
// dan perilaku input field. Modul murni (tanpa DOM) supaya dipakai bersama oleh inspector desain
// (studio/src/engine/midas.js), live preview (studio/src/preview/live.js) dan Code Builder
// (studio/src/codebuilder/*).
//
// Tidak ada state hardcoded dari kit ui-standard: setiap state nilai diambil dari sebuah Variable
// (collection + variable) atau dari nilai manual. Preview membaca sumber yang sama, jadi Design dan
// Preview menghasilkan gaya yang sama.

/**
 * Every state the Behavior tab knows, in the order they are listed. A state is a name a collection's mode can have; which
 * ones a component uses is up to its collection (Checkbox states has selected / indeterminate / disabled-on …).
 */
import { STATE_ACTIONS, STATE_ACTION_IDS, normalizeStateAction } from './actions.js';
import { normalizeRules } from './rules.js';
import { normalizeFieldRules } from './validate.js';

export const STATE_ORDER = [
    'default', 'hover', 'pressed', 'focused', 'selected', 'typing', 'filled', 'empty', 'indeterminate', 'read-only',
    'disabled', 'disabled-off', 'disabled-on', 'focused-selected', 'focused-indeterminate', 'selected-hover',
    'error', 'error-empty', 'error-filled',
    'loading', 'success', 'today', 'filtered', 'uploading', 'uploaded', 'destructive', 'upcoming', 'completed', 'active', 'inactive',
];

/** The states every component of a kind is asked about, even when its collection has no mode for them. */
const CORE_STATES = ['default', 'hover', 'pressed', 'focused', 'selected', 'typing', 'filled', 'disabled', 'error'];

/** What makes the preview enter a state. Only a hint: the look of each state is the designer's choice. */
export const STATE_HINT = {
    default: 'At rest',
    hover: 'Pointer over it',
    pressed: 'Pointer button held down',
    focused: 'Reached with the keyboard (Tab)',
    selected: 'Clicked, ready to type; or checked / open / current',
    typing: 'Text is being typed',
    filled: 'Left with text in it',
    disabled: 'Cannot be used',
    error: 'Failed validation',
};

export const STATE_LABEL = {
    default: 'Default', hover: 'Hover', pressed: 'Pressed', focused: 'Focused', selected: 'Selected',
    disabled: 'Disabled', error: 'Error', typing: 'Typing', filled: 'Filled',
};

/** A state as the panel shows it: its label, else its id spelled out (disabled-on → Disabled on). */
export function stateLabel(state) {
    if (STATE_LABEL[state]) return STATE_LABEL[state];
    const s = String(state || '').replace(/-/g, ' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Properti gaya yang boleh dipetakan ke variable / nilai manual. */
export const STATE_PROPS = [
    { id: 'fill', label: 'Fill', type: 'color' },
    { id: 'stroke', label: 'Border', type: 'color' },
    { id: 'radius', label: 'Radius', type: 'number' },
    { id: 'text', label: 'Text color', type: 'color' },
    { id: 'opacity', label: 'Opacity', type: 'number' },
];

export const STATE_PROP_MAP = Object.fromEntries(STATE_PROPS.map(p => [p.id, p]));

export const TRIGGERS = [
    { id: 'onClick', label: 'On click' },
    { id: 'onHover', label: 'On hover' },
    { id: 'onMouseEnter', label: 'On mouse enter' },
    { id: 'onFocus', label: 'On focus' },
    { id: 'onBlur', label: 'On blur' },
    { id: 'onChange', label: 'On change' },
    { id: 'onSubmit', label: 'On submit' },
    { id: 'onSearch', label: 'On search' },
    { id: 'onOpenChange', label: 'On open / close' },
    { id: 'onLoad', label: 'On page load' },
    { id: 'onFinish', label: 'On finish (valid)' },
    { id: 'onFinishFailed', label: 'On finish failed (invalid)' },
];

export const ACTIONS = [
    { id: 'navigate', label: 'Navigate' },
    { id: 'open-dropdown', label: 'Open dropdown' },
    { id: 'open-overlay', label: 'Open overlay' },
    { id: 'open-popover', label: 'Open popover / tooltip' },
    { id: 'close-overlay', label: 'Close overlay' },
    { id: 'set-variable', label: 'Set variable' },
    { id: 'set-selected', label: 'Set active / selected' },
    { id: 'change-variant', label: 'Change variant' },
    ...STATE_ACTIONS,
];

/** How Set active / selected changes the layer: flip it, switch it on, or switch it on and the others of its kind off. */
export const SELECT_MODES = [
    { id: 'toggle', label: 'Toggle', hint: 'Flip it: on when it was off, off when it was on. Use it for a checkbox.' },
    { id: 'select', label: 'Select', hint: 'Turn it on and leave it on. Use it for a switch or a menu that stays open.' },
    { id: 'exclusive', label: 'Select only this one', hint: 'Turn it on and turn off the others built from the same component in the same parent. Use it for a radio group or a tab row.' },
];
export const SELECT_MODE_MAP = Object.fromEntries(SELECT_MODES.map(m => [m.id, m]));

/** Gerakan standar preview: jenis transisi yang boleh dipakai sebuah action. */
export const TRANSITIONS = [
    { id: 'dissolve', label: 'Dissolve' },
    { id: 'fade', label: 'Fade' },
    { id: 'fade-scale', label: 'Fade + scale' },
    { id: 'slide-left', label: 'Slide left' },
    { id: 'slide-right', label: 'Slide right' },
    { id: 'slide-up', label: 'Slide up' },
    { id: 'slide-down', label: 'Slide down' },
    { id: 'instant', label: 'Instant (no motion)' },
];
/** Only Change variant uses this one: layers with the same name in the old and the new variant move, resize and recolor into each other. */
export const SMART_ANIMATE = { id: 'smart-animate', label: 'Smart animate' };
/** The transitions a Change variant action offers. */
export const VARIANT_TRANSITIONS = [SMART_ANIMATE, ...TRANSITIONS.filter(t => t.id === 'dissolve' || t.id === 'instant')];
export const TRANSITION_MAP = Object.fromEntries([...TRANSITIONS, SMART_ANIMATE].map(t => [t.id, t]));

/** Posisi overlay di kanvas relatif ke anchor pemicunya (dipakai saat Place on canvas). */
/**
 * Offset overlay sebagai {x, y} (spesifikasi overlay): angka lama tetap dibaca sebagai
 * jarak sisi agar file lama tidak bergeser.
 */
export function offsetXY(offset, position, kind) {
    if (offset && typeof offset === 'object') return { x: Number(offset.x) || 0, y: Number(offset.y) || 0 };
    const n = Number(offset) || 0;
    if (!n) return { x: 0, y: 0 };
    const side = PLACEMENTS.includes(position) ? String(position).split('-')[0] : null;
    const dflt = kind === 'open-dropdown' ? 'bottom' : kind === 'open-popover' ? 'top' : '';
    const s = side || dflt;
    return (s === 'left' || s === 'right') ? { x: n, y: 0 } : (s === 'top' || s === 'bottom') ? { x: 0, y: n } : { x: 0, y: 0 };
}
export function placeOverlayPos(anchor, w, h, position, offset = 0) {
    const gap = (offset && typeof offset === 'object') ? 0 : Number(offset) || 0;
    const ox = (offset && typeof offset === 'object' ? Number(offset.x) : 0) || 0;
    const oy = (offset && typeof offset === 'object' ? Number(offset.y) : 0) || 0;
    const parts = String(position || '').split('-');
    const side = PLACEMENTS.includes(position) ? parts[0] : null;
    const align = PLACEMENTS.includes(position) ? (parts[1] || 'center') : null;
    if (!side) return { x: anchor.x + (anchor.w - w) / 2 + ox, y: anchor.y + (anchor.h - h) / 2 + oy };
    const along = (start, sz, aSz) => align === 'start' ? start : align === 'end' ? start + aSz - sz : start + (aSz - sz) / 2;
    if (side === 'top' || side === 'bottom') return { x: along(anchor.x, w, anchor.w) + ox, y: (side === 'top' ? anchor.y - h - gap : anchor.y + anchor.h + gap) + oy };
    return { x: (side === 'left' ? anchor.x - w - gap : anchor.x + anchor.w + gap) + ox, y: along(anchor.y, h, anchor.h) + oy };
}

/**
 * Overlay portal: an overlay instance lives in its own container, detached from the main
 * layer hierarchy like a Portal. Only the overlay root carries `isOverlay`; its children
 * are ordinary nodes parented under that root. `get` resolves an id to a node shape
 * `{ id, parentId, isOverlay }` (or a falsy value when missing).
 */

/** An overlay root never has a parent: it is the portal container itself. */
export function isOverlayRoot(n) {
    return !!n && !!n.isOverlay && !n.parentId;
}

/** The overlay root owning a node (itself when it is a root), else null. Walks at most 500 levels. */
export function overlayRootOf(node, get) {
    let cur = node || null;
    let top = null;
    for (let i = 0; i < 500 && cur; i++) {
        top = cur;
        const parent = cur.parentId ? get?.(cur.parentId) : null;
        if (!parent) break;
        cur = parent;
    }
    return top && isOverlayRoot(top) ? top : null;
}

/**
 * Whether `source` may be reparented under `target` (null = canvas root) without mixing the
 * overlay portal with the main hierarchy. Reordering inside one overlay stays allowed; an
 * overlay root never takes a parent and nothing crosses the portal boundary in either direction.
 */
export function canReparentOverlay(source, target, get) {
    if (!source) return false;
    const sRoot = overlayRootOf(source, get);
    const tRoot = target ? overlayRootOf(target, get) : null;
    if (isOverlayRoot(source)) return !target;
    if (sRoot) return !!target && !!tRoot && tRoot.id === sRoot.id;
    return !tRoot;
}

/**
 * Overlay portal: split nodes into the main hierarchy and one detached subtree per overlay root.
 * Each overlay root lays out in its own context and never affects the main auto layout (spec).
 * Returns null when there is no overlay root.
 */
export function splitOverlayParts(nodes) {
    const roots = (nodes || []).filter(isOverlayRoot);
    if (!roots.length) return null;
    const byId = new Map(nodes.map(n => [n.id, n]));
    const byParent = new Map();
    for (const n of nodes) {
        const k = n.parentId || null;
        if (!byParent.has(k)) byParent.set(k, []);
        byParent.get(k).push(n);
    }
    const owned = new Set();
    const take = rootId => {
        const out = [], stack = [rootId];
        while (stack.length) {
            const id = stack.pop();
            if (owned.has(id)) continue;
            owned.add(id);
            const n = byId.get(id);
            if (n) out.push(n);
            // Stack (LIFO): dorong anak dari belakang agar keluar sesuai urutan dokumen.
            const ks = byParent.get(id) || [];
            for (let i = ks.length - 1; i >= 0; i--) stack.push(ks[i].id);
        }
        return out;
    };
    const subs = roots.map(r => take(r.id));
    return { main: nodes.filter(n => !owned.has(n.id)), subs };
}

/** Easing standar preview beserta nilai CSS-nya. */
export const MOTION_EASINGS = [
    { id: 'standard', label: 'Standard', css: 'cubic-bezier(0.2, 0, 0, 1)' },
    { id: 'ease-out', label: 'Ease out', css: 'cubic-bezier(0, 0, 0.2, 1)' },
    { id: 'ease-in-out', label: 'Ease in-out', css: 'cubic-bezier(0.4, 0, 0.2, 1)' },
    { id: 'linear', label: 'Linear', css: 'linear' },
    { id: 'spring', label: 'Spring', css: 'cubic-bezier(0.34, 1.4, 0.64, 1)' },
];
export const MOTION_EASING_MAP = Object.fromEntries(MOTION_EASINGS.map(e => [e.id, e]));

/** Durasi default (ms) dan transisi standar tiap jenis gerakan. */
export const MOTION_DEFAULTS = {
    state: { transition: 'dissolve', duration: 150, easing: 'standard' },
    navigate: { transition: 'dissolve', duration: 220, easing: 'standard' },
    'open-dropdown': { transition: 'fade-scale', duration: 180, easing: 'standard' },
    'open-overlay': { transition: 'fade-scale', duration: 200, easing: 'standard' },
    'open-popover': { transition: 'fade-scale', duration: 160, easing: 'standard' },
    'close-overlay': { transition: 'fade', duration: 140, easing: 'ease-out' },
    'change-variant': { transition: 'smart-animate', duration: 250, easing: 'ease-in-out' },
};

/** Gerakan efektif sebuah action: nilai yang diisi dipakai, sisanya mengikuti standar. */
export function resolveMotion(a, kind) {
    const d = MOTION_DEFAULTS[kind] || MOTION_DEFAULTS.navigate;
    const transition = a && TRANSITION_MAP[a.transition] ? a.transition : d.transition;
    let duration = a ? Number(a.duration) : NaN;
    if (!Number.isFinite(duration)) duration = d.duration;
    duration = Math.min(2000, Math.max(0, Math.round(duration)));
    const easing = a && MOTION_EASING_MAP[a.easing] ? a.easing : d.easing;
    return { transition, duration, easing, easingCss: MOTION_EASING_MAP[easing].css };
}

export const ACTION_MAP = Object.fromEntries(ACTIONS.map(a => [a.id, a]));

/** Peran sebuah frame: target mana yang boleh dipilih untuk tiap action. */
export const FRAME_ROLES = [
    { id: 'page', label: 'Page' },
    { id: 'dropdown', label: 'Dropdown' },
    { id: 'overlay', label: 'Overlay / dialog' },
    { id: 'popover', label: 'Popover' },
    { id: 'tooltip', label: 'Tooltip' },
];

export const FRAME_ROLE_MAP = Object.fromEntries(FRAME_ROLES.map(r => [r.id, r]));

/** Role frame yang boleh jadi target sebuah action. */
export const TARGET_ROLES = {
    navigate: ['page'],
    'open-dropdown': ['dropdown'],
    'open-overlay': ['overlay'],
    'open-popover': ['popover', 'tooltip'],
};

/**
 * Scroll Behavior (tab Behavior): Overflow ada di setiap frame; Position untuk node yang child.
 * Default tidak disimpan (no scrolling + scroll with parent) supaya file lama tetap bersih.
 */
export const SCROLL_OVERFLOWS = [
    { id: 'none', label: 'No scrolling' },
    { id: 'both', label: 'Both (scroll horizontal + vertical)' },
    { id: 'horizontal', label: 'Horizontal scrolling' },
    { id: 'vertical', label: 'Vertical scrolling' },
];
export const SCROLL_POSITIONS = [
    { id: 'scroll', label: 'Scroll with parent' },
    { id: 'fixed', label: 'Fixed (stay in place)' },
    { id: 'sticky', label: 'Sticky (stop at top edge)' },
];
/** Nilai scroll sebuah node yang dinormalisasi: hanya non-default yang disimpan. */
export function normalizeScroll(n) {
    const o = {};
    if (SCROLL_OVERFLOWS.some(x => x.id === n?.overflow) && n.overflow !== 'none') o.overflow = n.overflow;
    if (SCROLL_POSITIONS.some(x => x.id === n?.scroll) && n.scroll !== 'scroll') o.scroll = n.scroll;
    return o;
}

export const POSITIONS = [
    { id: 'center', label: 'Center' },
    { id: 'top', label: 'Top' },
    { id: 'bottom', label: 'Bottom' },
    { id: 'left', label: 'Left' },
    { id: 'right', label: 'Right' },
    { id: 'top-left', label: 'Top left' },
    { id: 'top-right', label: 'Top right' },
    { id: 'bottom-left', label: 'Bottom left' },
    { id: 'bottom-right', label: 'Bottom right' },
];

/**
 * Where a dropdown or popover sits around the thing that opened it: a side, then how it lines up along that side.
 * (An overlay is placed on the screen instead: see POSITIONS.)
 */
export const PLACEMENTS = [
    'top-start', 'top', 'top-end', 'right-start', 'right', 'right-end',
    'bottom-start', 'bottom', 'bottom-end', 'left-start', 'left', 'left-end',
];

const LEGACY_PLACEMENT = { 'top-left': 'top-start', 'top-right': 'top-end', 'bottom-left': 'bottom-start', 'bottom-right': 'bottom-end' };

/** Ukuran lebar / tinggi dropdown: ikuti ukuran instance dropdown, atau ikuti ukuran parent (trigger). */
export const DROPDOWN_SIZES = [
    { id: 'self', label: 'Dropdown instance' },
    { id: 'parent', label: 'Match parent' },
];

/** A placement id, also for the corner names used before (bottom-left → bottom-start); `fallback` when it is none of them. */
export function normalizePlacement(pos, fallback = 'bottom-start') {
    const p = LEGACY_PLACEMENT[pos] || pos;
    return PLACEMENTS.includes(p) ? p : fallback;
}

/** Posisi kanonik untuk action open-* di kanvas & preview (default bottom-start untuk dropdown, top untuk popover, center untuk overlay). */
export function actionPlacement(a) {
    if (a?.type === 'open-dropdown') return normalizePlacement(a.position, 'bottom-start');
    if (a?.type === 'open-popover') return normalizePlacement(a.position, 'top');
    return a?.position || 'center';
}

const BUTTON_NAME = /button|btn|cta|action|link|iconbutton/i;
const INPUT_NAME = /input|field|textbox|textarea|select|switch|checkbox|radio/i;
const DROPDOWN_NAME = /dropdown|menu|combobox|listbox/i;

/** Tipe komponen dari namanya (Midas tidak menyimpan tipe komponen terpisah). */
export function componentTypeOf(name) {
    const n = String(name || '');
    if (INPUT_NAME.test(n)) return 'input';
    if (DROPDOWN_NAME.test(n)) return 'dropdown';
    if (BUTTON_NAME.test(n)) return 'button';
    return 'generic';
}

/**
 * Mode names that suggest a state, most specific first. Only a starting point: a state can be pointed at any mode of
 * the collection (see `stateModes`), so designers who name their modes differently are not tied to these.
 */
export const STATE_MODE_NAMES = {
    default: ['default'], hover: ['hover', 'hovered'], pressed: ['pressed'], focused: ['focused', 'focus'],
    selected: ['selected', 'current', 'checked'], typing: ['typing'], filled: ['filled'], empty: ['empty'],
    indeterminate: ['indeterminate'], 'read-only': ['read-only', 'readonly'], disabled: ['disabled'],
    'disabled-off': ['disabled-off'], 'disabled-on': ['disabled-on'],
    'focused-selected': ['focused-selected', 'current-focused', 'selected-focused'], 'focused-indeterminate': ['focused-indeterminate'],
    'selected-hover': ['selected-hover', 'current-hover'],
    error: ['error'], 'error-empty': ['error-empty'], 'error-filled': ['error-filled'],
    loading: ['loading'], success: ['success'], today: ['today'], filtered: ['filtered'], uploading: ['uploading'],
    uploaded: ['uploaded'], destructive: ['destructive'], upcoming: ['upcoming'], completed: ['completed'],
    active: ['active'], inactive: ['inactive'],
};

/**
 * The mode a state reads in a collection: the one the designer picked (`explicit`, a mode id), else the first mode
 * whose name suggests the state (names tried in priority order, not in the collection's order). null = none.
 */
export function modeForState(coll, state, explicit) {
    const modes = coll?.modes || [];
    if (explicit) {
        const m = modes.find(x => x.id === explicit);
        if (m) return m;
    }
    for (const name of STATE_MODE_NAMES[state] || [state]) {
        const m = modes.find(x => String(x.name || '').trim().toLowerCase() === name);
        if (m) return m;
    }
    return null;
}

/** The mode id a node's `stateModes` picked for a state in a collection (undefined = automatic). */
export function pickedModeId(stateModes, collId, state) {
    return stateModes?.[collId]?.[state] || undefined;
}

/** State dari nama sebuah mode; null kalau mode itu bukan state. */
export function stateOfMode(modeName) {
    const name = String(modeName || '').trim().toLowerCase();
    for (const [state, names] of Object.entries(STATE_MODE_NAMES)) {
        if (names.includes(name)) return state;
    }
    return null;
}

/**
 * Nilai variable dalam mode tertentu (alias ikut diselesaikan). `items` dipakai untuk mencari
 * target alias.
 */
export function variableValueInMode(item, coll, modeId, items = [], collections = []) {
    if (!item || !coll || !coll.modes?.length) return undefined;
    const mode = modeId && coll.modes.some(m => m.id === modeId) ? modeId : coll.modes[0].id;
    let v = item.values?.[mode];
    if (v === undefined) v = item.values?.[coll.modes[0].id];
    if (v === undefined) v = coll.modes.map(m => item.values?.[m.id]).find(x => x !== undefined);
    if (v && typeof v === 'object' && v.alias) {
        const target = items.find(i => i.id === v.alias);
        // An alias may point into another collection (e.g. primitives): read it with that collection's own modes.
        const targetColl = collections.find(c => c.id === target?.collectionId) || coll;
        return target ? variableValueInMode(target, targetColl, mode, items, collections) : undefined;
    }
    return v;
}

/** Collection state yang disambungkan ke sebuah node (state → mode). */
export function stateCollectionsOf(node, collections = []) {
    const list = Array.isArray(collections) ? collections : [...(collections.values?.() || [])];
    const out = [];
    for (const [collId, modeId] of Object.entries(node?.varModes || {})) {
        const coll = list.find(c => c.id === collId);
        if (!isStateCollection(coll)) continue;
        const states = (coll.modes || []).map(m => ({ state: stateOfMode(m.name), mode: m })).filter(x => x.state);
        out.push({ coll, states, currentMode: modeId });
    }
    return out;
}

/**
 * Sebuah collection bisa jadi "collection state" kalau namanya menyebut state, atau punya beberapa
 * mode yang berarti state (hover / pressed / focused / …). Collection tema (Light/Dark) bukan state.
 */
export function isStateCollection(coll) {
    if (!coll) return false;
    if (/state/i.test(String(coll.name || ''))) return true;
    const states = (coll.modes || []).map(m => stateOfMode(m.name)).filter(s => s && s !== 'default');
    return new Set(states).size >= 2;
}

export const TYPE_LABEL = { button: 'Button', input: 'Input field', dropdown: 'Dropdown', generic: 'Component' };

/** State apa saja yang boleh ditanyakan untuk sebuah tipe komponen. */
export function statesFor(type) {
    const INPUT_ONLY = ['selected', 'typing', 'filled', 'error'];
    return CORE_STATES.filter(s => type === 'input' || !INPUT_ONLY.includes(s));
}

/** The states listed for one collection: the ones its type is asked about plus every state its modes are named after. */
export function statesIn(coll, type) {
    const have = new Set(statesFor(type));
    for (const m of coll?.modes || []) {
        const s = stateOfMode(m.name);
        if (s) have.add(s);
    }
    return STATE_ORDER.filter(s => have.has(s));
}

/** Rantai fallback state: error → default, pressed → hover → default, … */
const FALLBACK = {
    default: ['default'],
    hover: ['hover', 'default'], pressed: ['pressed', 'hover', 'default'],
    focused: ['focused', 'selected', 'default'], selected: ['selected', 'focused', 'default'],
    typing: ['typing', 'selected', 'focused', 'default'], filled: ['filled', 'default'], empty: ['empty', 'default'],
    indeterminate: ['indeterminate', 'selected', 'default'], 'read-only': ['read-only', 'default'],
    disabled: ['disabled', 'default'], 'disabled-off': ['disabled-off', 'disabled', 'default'],
    'disabled-on': ['disabled-on', 'disabled', 'selected', 'default'],
    'focused-selected': ['focused-selected', 'focused', 'selected', 'default'],
    'focused-indeterminate': ['focused-indeterminate', 'focused', 'indeterminate', 'default'],
    'selected-hover': ['selected-hover', 'selected', 'hover', 'default'],
    error: ['error', 'default'], 'error-empty': ['error-empty', 'error', 'default'], 'error-filled': ['error-filled', 'error', 'default'],
    active: ['active', 'selected', 'default'], inactive: ['inactive', 'default'],
};

export function stateChain(state) {
    return FALLBACK[state] || [state, 'default'];
}

/**
 * The state to draw, from what the preview knows about a layer: its base state (default, hover, focused, error, disabled…)
 * and the flags that stay with it (selected / checked, indeterminate, an empty value). A selected layer that is hovered
 * is "selected-hover", a disabled one is "disabled-on" or "disabled-off", an error is "error-empty" or "error-filled".
 */
export function effectiveState(base, flags = {}) {
    const { selected, indeterminate, empty } = flags;
    switch (base) {
        case 'default': return selected ? 'selected' : indeterminate ? 'indeterminate' : 'default';
        case 'hover': return selected ? 'selected-hover' : 'hover';
        case 'focused': return selected ? 'focused-selected' : indeterminate ? 'focused-indeterminate' : 'focused';
        case 'disabled': return selected ? 'disabled-on' : 'disabled-off';
        case 'error': return empty ? 'error-empty' : 'error-filled';
        default: return base;
    }
}

/** Nilai gaya: variable (collection + variable) atau nilai manual. */
export function styleValue(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const out = {};
    if (raw.collectionId) out.collectionId = String(raw.collectionId);
    if (raw.variableId) out.variableId = String(raw.variableId);
    if (raw.value !== undefined && raw.value !== null && raw.value !== '') out.value = raw.value;
    return Object.keys(out).length ? out : null;
}

export function normalizeStateMapping(mapping) {
    const out = {};
    for (const [state, props] of Object.entries(mapping || {})) {
        if (!props || typeof props !== 'object') continue;
        const row = {};
        for (const [prop, value] of Object.entries(props)) {
            const v = styleValue(value);
            // Slot properti yang belum diisi tetap disimpan: designer sudah memilih propertinya.
            if (v) row[prop] = v;
            else if (value && typeof value === 'object') row[prop] = {};
        }
        if (Object.keys(row).length) out[state] = row;
    }
    return out;
}

export function normalizeInteractions(list) {
    return (Array.isArray(list) ? list : []).map((it, i) => {
        // One interaction runs its actions in order. The single `action` of earlier files is the first of them.
        const raw = Array.isArray(it?.actions) && it.actions.length ? it.actions : it?.action ? [it.action] : it?.rules ? [] : [{}];
        return {
            id: it?.id || `i${i + 1}`,
            trigger: TRIGGERS.some(t => t.id === it?.trigger) ? it.trigger : 'onClick',
            ...(it?.if && typeof it.if === 'object' && !Array.isArray(it.if) ? { if: structuredClone(it.if) } : {}),
            actions: raw.map(normalizeAction),
            ...(it?.rules ? (() => { const r = normalizeRules(it.rules, normalizeActions); return r ? { rules: r } : {}; })() : {}),
        };
    });
}

/**
 * Interaction yang dijalankan sebuah layer: miliknya sendiri bila ada isinya, kalau tidak milik
 * component set / main component-nya. Instance yang sudah punya interaction sendiri tidak ikut
 * berubah ketika interaction komponennya diubah.
 */
export function interactionsForNode(inst, src, set) {
    const own = normalizeInteractions(inst?.interactions);
    if (own.length)
        return { list: own, inherited: false };
    return { list: normalizeInteractions(set?.interactions || src?.interactions || []), inherited: true };
}

/** State yang diwakili sebuah mode collection (dari namanya); null kalau mode itu bukan state. */
export function stateOfModeId(coll, modeId) {
    const mode = (coll?.modes || []).find(m => m.id === modeId);
    return mode ? stateOfMode(mode.name) : null;
}

export const normalizeActions = list => (Array.isArray(list) ? list : []).map(a => normalizeAction(a));

export function normalizeAction(a) {
    const type = ACTION_MAP[a?.type] ? a.type : 'navigate';
    // State, list, feedback, check-field and request actions are described in actions.js.
    if (STATE_ACTION_IDS.has(type)) return { type, ...normalizeStateAction(type, a, normalizeActions) };
    // A dropdown / overlay / popover opens a component. A frame picked before components were offered keeps working
    // until a component replaces it.
    const component = /^open-/.test(type) && a?.targetComponentId ? String(a.targetComponentId) : undefined;
    const out = { type };
    if (component) out.targetComponentId = component;
    if (a?.targetFrameId && !component) out.targetFrameId = String(a.targetFrameId);
    if (a?.position) out.position = type === 'open-dropdown' || type === 'open-popover' ? normalizePlacement(String(a.position), type === 'open-dropdown' ? 'bottom-start' : 'top') : String(a.position);
    if (/^open-/.test(type) && a?.offset !== undefined && a.offset !== '' && a.offset !== null) {
        if (a.offset && typeof a.offset === 'object') {
            const ox = Number(a.offset.x) || 0, oy = Number(a.offset.y) || 0;
            if (ox || oy) out.offset = { x: ox, y: oy };
        }
        else if (Number.isFinite(Number(a.offset))) out.offset = Number(a.offset);
    }
    if (a?.anchor) out.anchor = String(a.anchor);
    if (a?.backdrop !== undefined) out.backdrop = !!a.backdrop;
    if (a?.closeOnBackdrop !== undefined) out.closeOnBackdrop = !!a.closeOnBackdrop;
    if (a?.close) out.close = String(a.close);
    if (type === 'set-variable') {
        // Switch a whole variable collection to one of its modes: every variable in it reads that mode's value.
        if (a?.collectionId) out.collectionId = String(a.collectionId);
        if (a?.modeId) out.modeId = String(a.modeId);
        // Older files set one variable to one value; kept so they keep working until the action is edited.
        if (a?.variableId) out.variableId = String(a.variableId);
        if (a?.value !== undefined && a.value !== null && a.value !== '') out.value = a.value;
    }
    if (type === 'set-selected') out.mode = SELECT_MODE_MAP[a?.mode] ? a.mode : 'toggle';
    if (type === 'change-variant') {
        // variant property → the value it changes to; properties left out keep the value the layer has.
        const picks = {};
        for (const [k, v] of Object.entries(a?.variants && typeof a.variants === 'object' ? a.variants : {}))
            if (k && v !== undefined && v !== null && String(v) !== '') picks[String(k)] = String(v);
        if (Object.keys(picks).length) out.variants = picks;
    }
    if (/^open-/.test(type) && a?.targetVariantId) out.targetVariantId = String(a.targetVariantId);
    if (/^open-/.test(type) && a?.overlayInstanceId) out.overlayInstanceId = String(a.overlayInstanceId);
    if (type === 'open-dropdown') {
        if (a?.width === 'parent') out.width = 'parent';
        if (a?.height === 'parent') out.height = 'parent';
    }
    if (type === 'navigate' || /^open-/.test(type) || type === 'close-overlay' || type === 'change-variant') {
        if (a?.transition && TRANSITION_MAP[a.transition]) out.transition = a.transition;
        if (a?.duration !== undefined && a.duration !== '' && Number.isFinite(Number(a.duration))) out.duration = Math.min(2000, Math.max(0, Math.round(Number(a.duration))));
        if (a?.easing && MOTION_EASING_MAP[a.easing]) out.easing = a.easing;
    }
    return out;
}

export const INPUT_TYPES = [
    { id: 'text', label: 'Text' },
    { id: 'email', label: 'Email' },
    { id: 'password', label: 'Password' },
    { id: 'number', label: 'Number' },
    { id: 'search', label: 'Search' },
];
export const INPUT_TYPE_MAP = Object.fromEntries(INPUT_TYPES.map(t => [t.id, t]));

/** When a field is checked: as the pointer leaves it, as it is typed in, or when Enter is pressed. */
export const VALIDATION_TRIGGERS = [
    { id: 'blur', label: 'On blur (onBlur)' },
    { id: 'change', label: 'On change (onChange)' },
    { id: 'submit', label: 'On submit (onFinish)' },
];
export const VALIDATION_TRIGGER_MAP = Object.fromEntries(VALIDATION_TRIGGERS.map(t => [t.id, t]));

/**
 * What an input field needs beyond its look: the layer that takes the typing, what it accepts, and when it is checked.
 * Label, placeholder and the typed value live in the Appearance tab, and how an error looks comes from State mapping
 * (error-empty / error-filled), so none of them is kept here.
 */
export function normalizeInputBehavior(b) {
    if (!b || typeof b !== 'object') return null;
    const typeable = b.typeable || {};
    const validation = b.validation || {};
    return {
        typeable: {
            frameId: typeable.frameId ? String(typeable.frameId) : undefined,
            // What the field accepts. Text unless the designer says otherwise: nothing is guessed from layer names.
            inputType: INPUT_TYPE_MAP[typeable.inputType] ? typeable.inputType : undefined,
            // Password only: the two icon components that stand for hidden text (an eye) and shown text (a crossed eye).
            // The icon in the field is swapped between them when it is clicked.
            showIconId: typeable.showIconId ? String(typeable.showIconId) : undefined,
            hideIconId: typeable.hideIconId ? String(typeable.hideIconId) : undefined,
            // The State variable the typed text is kept in (a String or a Number state). Nothing is kept when it is not set.
            ...(typeable.bindTo ? { bindTo: String(typeable.bindTo) } : {}),
        },
        validation: {
            required: !!validation.required,
            trigger: VALIDATION_TRIGGER_MAP[validation.trigger] ? validation.trigger : undefined,
            // Ant style rules (required, type, min, max, len, pattern); `required` above stays for files written before them.
            ...(validation.rules && typeof validation.rules === 'object' && Object.keys(normalizeFieldRules(validation.rules)).length ? { rules: normalizeFieldRules(validation.rules) } : {}),
            ...(validation.off ? { off: true } : {}),
        },
    };
}

/**
 * Override gaya untuk sebuah state: setiap properti diambil dari state pertama pada rantai fallback
 * yang memetakannya (mis. pressed → hover → default).
 */
export function overridesFor(mapping, state) {
    const out = {};
    if (!mapping) return out;
    for (const st of stateChain(state)) {
        const row = mapping[st];
        if (!row) continue;
        for (const [prop, value] of Object.entries(row)) {
            if (out[prop] === undefined) out[prop] = value;
        }
        if (Object.keys(out).length && Object.keys(row).length === Object.keys(out).length) break;
    }
    return out;
}

/** Set nilai di dalam object berdasarkan path bertitik (`state.hover.fill`). */
export function setPath(root, path, value) {
    const parts = String(path).split('.');
    let cur = root;
    for (let i = 0; i < parts.length - 1; i++) {
        const k = parts[i];
        if (cur[k] === undefined || cur[k] === null || typeof cur[k] !== 'object') cur[k] = {};
        cur = cur[k];
    }
    cur[parts.at(-1)] = value;
    return root;
}

/** Ambil nilai dari object berdasarkan path bertitik. */
export function getPath(root, path) {
    let cur = root;
    for (const part of String(path).split('.')) {
        if (cur === undefined || cur === null || typeof cur !== 'object') return undefined;
        cur = cur[part];
    }
    return cur;
}

/**
 * Klik kanvas memilih container terluar di atas layer (group / instance / komponen /
 * frame auto layout), tapi tidak pernah menyeberang batas Slot: isi dalam slot milik
 * instance pemakai dan dipilih langsung, jadi delete sesudahnya hanya menghapus
 * bagian yang dipilih, bukan seluruh instance induk.
 */
export function clickPick(layer, ancestors, childCount = 0) {
    const isContainer = p => p.type === 'group' || p.booleanOp || p.isInstance || p.component || (p.type === 'frame' && !!p.layout && p.layout !== 'none');
    const chain = [layer, ...(ancestors || [])];
    const slotAt = chain.findIndex(a => a?.propBind?.slot && a.sourceId);
    if (slotAt === 0 && !childCount) return layer;
    const below = slotAt > 0 ? ancestors.slice(0, slotAt - 1) : ancestors;
    return (below || []).filter(isContainer).pop() || layer;
}
