/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

/** @type {TemplateSchema} */
export const BUTTON = {
    id: 'button',
    name: 'Button',
    // Variables of this component are named `button/<token>` in each collection.
    group: 'button',
    anatomy: [
        { id: 'iconStart', kind: 'icon', optional: true, managed: true },
        { id: 'label', kind: 'text' },
        { id: 'iconEnd', kind: 'icon', optional: true, managed: true },
    ],
    props: {
        variant: { source: 'variable', collection: 'Variant' },
        size: { source: 'variable', collection: 'Size' },
        label: { source: 'literal', type: 'string', default: 'Button' },
        hasIcon: { source: 'literal', type: 'boolean', default: false },
        iconPlacement: { source: 'literal', type: 'enum', options: ['start', 'end'], default: 'start', visibleIf: { prop: 'hasIcon', is: true } },
        icon: { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'hasIcon', is: true } },
        loading: { source: 'literal', type: 'boolean', default: false },
        disabled: { source: 'literal', type: 'boolean', default: false },
        fullWidth: { source: 'literal', type: 'boolean', default: false },
    },
    tokens: {
        fromSize: ['fontSize', 'lineHeight', 'paddingX', 'paddingY', 'gap', 'radius', 'iconSize'],
        fromVariant: ['bg', 'fg', 'border', 'bg-hover', 'bg-active', 'bg-disabled', 'fg-disabled', 'border-focus'],
    },
    // Persistent: stored on the instance and drawn on the canvas. `tokens` says which base token the state replaces.
    persistentStates: {
        disabled: { prop: 'disabled', tokens: { bg: 'bg-disabled', fg: 'fg-disabled' } },
    },
    // Preview only: studio-side, colours only. Never written to the document.
    previewStates: {
        hover: { bg: 'bg-hover' },
        active: { bg: 'bg-active' },
        focus: { border: 'border-focus' },
    },
    // Which token or literal prop drives which property of which node (root, or an anatomy slot).
    display: {
        root: { fill: 'bg', stroke: 'border', radius: 'radius', paddingX: 'paddingX', paddingY: 'paddingY', gap: 'gap', width: 'fullWidth' },
        label: { fill: 'fg', fontSize: 'fontSize', lineHeight: 'lineHeight', text: 'label' },
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
