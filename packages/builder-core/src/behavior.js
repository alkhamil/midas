// Model perilaku (tab "Behavior") Midas: state mapping ke variable collection, interaction (trigger + action),
// dan perilaku input field. Modul murni (tanpa DOM) supaya dipakai bersama oleh inspector desain
// (studio/src/engine/midas.js), live preview (studio/src/preview/live.js) dan Code Builder
// (studio/src/codebuilder/*).
//
// Tidak ada state hardcoded dari kit ui-standard: setiap state nilai diambil dari sebuah Variable
// (collection + variable) atau dari nilai manual. Preview membaca sumber yang sama, jadi Design dan
// Preview menghasilkan gaya yang sama.

/** Urutan state yang selalu ditanyakan (error hanya untuk input). */
export const STATE_ORDER = ['default', 'hover', 'pressed', 'focused', 'disabled', 'error'];

export const STATE_LABEL = {
    default: 'Default', hover: 'Hover', pressed: 'Pressed', focused: 'Focused',
    disabled: 'Disabled', error: 'Error', typing: 'Typing', filled: 'Filled',
};

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
];

export const ACTIONS = [
    { id: 'navigate', label: 'Navigate' },
    { id: 'open-dropdown', label: 'Open dropdown' },
    { id: 'open-overlay', label: 'Open overlay' },
    { id: 'open-popover', label: 'Open popover / tooltip' },
    { id: 'close-overlay', label: 'Close overlay' },
];

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

export const TYPE_LABEL = { button: 'Button', input: 'Input field', dropdown: 'Dropdown', generic: 'Component' };

/** State apa saja yang boleh ditanyakan untuk sebuah tipe komponen. */
export function statesFor(type) {
    return STATE_ORDER.filter(s => s !== 'error' || type === 'input');
}

/** Rantai fallback state: error → default, pressed → hover → default, … */
const FALLBACK = {
    typing: ['typing', 'focused', 'default'], filled: ['filled', 'default'], focused: ['focused', 'default'],
    error: ['error', 'default'], hover: ['hover', 'default'], pressed: ['pressed', 'hover', 'default'],
    disabled: ['disabled', 'default'],
};

export function stateChain(state) {
    return FALLBACK[state] || [state, 'default'];
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
    return (Array.isArray(list) ? list : []).map((it, i) => ({
        id: it?.id || `i${i + 1}`,
        trigger: TRIGGERS.some(t => t.id === it?.trigger) ? it.trigger : 'onClick',
        action: {
            type: ACTION_MAP[it?.action?.type] ? it.action.type : 'navigate',
            ...(it?.action?.targetFrameId ? { targetFrameId: String(it.action.targetFrameId) } : {}),
            ...(it?.action?.position ? { position: String(it.action.position) } : {}),
            ...(it?.action?.anchor ? { anchor: String(it.action.anchor) } : {}),
            ...(it?.action?.backdrop !== undefined ? { backdrop: !!it.action.backdrop } : {}),
            ...(it?.action?.closeOnBackdrop !== undefined ? { closeOnBackdrop: !!it.action.closeOnBackdrop } : {}),
            ...(it?.action?.close ? { close: String(it.action.close) } : {}),
        },
    }));
}

export function normalizeInputBehavior(b) {
    if (!b || typeof b !== 'object') return null;
    const label = b.label || {};
    const typeable = b.typeable || {};
    const error = b.error || {};
    const validation = b.validation || {};
    return {
        label: {
            exists: label.exists !== false,
            reference: label.reference && typeof label.reference === 'object'
                ? {
                    type: label.reference.type === 'variable' ? 'variable' : 'layer',
                    ...(label.reference.layerId ? { layerId: String(label.reference.layerId) } : {}),
                    ...(label.reference.variableId ? { variableId: String(label.reference.variableId) } : {}),
                    ...(label.reference.collectionId ? { collectionId: String(label.reference.collectionId) } : {}),
                }
                : undefined,
        },
        typeable: {
            frameId: typeable.frameId ? String(typeable.frameId) : undefined,
            placeholder: styleValue(typeable.placeholder),
            valueCollectionId: typeable.valueCollectionId ? String(typeable.valueCollectionId) : undefined,
            valueVariableId: typeable.valueVariableId ? String(typeable.valueVariableId) : undefined,
        },
        error: {
            stateName: error.stateName || 'error',
            // Nama field mengikuti IR spesifikasi; nama pendek lama tetap diterima.
            border: styleValue(error.border ?? error.borderVariable),
            hint: styleValue(error.hint ?? error.hintVariable),
            hintText: error.hintText ? String(error.hintText) : undefined,
            frameId: (error.frameId ?? error.errorFrameId) ? String(error.frameId ?? error.errorFrameId) : undefined,
        },
        validation: { required: !!validation.required },
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
