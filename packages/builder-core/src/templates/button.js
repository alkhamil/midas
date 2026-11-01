/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

/** @type {TemplateSchema} */
export const BUTTON = {
    id: 'button',
    name: 'Button',
    // The element the component is written as. `disabledState` is the persistent state that disables it; `blockClickProps` stop onClick.
    element: { tag: 'button', attrs: { type: 'button' }, disabledState: 'disabled', blockClickProps: ['disabled', 'loading'] },
    anatomy: [
        { id: 'iconStart', kind: 'icon', optional: true, managed: true },
        { id: 'label', kind: 'text', typography: 'label' },
        { id: 'iconEnd', kind: 'icon', optional: true, managed: true },
    ],
    // The managed icon slots: `show` turns one on, `placement` picks its slot, `component` is the icon it holds. `tokens` names the
    // tokens that colour and size the icon.
    icons: [
        { show: 'hasIcon', placement: 'iconPlacement', slot: 'iconStart', component: 'icon', tokens: { colour: 'fg', disabledColour: 'fg-disabled', size: 'iconSize' } },
        { show: 'hasIcon', placement: 'iconPlacement', slot: 'iconEnd', component: 'iconEnd', tokens: { colour: 'fg', disabledColour: 'fg-disabled', size: 'iconSize' } },
    ],
    // The focus outline: its width and offset are static; outline-color stays transparent at rest, outline-color-active shows it on interaction. The click wave is configured by interaction.
    outline: { width: 2, offset: 1 },
    interaction: { focus: 'outline', wave: true },
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
        fromSize: ['height', 'labelTypography', 'paddingX', 'paddingY', 'gap', 'radius', 'iconSize'],
        fromVariant: ['bg', 'fg', 'border', 'bg-hover', 'fg-hover', 'border-hover', 'bg-active', 'fg-active', 'border-active', 'bg-disabled', 'fg-disabled', 'outline-color', 'outline-color-active', 'wave-color'],
        fromColor: [
            'color', 'color-hover', 'color-active', 'color-border', 'color-border-hover', 'color-border-active',
            'color-bg', 'color-bg-hover', 'color-bg-active', 'color-text', 'color-text-hover', 'color-text-active',
            'color-text-bg-hover', 'color-text-bg-active', 'color-solid', 'color-solid-hover', 'color-solid-active', 'color-solid-text', 'color-outline',
        ],
    },
    // The kind of value each token holds: `length` is a number in px, `ratio` a unitless number, `color` a CSS colour string.
    tokenKinds: {
        height: 'length', labelTypography: 'typography', paddingX: 'length', paddingY: 'length', gap: 'length', radius: 'length', iconSize: 'length',
        bg: 'color', fg: 'color', border: 'color', 'bg-hover': 'color', 'fg-hover': 'color', 'border-hover': 'color', 'bg-active': 'color', 'fg-active': 'color', 'border-active': 'color',
        'bg-disabled': 'color', 'fg-disabled': 'color', 'outline-color': 'color', 'outline-color-active': 'color', 'wave-color': 'color',
        color: 'color', 'color-hover': 'color', 'color-active': 'color', 'color-border': 'color', 'color-border-hover': 'color', 'color-border-active': 'color',
        'color-bg': 'color', 'color-bg-hover': 'color', 'color-bg-active': 'color', 'color-text': 'color', 'color-text-hover': 'color', 'color-text-active': 'color',
        'color-text-bg-hover': 'color', 'color-text-bg-active': 'color', 'color-solid': 'color', 'color-solid-hover': 'color', 'color-solid-active': 'color', 'color-solid-text': 'color', 'color-outline': 'color',
    },
    // Which base role each token fills, per dimension mode (matched case-insensitively, `default` is the fallback).
    // A value with a slash is another token variable of this template, followed through the bound collection.
    tokenRoles: {
        height: { xs: 'height-xs', sm: 'height-sm', md: 'height', lg: 'height-lg', xl: 'height-xl', default: 'height' },
        labelTypography: { xs: 'text-xs', sm: 'text-sm', md: 'text-base', lg: 'text-lg', xl: 'text-xl', default: 'text-base' },
        paddingX: { xs: 'padding-x-xs', sm: 'padding-x-sm', md: 'button-padding-x-md', lg: 'button-padding-x-lg', xl: 'button-padding-x-xl', default: 'button-padding-x-md' },
        paddingY: { xs: 'padding-y-xs', sm: 'padding-y-sm', md: 'button-padding-y-md', lg: 'button-padding-y-lg', xl: 'button-padding-y-xl', default: 'button-padding-y-md' },
        gap: 'gap',
        radius: { xs: 'radius-xs', sm: 'radius-sm', md: 'radius', lg: 'radius-lg', xl: 'radius-xl', default: 'radius' },
        iconSize: { xs: 'icon-xs', sm: 'icon-sm', md: 'icon-md', lg: 'icon-lg', xl: 'icon-xl', default: 'icon-md' },
        bg: { outlined: 'bg', dashed: 'bg', solid: './color-solid', filled: './color-bg', text: 'transparent', link: 'transparent', default: 'bg' },
        fg: { outlined: './color-text', dashed: './color-text', solid: './color-solid-text', filled: './color', text: './color-text', link: './color-text', default: './color-text' },
        border: { outlined: './color-border', dashed: './color-border', solid: 'transparent', filled: 'transparent', text: 'transparent', link: 'transparent', default: './color-border' },
        'bg-hover': { outlined: 'bg', dashed: 'bg', solid: './color-solid-hover', filled: './color-bg-hover', text: 'transparent', link: 'transparent', default: 'bg' },
        'fg-hover': { outlined: './color-text-hover', dashed: './color-text-hover', solid: './color-solid-text', filled: './color', text: './color-text-hover', link: './color-text-hover', default: './color-text-hover' },
        'border-hover': { outlined: './color-border-hover', dashed: './color-border-hover', solid: 'transparent', filled: 'transparent', text: 'transparent', link: 'transparent', default: './color-border-hover' },
        'bg-active': { outlined: 'bg', dashed: 'bg', solid: './color-solid-active', filled: './color-bg-hover', text: 'transparent', link: 'transparent', default: 'bg' },
        'fg-active': { outlined: './color-text-active', dashed: './color-text-active', solid: './color-solid-text', filled: './color', text: './color-text-active', link: './color-text-active', default: './color-text-active' },
        'border-active': { outlined: './color-border-active', dashed: './color-border-active', solid: 'transparent', filled: 'transparent', text: 'transparent', link: 'transparent', default: './color-border-active' },
        'bg-disabled': 'bg-disabled', 'fg-disabled': 'fg-disabled', 'outline-color': 'outline-transparent', 'outline-color-active': './color-outline', 'wave-color': { outlined: './color-border', dashed: './color-border', solid: './bg', filled: './fg', text: './fg', link: './fg', default: './color-border' },
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
    // The parts the canvas draws: the spinner is an arc node before the label, shown while `loading` is set.
    parts: [
        { id: 'spinner', kind: 'frame', shownWhen: { prop: 'loading', is: true }, spin: true, arc: { size: 14, start: -90, sweep: 25, width: 1 } },
    ],
    // What Play draws without a node, and why. The static end state of each is on the canvas through the props and states above.
    playOnly: [
        { id: 'hover', reason: 'pointer state; the canvas shows the rest state and the Preview panel shows hover' },
        { id: 'active', reason: 'pointer press; the canvas shows the rest state and the Preview panel shows active' },
        { id: 'focus-ring', reason: 'keyboard focus ring follows focus; the canvas shows the rest state' },
        { id: 'wave', reason: 'click wave is an animation on click; the canvas has no click' },
    ],
    // Persistent: stored on the instance and drawn on the canvas. `tokens` says which base token the state replaces.
    persistentStates: {
        disabled: { prop: 'disabled', tokens: { bg: 'bg-disabled', fg: 'fg-disabled' } },
    },
    // Preview only: studio-side, colours only. Never written to the document.
    previewStates: {
        hover: { bg: 'bg-hover', fg: 'fg-hover', border: 'border-hover' },
        active: { bg: 'bg-active', fg: 'fg-active', border: 'border-active' },
        focus: { 'outline-color': 'outline-color-active' },
    },
    // The CSS pseudo-class each state is written as.
    statePseudo: { disabled: ':disabled', hover: ':hover', active: ':active', focus: ':focus-visible' },
    // The cross-axis alignment of the root: the label and the icon slots share one centre line, and the height is the Size token.
    // Padding excludes the 1px border (antd's lineWidth is subtracted in the token), and the root is border-box, so the box is exactly `height`.
    rootAlign: 'center',
    // Which token drives which property of which node (root, or an anatomy slot). Literal props write their node field (see props).
    display: {
        root: { fill: 'bg', stroke: 'border', radius: 'radius', height: 'height', paddingX: 'paddingX', paddingY: 'paddingY', gap: 'gap' },
        label: { fill: 'fg', typography: 'labelTypography' },
        iconStart: { size: 'iconSize' },
        iconEnd: { size: 'iconSize' },
        spinner: { stroke: 'fg' },
    },
    events: [
        { name: 'onClick', exposeAsTrigger: true },
        { name: 'onHover', exposeAsTrigger: true },
        { name: 'onFocus', exposeAsTrigger: false },
        { name: 'onBlur', exposeAsTrigger: false },
    ],
};
