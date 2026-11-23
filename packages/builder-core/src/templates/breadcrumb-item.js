import { DEFAULT_SIZE_MODE, SIZE_MODES, roleLadder, spaceLadder } from './size-modes.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Breadcrumb Item (antd Breadcrumb item): one text in a Breadcrumb's row. Its colour is per item: Default (secondary text), Hover (the text colour, a preview
// state), Active (the current item, the text colour) and Disabled (the disabled text). Plain text, not a link: the item's label is the text the Breadcrumb's
// Slots row edits. Size is the one variable dimension: it sets the text style, as the Breadcrumb's row does. Ant Design structure only.

/** @type {TemplateSchema} */
export const BREADCRUMB_ITEM = {
    id: 'antd-breadcrumb-item',
    name: 'Breadcrumb Item',
    primarySlot: 'label',
    sampleProps: { label: 'Item' },
    element: { tag: 'span', attrs: {}, disabledState: 'disabled', blockClickProps: [] },
    anatomy: [
        { id: 'label', kind: 'text', optional: true, managed: true, typography: 'text', shownWhen: { prop: 'label', empty: false } },
    ],
    icons: [],
    rootLayout: 'horizontal',
    rootAlign: 'center',
    rootPrimaryAlign: 'start',
    props: {
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        label: { source: 'literal', type: 'string', default: 'Item', node: { key: 'label', field: 'text' } },
        active: { source: 'literal', type: 'boolean', default: false },
        disabled: { source: 'literal', type: 'boolean', default: false },
    },
    tokens: {
        fromSize: ['textTypography', 'fg', 'fg-hover', 'fg-active', 'fg-disabled', 'bg', 'bg-hover', 'paddingX', 'radius'],
    },
    tokenKinds: { textTypography: 'typography', fg: 'color', 'fg-hover': 'color', 'fg-active': 'color', 'fg-disabled': 'color', bg: 'color', 'bg-hover': 'color', paddingX: 'length', radius: 'length' },
    tokenRoles: {
        textTypography: roleLadder(['text-xs', 'text-sm', 'text-base', 'text-base', 'text-lg']),
        fg: 'fg-secondary',
        'fg-hover': 'fg',
        'fg-active': 'fg',
        'fg-disabled': 'fg-disabled',
        // antd's item hover is a background behind the text, with 4px at each side and a small radius; at rest the item has none.
        bg: 'transparent',
        'bg-hover': 'bg-subtle',
        paddingX: spaceLadder([4, 4, 4, 4, 4]),
        radius: 'radius-sm',
    },
    // The current item (active) and a disabled one take the text colour of their state; disabled is declared last, so it wins over active.
    persistentStates: {
        active: { prop: 'active', tokens: { fg: 'fg-active' } },
        disabled: { prop: 'disabled', tokens: { fg: 'fg-disabled' } },
    },
    previewStates: {
        hover: { fg: 'fg-hover', bg: 'bg-hover' },
    },
    statePseudo: { active: '[data-active]', disabled: ':disabled', hover: ':hover' },
    parts: [],
    playOnly: [
        { id: 'hover', reason: 'pointer state; the canvas shows the rest state and the Preview panel shows hover' },
    ],
    display: {
        root: { fill: 'bg', paddingX: 'paddingX', radius: 'radius' },
        label: { fill: 'fg', typography: 'textTypography' },
    },
    events: [],
};
