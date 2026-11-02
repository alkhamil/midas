import { ICON_DEFS, ICON_DISPLAY, ICON_END, ICON_PROPS, ICON_START } from './icon-slots.js';
import { DEFAULT_SIZE_MODE, SIZE_MODES } from './size-modes.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

/** @type {TemplateSchema} */
export const INPUT = {
    id: 'input',
    name: 'Input',
    // The element the component is written as. `disabledState` is the persistent state that disables it.
    element: { tag: 'span', attrs: {}, disabledState: 'disabled', blockClickProps: [] },
    // The icons are Button's (icon-slots.js). The text affixes: `hasPrefix` shows the prefix text on the start side, `hasSuffix` the suffix
    // text on the end side, each only while its text is not empty.
    anatomy: [
        ICON_START,
        { id: 'prefixText', kind: 'text', optional: true, typography: 'addon', shownWhen: { all: [{ prop: 'hasPrefix', is: true }, { prop: 'prefixText', empty: false }] } },
        { id: 'label', kind: 'control', typography: 'value' },
        { id: 'suffixText', kind: 'text', optional: true, typography: 'addon', shownWhen: { all: [{ prop: 'hasSuffix', is: true }, { prop: 'suffixText', empty: false }] } },
        ICON_END,
    ],
    // The managed icon slots (see icon-slots.js).
    icons: ICON_DEFS,
    // The control: the label slot drawn as an input holding the value prop (and the placeholder beside it). `clear` is
    // the prop that shows the clear icon, `count` the one that shows the character counter (with `maxlength`). `hideWhenEmpty`: the
    // value layer is hidden while the value is empty, so the placeholder that shows in its place takes its space and no more.
    control: { slot: 'label', value: 'value', placeholder: 'placeholder', readonly: 'readOnly', maxlength: 'maxLength', minlength: 'minLength', clear: 'allowClear', count: 'showCount', hideWhenEmpty: true },
    // The focus outline: its width and offset are static; its colour is the outline-color token (transparent until focus).
    // The box that owns interaction visuals: the root wrapper reflects the inner control focus and disabled
    // state (`:has()` selectors in the stylesheet). Only a template with a control sets one.
    focusTarget: 'wrapper',
    interaction: { focus: 'halo', wave: false },
    outline: { width: 2, offset: 1 },
    props: {
        variant: { source: 'variable', collection: 'Variant', modes: ['outlined', 'filled', 'borderless'] },
        status: { source: 'variable', collection: 'Status', modes: ['default', 'error', 'warning'] },
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        // `node` is the node field the prop writes (see display.js NODE_FIELDS). The value writes the canvas text layer.
        value: { source: 'literal', type: 'string', default: '', node: { key: 'label', field: 'text' } },
        placeholder: { source: 'literal', type: 'string', default: '', node: { key: 'placeholder', field: 'text' } },
        // The limits are whole numbers, and null for no limit. minLength is never above maxLength (see instance-props.js).
        maxLength: { source: 'literal', type: 'number', default: null },
        minLength: { source: 'literal', type: 'number', default: null, atMost: 'maxLength' },
        allowClear: { source: 'literal', type: 'boolean', default: false },
        showCount: { source: 'literal', type: 'boolean', default: false },
        ...ICON_PROPS,
        hasPrefix: { source: 'literal', type: 'boolean', default: false, requires: ['variant', 'size'] },
        hasSuffix: { source: 'literal', type: 'boolean', default: false, requires: ['variant', 'size'] },
        // The text of each affix is remembered while its switch is off (`remembered`), so switching it back on restores it.
        prefixText: { source: 'literal', type: 'string', default: '', node: { key: 'prefixText', field: 'text' }, visibleIf: { prop: 'hasPrefix', is: true }, remembered: true },
        suffixText: { source: 'literal', type: 'string', default: '', node: { key: 'suffixText', field: 'text' }, visibleIf: { prop: 'hasSuffix', is: true }, remembered: true },
        disabled: { source: 'literal', type: 'boolean', default: false },
        readOnly: { source: 'literal', type: 'boolean', default: false },
    },
    tokens: {
        fromSize: ['height', 'valueTypography', 'addonTypography', 'placeholderTypography', 'clearTypography', 'countTypography', 'paddingX', 'paddingY', 'gap', 'radius', 'iconSize'],
        fromVariant: ['bg', 'fg', 'border', 'placeholder', 'bg-hover', 'border-hover', 'border-focus', 'bg-disabled', 'fg-disabled', 'outline-color', 'outline-color-active'],
        fromStatus: ['status-border', 'status-border-hover', 'status-border-focus', 'status-outline'],
    },
    // The kind of value each token holds: `length` is a number in px, `ratio` a unitless number, `color` a CSS colour string.
    tokenKinds: {
        height: 'length', paddingX: 'length', paddingY: 'length', gap: 'length', radius: 'length', iconSize: 'length',
        valueTypography: 'typography', addonTypography: 'typography', placeholderTypography: 'typography', clearTypography: 'typography', countTypography: 'typography',
        bg: 'color', fg: 'color', border: 'color', placeholder: 'color', 'bg-hover': 'color', 'border-hover': 'color', 'border-focus': 'color',
        'bg-disabled': 'color', 'fg-disabled': 'color', 'outline-color': 'color', 'outline-color-active': 'color',
        'status-border': 'color', 'status-border-hover': 'color', 'status-border-focus': 'color', 'status-outline': 'color',
    },
    // Which base role each token fills, per dimension mode (matched case-insensitively, `default` is the fallback).
    // A value with a slash is another token variable of this template, followed through the bound collection.
    tokenRoles: {
        height: { xs: 'height-xs', sm: 'height-sm', md: 'height', lg: 'height-lg', xl: 'height-xl', default: 'height' },
        valueTypography: {         xs: 'text-xs', sm: 'text-sm', md: 'text-base', lg: 'text-lg', xl: 'text-xl', default: 'text-base' },
        addonTypography: {         xs: 'text-xs', sm: 'text-sm', md: 'text-base', lg: 'text-lg', xl: 'text-xl', default: 'text-base' },
        placeholderTypography: {         xs: 'text-xs', sm: 'text-sm', md: 'text-base', lg: 'text-lg', xl: 'text-xl', default: 'text-base' },
        clearTypography: {         xs: 'text-xs', sm: 'text-sm', md: 'text-base', lg: 'text-lg', xl: 'text-xl', default: 'text-base' },
        countTypography: {         xs: 'text-xs', sm: 'text-sm', md: 'text-base', lg: 'text-lg', xl: 'text-xl', default: 'text-base' },
        paddingX: { xs: 'padding-x-xs', sm: 'padding-x-sm', md: 'input-padding-x-md', lg: 'input-padding-x-lg', xl: 'input-padding-x-xl', default: 'input-padding-x-md' },
        paddingY: { xs: 'padding-y-xs', sm: 'padding-y-sm', md: 'button-padding-y-md', lg: 'button-padding-y-lg', xl: 'button-padding-y-xl', default: 'button-padding-y-md' },
        gap: 'gap-xxs',
        radius: { xs: 'radius-xs', sm: 'radius-sm', md: 'radius', lg: 'radius-lg', xl: 'radius-xl', default: 'radius' },
        iconSize: { xs: 'icon-xs', sm: 'icon-sm', md: 'icon-md', lg: 'icon-lg', xl: 'icon-xl', default: 'icon-md' },
        bg: { outlined: 'bg', filled: 'bg-subtle', borderless: 'transparent', default: 'bg' },
        fg: 'fg',
        border: { outlined: './status-border', filled: 'transparent', borderless: 'transparent', default: './status-border' },
        placeholder: 'placeholder',
        'bg-hover': { outlined: 'bg', filled: 'bg-subtle', borderless: 'transparent', default: 'bg' },
        'border-hover': { outlined: './status-border-hover', filled: 'transparent', borderless: 'transparent', default: './status-border-hover' },
        'border-focus': { outlined: './status-border-focus', filled: 'transparent', borderless: 'transparent', default: './status-border-focus' },
        'bg-disabled': 'bg-disabled', 'fg-disabled': 'fg-disabled', 'outline-color': 'outline-transparent', 'outline-color-active': { outlined: './status-outline', filled: './status-outline', borderless: './status-outline', default: './status-outline' },
        'status-border': { default: 'border', error: 'error', warning: 'warning' },
        'status-border-hover': { default: 'border-hover', error: 'error-hover', warning: 'warning-hover' },
        'status-border-focus': { default: 'border-focus', error: 'error', warning: 'warning' },
        'status-outline': { default: 'outline', error: 'danger-outline', warning: 'warning-outline' },
    },
    // Persistent: stored on the instance and drawn on the canvas. `tokens` says which base token the state replaces.
    persistentStates: {
        disabled: { prop: 'disabled', tokens: { bg: 'bg-disabled', fg: 'fg-disabled' } },
    },
    // Preview only: studio-side, colours only. Never written to the document.
    previewStates: {
        hover: { bg: 'bg-hover', border: 'border-hover' },
        focus: { border: 'border-focus', 'outline-color': 'outline-color-active' },
        'focus-visible': { 'outline-color': 'outline-color-active' },
    },
    // The CSS pseudo-class each state is written as.
    statePseudo: { disabled: ':disabled', hover: ':hover', focus: ':focus', 'focus-visible': ':focus-visible' },
    // The parts the canvas draws beside the value: each is a node in the master and in every instance, shown by its own condition.
    // The text part `count` shows the value's length (see counterLabel); `clear` is a glyph. Play renders each part from its node.
    parts: [
        { id: 'placeholder', kind: 'text', shownWhen: { prop: 'value', empty: true }, typography: 'placeholder' },
        { id: 'clear', kind: 'text', shownWhen: { all: [{ prop: 'allowClear', is: true }, { prop: 'value', empty: false }] }, text: '×', typography: 'clear' },
        { id: 'count', kind: 'text', shownWhen: { prop: 'showCount', is: true }, text: { counter: { value: 'value', max: 'maxLength' } }, typography: 'count' },
    ],
    // What Play draws without a node, and why. The static end state of each is on the canvas through the props above.
    playOnly: [
        { id: 'hover', reason: 'pointer state; the canvas shows the rest state and the Preview panel shows hover' },
        { id: 'focus-halo', reason: 'focus ring follows keyboard focus; the canvas shows the rest state' },
        { id: 'caret', reason: 'the text caret exists only in the live input' },
        { id: 'typing', reason: 'typing changes the value live; the canvas shows the Value prop' },
        { id: 'validation', reason: 'validation has no static visual; error state comes with FormItem rules' },
    ],
    // Which token drives which property of which node (root, an anatomy slot or a part). Literal props write their node field (see props).
    display: {
        root: { fill: 'bg', stroke: 'border', radius: 'radius', height: 'height', paddingX: 'paddingX', paddingY: 'paddingY', gap: 'gap' },
        label: { fill: 'fg', typography: 'valueTypography', placeholder: 'placeholder' },
        prefixText: { fill: 'fg', typography: 'addonTypography' },
        suffixText: { fill: 'fg', typography: 'addonTypography' },
        placeholder: { fill: 'placeholder', typography: 'placeholderTypography' },
        clear: { fill: 'fg', typography: 'clearTypography' },
        count: { fill: 'placeholder', typography: 'countTypography' },
        ...ICON_DISPLAY,
    },
    events: [
        { name: 'onFocus', exposeAsTrigger: false },
        { name: 'onBlur', exposeAsTrigger: false },
    ],
};
