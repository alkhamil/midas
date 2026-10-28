/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

/** @type {TemplateSchema} */
export const BUTTON = {
    id: 'button',
    name: 'Button',
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
        fromVariant: ['bg', 'fg', 'border', 'bg-hover', 'bg-active', 'bg-disabled'],
    },
    states: ['default', 'hover', 'active', 'focus', 'disabled', 'loading'],
    stateTokens: {
        hover: { bg: 'bg-hover' },
        active: { bg: 'bg-active' },
        disabled: { bg: 'bg-disabled' },
    },
    events: [
        { name: 'onClick', exposeAsTrigger: true },
        { name: 'onHover', exposeAsTrigger: true },
        { name: 'onFocus', exposeAsTrigger: false },
        { name: 'onBlur', exposeAsTrigger: false },
    ],
};
