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
    // The managed icon slot: `show` turns it on, `placement` picks its slot, `component` is the icon it holds. `tokens` names the tokens
    // that colour and size the icon.
    icon: { show: 'hasIcon', placement: 'iconPlacement', component: 'icon', tokens: { colour: 'fg', disabledColour: 'fg-disabled', size: 'iconSize' } },
    props: {
        variant: { source: 'variable', collection: 'Variant' },
        color: { source: 'variable', collection: 'Color' },
        size: { source: 'variable', collection: 'Size' },
        // `node` is the node field the prop writes (see display.js NODE_FIELDS).
        label: { source: 'literal', type: 'string', default: 'Button', node: { key: 'label', field: 'text' } },
        hasIcon: { source: 'literal', type: 'boolean', default: false },
        iconPlacement: { source: 'literal', type: 'enum', options: ['start', 'end'], default: 'start', slots: { start: 'iconStart', end: 'iconEnd' }, visibleIf: { prop: 'hasIcon', is: true } },
        icon: { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'hasIcon', is: true } },
        loading: { source: 'literal', type: 'boolean', default: false },
        disabled: { source: 'literal', type: 'boolean', default: false },
        block: { source: 'literal', type: 'boolean', default: false, node: { key: 'root', field: 'layoutSizingH' } },
    },
    tokens: {
        fromSize: ['fontSize', 'lineHeight', 'paddingX', 'paddingY', 'gap', 'radius', 'iconSize'],
        fromVariant: ['bg', 'fg', 'border', 'bg-hover', 'fg-hover', 'border-hover', 'bg-active', 'fg-active', 'border-active', 'bg-disabled', 'fg-disabled', 'border-focus'],
        fromColor: [
            'color', 'color-hover', 'color-active', 'color-border', 'color-border-hover', 'color-border-active',
            'color-bg', 'color-bg-hover', 'color-bg-active', 'color-text', 'color-text-hover', 'color-text-active',
            'color-text-bg-hover', 'color-text-bg-active', 'color-solid', 'color-solid-hover', 'color-solid-active', 'color-solid-text',
        ],
    },
    // The kind of value each token holds: `length` is a number in px, `ratio` a unitless number, `color` a CSS colour string.
    tokenKinds: {
        fontSize: 'length', lineHeight: 'ratio', paddingX: 'length', paddingY: 'length', gap: 'length', radius: 'length', iconSize: 'length',
        bg: 'color', fg: 'color', border: 'color', 'bg-hover': 'color', 'fg-hover': 'color', 'border-hover': 'color', 'bg-active': 'color', 'fg-active': 'color', 'border-active': 'color',
        'bg-disabled': 'color', 'fg-disabled': 'color', 'border-focus': 'color',
        color: 'color', 'color-hover': 'color', 'color-active': 'color', 'color-border': 'color', 'color-border-hover': 'color', 'color-border-active': 'color',
        'color-bg': 'color', 'color-bg-hover': 'color', 'color-bg-active': 'color', 'color-text': 'color', 'color-text-hover': 'color', 'color-text-active': 'color',
        'color-text-bg-hover': 'color', 'color-text-bg-active': 'color', 'color-solid': 'color', 'color-solid-hover': 'color', 'color-solid-active': 'color', 'color-solid-text': 'color',
    },
    // Persistent: stored on the instance and drawn on the canvas. `tokens` says which base token the state replaces.
    persistentStates: {
        disabled: { prop: 'disabled', tokens: { bg: 'bg-disabled', fg: 'fg-disabled' } },
    },
    // Preview only: studio-side, colours only. Never written to the document.
    previewStates: {
        hover: { bg: 'bg-hover', fg: 'fg-hover', border: 'border-hover' },
        active: { bg: 'bg-active', fg: 'fg-active', border: 'border-active' },
        focus: { border: 'border-focus' },
    },
    // The CSS pseudo-class each state is written as.
    statePseudo: { disabled: ':disabled', hover: ':hover', active: ':active', focus: ':focus' },
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
