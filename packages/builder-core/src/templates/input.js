/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

/** @type {TemplateSchema} */
export const INPUT = {
    id: 'input',
    name: 'Input',
    // Variables of this component are named `input/<token>` in each collection.
    group: 'input',
    // The element the component is written as. `disabledState` is the persistent state that disables it.
    element: { tag: 'span', attrs: {}, disabledState: 'disabled', blockClickProps: [] },
    anatomy: [
        { id: 'addonBefore', kind: 'text', optional: true },
        { id: 'prefix', kind: 'icon', optional: true, managed: true },
        { id: 'label', kind: 'control' },
        { id: 'suffix', kind: 'icon', optional: true, managed: true },
        { id: 'addonAfter', kind: 'text', optional: true },
    ],
    // The managed icon slots: `show` turns one on, `placement` picks its slot, `component` is the icon it holds. The
    // placement rules are the Button's: start shows the prefix icon, end the suffix icon, both shows both at once.
    icons: [
        { show: 'hasIcon', placement: 'iconPlacement', slot: 'prefix', component: 'prefixIcon', tokens: { colour: 'fg', disabledColour: 'fg-disabled', size: 'iconSize' } },
        { show: 'hasIcon', placement: 'iconPlacement', slot: 'suffix', component: 'suffixIcon', tokens: { colour: 'fg', disabledColour: 'fg-disabled', size: 'iconSize' } },
    ],
    // The control: the label slot drawn as an input holding the value prop (and the placeholder beside it). `clear` is
    // the prop that shows the clear icon, `count` the one that shows the character counter (with `maxlength`).
    control: { slot: 'label', value: 'value', placeholder: 'placeholder', readonly: 'readOnly', maxlength: 'maxLength', clear: 'allowClear', count: 'showCount' },
    // The focus outline: its width and offset are static; its colour is the outline-color token (transparent until focus).
    outline: { width: 2, offset: 1 },
    props: {
        variant: { source: 'variable', collection: 'Variant', modes: ['outlined', 'filled', 'borderless'] },
        status: { source: 'variable', collection: 'Status', modes: ['default', 'error', 'warning'] },
        size: { source: 'variable', collection: 'Size', modes: ['large', 'middle', 'small'] },
        // `node` is the node field the prop writes (see display.js NODE_FIELDS). The value writes the canvas text layer.
        value: { source: 'literal', type: 'string', default: '', node: { key: 'label', field: 'text' } },
        placeholder: { source: 'literal', type: 'string', default: '' },
        maxLength: { source: 'literal', type: 'string', default: '' },
        allowClear: { source: 'literal', type: 'boolean', default: false },
        showCount: { source: 'literal', type: 'boolean', default: false },
        hasIcon: { source: 'literal', type: 'boolean', default: false, requires: ['variant', 'size'] },
        iconPlacement: { source: 'literal', type: 'enum', options: ['start', 'end', 'both'], default: 'start', slots: { start: 'prefix', end: 'suffix', both: ['prefix', 'suffix'] }, visibleIf: { prop: 'hasIcon', is: true } },
        prefixIcon: { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'hasIcon', is: true } },
        suffixIcon: { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'hasIcon', is: true } },
        addonBefore: { source: 'literal', type: 'string', default: '' },
        addonAfter: { source: 'literal', type: 'string', default: '' },
        disabled: { source: 'literal', type: 'boolean', default: false },
        readOnly: { source: 'literal', type: 'boolean', default: false },
    },
    tokens: {
        fromSize: ['height', 'fontSize', 'lineHeight', 'paddingX', 'paddingY', 'gap', 'radius', 'iconSize'],
        fromVariant: ['bg', 'fg', 'border', 'placeholder', 'bg-hover', 'border-hover', 'border-focus', 'bg-disabled', 'fg-disabled', 'outline-color'],
        fromStatus: ['status-border', 'status-border-hover', 'status-border-focus', 'status-outline'],
    },
    // The kind of value each token holds: `length` is a number in px, `ratio` a unitless number, `color` a CSS colour string.
    tokenKinds: {
        height: 'length', fontSize: 'length', lineHeight: 'length', paddingX: 'length', paddingY: 'length', gap: 'length', radius: 'length', iconSize: 'length',
        bg: 'color', fg: 'color', border: 'color', placeholder: 'color', 'bg-hover': 'color', 'border-hover': 'color', 'border-focus': 'color',
        'bg-disabled': 'color', 'fg-disabled': 'color', 'outline-color': 'color',
        'status-border': 'color', 'status-border-hover': 'color', 'status-border-focus': 'color', 'status-outline': 'color',
    },
    // Which base role each token fills, per dimension mode (matched case-insensitively, `default` is the fallback).
    // A value with a slash is another token variable of this template, followed through the bound collection.
    tokenRoles: {
        height: { large: 'height-lg', middle: 'height', small: 'height-sm' },
        fontSize: { large: 'font-lg', middle: 'font', small: 'font-sm' },
        lineHeight: { large: 'line-lg', middle: 'line', small: 'line-sm' },
        paddingX: 'padding-sm', paddingY: 'padding-xs', gap: 'gap', radius: 'radius',
        iconSize: { large: 'icon', middle: 'icon', small: 'icon-sm' },
        bg: { outlined: 'bg', filled: 'bg-subtle', borderless: 'transparent', default: 'bg' },
        fg: 'fg',
        border: { outlined: 'input/status-border', filled: 'transparent', borderless: 'transparent', default: 'input/status-border' },
        placeholder: 'placeholder',
        'bg-hover': { outlined: 'bg', filled: 'bg-subtle', borderless: 'transparent', default: 'bg' },
        'border-hover': { outlined: 'input/status-border-hover', filled: 'transparent', borderless: 'transparent', default: 'input/status-border-hover' },
        'border-focus': { outlined: 'input/status-border-focus', filled: 'transparent', borderless: 'transparent', default: 'input/status-border-focus' },
        'bg-disabled': 'bg-disabled', 'fg-disabled': 'fg-disabled', 'outline-color': 'transparent',
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
        focus: { border: 'border-focus' },
        'focus-visible': { 'outline-color': 'status-outline' },
    },
    // The CSS pseudo-class each state is written as.
    statePseudo: { disabled: ':disabled', hover: ':hover', focus: ':focus', 'focus-visible': ':focus-visible' },
    // Which token drives which property of which node (root, or an anatomy slot). Literal props write their node field (see props).
    display: {
        root: { fill: 'bg', stroke: 'border', radius: 'radius', paddingX: 'paddingX', paddingY: 'paddingY', gap: 'gap' },
        label: { fill: 'fg', fontSize: 'fontSize', lineHeight: 'lineHeight', placeholder: 'placeholder' },
        addonBefore: { fill: 'fg', fontSize: 'fontSize', lineHeight: 'lineHeight' },
        addonAfter: { fill: 'fg', fontSize: 'fontSize', lineHeight: 'lineHeight' },
        prefix: { size: 'iconSize' },
        suffix: { size: 'iconSize' },
    },
    events: [
        { name: 'onFocus', exposeAsTrigger: false },
        { name: 'onBlur', exposeAsTrigger: false },
    ],
};
