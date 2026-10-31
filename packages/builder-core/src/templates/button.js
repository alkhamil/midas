/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

/** @type {TemplateSchema} */
export const BUTTON = {
    id: 'button',
    name: 'Button',
    // Variables of this component are named `button/<token>` in each collection.
    group: 'button',
    // The element the component is written as. `disabledState` is the persistent state that disables it; `blockClickProps` stop onClick.
    element: { tag: 'button', attrs: { type: 'button' }, disabledState: 'disabled', blockClickProps: ['disabled', 'loading'] },
    anatomy: [
        { id: 'iconStart', kind: 'icon', optional: true, managed: true },
        { id: 'label', kind: 'text' },
        { id: 'iconEnd', kind: 'icon', optional: true, managed: true },
    ],
    // The managed icon slots: `show` turns one on, `placement` picks its slot, `component` is the icon it holds. `tokens` names the
    // tokens that colour and size the icon.
    icons: [
        { show: 'hasIcon', placement: 'iconPlacement', slot: 'iconStart', component: 'icon', tokens: { colour: 'fg', disabledColour: 'fg-disabled', size: 'iconSize' } },
        { show: 'hasIcon', placement: 'iconPlacement', slot: 'iconEnd', component: 'iconEnd', tokens: { colour: 'fg', disabledColour: 'fg-disabled', size: 'iconSize' } },
    ],
    // The focus outline: its width and offset are static; its colour is the outline-color token (transparent until focus).
    outline: { width: 2, offset: 1 },
    props: {
        variant: { source: 'variable', collection: 'Variant', modes: ['outlined', 'dashed', 'solid', 'filled', 'text', 'link'], styles: { dashed: { borderStyle: 'dashed' } } },
        color: { source: 'variable', collection: 'Color', modes: ['default', 'primary', 'danger'] },
        size: { source: 'variable', collection: 'Size', modes: ['xs', 'sm', 'md', 'lg', 'xl'] },
        // `node` is the node field the prop writes (see display.js NODE_FIELDS).
        label: { source: 'literal', type: 'string', default: 'Button', node: { key: 'label', field: 'text' } },
        hasIcon: { source: 'literal', type: 'boolean', default: false, requires: ['variant', 'size'] },
        iconPlacement: { source: 'literal', type: 'enum', options: ['start', 'end', 'both'], default: 'start', slots: { start: 'iconStart', end: 'iconEnd', both: ['iconStart', 'iconEnd'] }, visibleIf: { prop: 'hasIcon', is: true } },
        icon: { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'hasIcon', is: true } },
        iconEnd: { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'hasIcon', is: true } },
        loading: { source: 'literal', type: 'boolean', default: false },
        disabled: { source: 'literal', type: 'boolean', default: false },
    },
    tokens: {
        fromSize: ['height', 'fontSize', 'lineHeight', 'paddingX', 'paddingY', 'gap', 'radius', 'iconSize'],
        fromVariant: ['bg', 'fg', 'border', 'bg-hover', 'fg-hover', 'border-hover', 'bg-active', 'fg-active', 'border-active', 'bg-disabled', 'fg-disabled', 'outline-color'],
        fromColor: [
            'color', 'color-hover', 'color-active', 'color-border', 'color-border-hover', 'color-border-active',
            'color-bg', 'color-bg-hover', 'color-bg-active', 'color-text', 'color-text-hover', 'color-text-active',
            'color-text-bg-hover', 'color-text-bg-active', 'color-solid', 'color-solid-hover', 'color-solid-active', 'color-solid-text', 'color-outline',
        ],
    },
    // The kind of value each token holds: `length` is a number in px, `ratio` a unitless number, `color` a CSS colour string.
    tokenKinds: {
        height: 'length', fontSize: 'length', lineHeight: 'length', paddingX: 'length', paddingY: 'length', gap: 'length', radius: 'length', iconSize: 'length',
        bg: 'color', fg: 'color', border: 'color', 'bg-hover': 'color', 'fg-hover': 'color', 'border-hover': 'color', 'bg-active': 'color', 'fg-active': 'color', 'border-active': 'color',
        'bg-disabled': 'color', 'fg-disabled': 'color', 'outline-color': 'color',
        color: 'color', 'color-hover': 'color', 'color-active': 'color', 'color-border': 'color', 'color-border-hover': 'color', 'color-border-active': 'color',
        'color-bg': 'color', 'color-bg-hover': 'color', 'color-bg-active': 'color', 'color-text': 'color', 'color-text-hover': 'color', 'color-text-active': 'color',
        'color-text-bg-hover': 'color', 'color-text-bg-active': 'color', 'color-solid': 'color', 'color-solid-hover': 'color', 'color-solid-active': 'color', 'color-solid-text': 'color', 'color-outline': 'color',
    },
    // Which base role each token fills, per dimension mode (matched case-insensitively, `default` is the fallback).
    // A value with a slash is another token variable of this template, followed through the bound collection.
    tokenRoles: {
        height: { xs: 'height-xs', sm: 'height-sm', md: 'height', lg: 'height-lg', xl: 'height-xl', default: 'height' },
        fontSize: { xs: 'font-xs', sm: 'font-sm', md: 'font', lg: 'font-lg', xl: 'font-xl', default: 'font' },
        lineHeight: { xs: 'line-xs', sm: 'line-sm', md: 'line', lg: 'line-lg', xl: 'line-xl', default: 'line' },
        paddingX: { xs: 'padding-xs', sm: 'padding-sm', md: 'padding', lg: 'padding-lg', xl: 'padding-xl', default: 'padding' },
        paddingY: { xs: 'padding-xs', sm: 'padding-sm', md: 'padding', lg: 'padding-lg', xl: 'padding-xl', default: 'padding' },
        gap: 'gap',
        radius: { xs: 'radius-xs', sm: 'radius-sm', md: 'radius', lg: 'radius-lg', xl: 'radius-xl', default: 'radius' },
        iconSize: { xs: 'icon-xs', sm: 'icon-sm', md: 'icon-md', lg: 'icon-lg', xl: 'icon-xl', default: 'icon-md' },
        bg: { outlined: 'bg', dashed: 'bg', solid: 'button/color-solid', filled: 'button/color-bg', text: 'transparent', link: 'transparent', default: 'bg' },
        fg: { outlined: 'button/color-text', dashed: 'button/color-text', solid: 'button/color-solid-text', filled: 'button/color', text: 'button/color-text', link: 'button/color-text', default: 'button/color-text' },
        border: { outlined: 'button/color-border', dashed: 'button/color-border', solid: 'transparent', filled: 'transparent', text: 'transparent', link: 'transparent', default: 'button/color-border' },
        'bg-hover': { outlined: 'bg', dashed: 'bg', solid: 'button/color-solid-hover', filled: 'button/color-bg-hover', text: 'transparent', link: 'transparent', default: 'bg' },
        'fg-hover': { outlined: 'button/color-text-hover', dashed: 'button/color-text-hover', solid: 'button/color-solid-text', filled: 'button/color', text: 'button/color-text-hover', link: 'button/color-text-hover', default: 'button/color-text-hover' },
        'border-hover': { outlined: 'button/color-border-hover', dashed: 'button/color-border-hover', solid: 'transparent', filled: 'transparent', text: 'transparent', link: 'transparent', default: 'button/color-border-hover' },
        'bg-active': { outlined: 'bg', dashed: 'bg', solid: 'button/color-solid-active', filled: 'button/color-bg-hover', text: 'transparent', link: 'transparent', default: 'bg' },
        'fg-active': { outlined: 'button/color-text-active', dashed: 'button/color-text-active', solid: 'button/color-solid-text', filled: 'button/color', text: 'button/color-text-active', link: 'button/color-text-active', default: 'button/color-text-active' },
        'border-active': { outlined: 'button/color-border-active', dashed: 'button/color-border-active', solid: 'transparent', filled: 'transparent', text: 'transparent', link: 'transparent', default: 'button/color-border-active' },
        'bg-disabled': 'bg-disabled', 'fg-disabled': 'fg-disabled', 'outline-color': 'transparent',
        color: { default: 'text', primary: 'brand', danger: 'danger' },
        'color-hover': { default: 'brand-hover', primary: 'brand-hover', danger: 'danger-hover' },
        'color-active': { default: 'brand-active', primary: 'brand-active', danger: 'danger-active' },
        'color-border': { default: 'text', primary: 'brand', danger: 'danger' },
        'color-border-hover': { default: 'brand-hover', primary: 'brand-hover', danger: 'danger-hover' },
        'color-border-active': { default: 'brand-active', primary: 'brand-active', danger: 'danger-active' },
        'color-bg': { default: 'bg-subtle', primary: 'brand-bg', danger: 'danger-bg' },
        'color-bg-hover': { default: 'bg-subtle', primary: 'brand-bg-hover', danger: 'danger-bg-hover' },
        'color-bg-active': { default: 'bg-subtle', primary: 'brand-bg-hover', danger: 'danger-bg-hover' },
        'color-text': { default: 'text', primary: 'brand', danger: 'danger' },
        'color-text-hover': { default: 'brand-hover', primary: 'brand-hover', danger: 'danger-hover' },
        'color-text-active': { default: 'brand-active', primary: 'brand-active', danger: 'danger-active' },
        'color-text-bg-hover': { default: 'bg-subtle', primary: 'brand-bg-hover', danger: 'danger-bg-hover' },
        'color-text-bg-active': { default: 'bg-subtle', primary: 'brand-bg-hover', danger: 'danger-bg-hover' },
        'color-solid': { default: 'text', primary: 'brand', danger: 'danger' },
        'color-solid-hover': { default: 'brand-hover', primary: 'brand-hover', danger: 'danger-hover' },
        'color-solid-active': { default: 'brand-active', primary: 'brand-active', danger: 'danger-active' },
        'color-solid-text': 'solid-text',
        'color-outline': { default: 'outline', primary: 'outline', danger: 'danger-outline' },
    },
    // Persistent: stored on the instance and drawn on the canvas. `tokens` says which base token the state replaces.
    persistentStates: {
        disabled: { prop: 'disabled', tokens: { bg: 'bg-disabled', fg: 'fg-disabled' } },
    },
    // Preview only: studio-side, colours only. Never written to the document.
    previewStates: {
        hover: { bg: 'bg-hover', fg: 'fg-hover', border: 'border-hover' },
        active: { bg: 'bg-active', fg: 'fg-active', border: 'border-active' },
        focus: { 'outline-color': 'color-outline' },
    },
    // The CSS pseudo-class each state is written as.
    statePseudo: { disabled: ':disabled', hover: ':hover', active: ':active', focus: ':focus-visible' },
    // Which token drives which property of which node (root, or an anatomy slot). Literal props write their node field (see props).
    display: {
        root: { fill: 'bg', stroke: 'border', radius: 'radius', paddingX: 'paddingX', paddingY: 'paddingY', gap: 'gap' },
        label: { fill: 'fg', fontSize: 'fontSize', lineHeight: 'lineHeight' },
        iconStart: { size: 'iconSize' },
        iconEnd: { size: 'iconSize' },
    },
    events: [
        { name: 'onClick', exposeAsTrigger: true },
        { name: 'onHover', exposeAsTrigger: true },
        { name: 'onFocus', exposeAsTrigger: false },
        { name: 'onBlur', exposeAsTrigger: false },
    ],
};
