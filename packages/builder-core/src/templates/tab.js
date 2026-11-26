import { DEFAULT_SIZE_MODE, SIZE_MODES, roleLadder, spaceLadder } from './size-modes.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Tab (antd Tabs item): one tab in a Tabs' row, a label over an indicator. Variant picks the look: underline (a bar under the label, brand when the tab
// is active) or pill (the active tab takes a brand background). Active is exclusive in its box: a click in Play, or turning it on in the Behavior tab,
// turns it off on the other tabs (the toggle's `exclusive`). Size is the one variable dimension besides Variant. Ant Design structure only.

/** @type {TemplateSchema} */
export const TAB = {
    id: 'antd-tab',
    name: 'Tab',
    primarySlot: 'label',
    sampleProps: { label: 'Tab' },
    // A tab is a button-like element in a tablist (role tab); its selected state is aria-selected (the toggle's `aria`).
    element: { tag: 'div', attrs: { role: 'tab' }, disabledState: 'disabled', blockClickProps: [] },
    anatomy: [
        { id: 'label', kind: 'text', optional: true, managed: true, typography: 'text', shownWhen: { prop: 'label', empty: false } },
        // The indicator is a bar of the tab's full width: the underline, or nothing in pill (its height is 0 there).
        { id: 'indicator', kind: 'frame', layout: 'horizontal', primaryAlign: 'start', counterAlign: 'center', fill: true },
    ],
    icons: [],
    rootLayout: 'vertical',
    rootAlign: 'center',
    rootPrimaryAlign: 'center',
    props: {
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        variant: { source: 'variable', collection: 'Variant', modes: ['underline', 'pill'], defaultMode: 'underline' },
        label: { source: 'literal', type: 'string', default: 'Tab', node: { key: 'label', field: 'text' } },
        active: { source: 'literal', type: 'boolean', default: false },
        disabled: { source: 'literal', type: 'boolean', default: false },
    },
    tokens: {
        fromSize: ['textTypography', 'paddingX', 'paddingY', 'gap'],
        fromVariant: ['bg', 'bg-hover', 'bg-active', 'indicatorHeight', 'fg', 'fg-hover', 'fg-active', 'fg-disabled', 'indicator', 'indicator-active'],
    },
    tokenKinds: {
        textTypography: 'typography', paddingX: 'length', paddingY: 'length', gap: 'length', indicatorHeight: 'length',
        bg: 'color', 'bg-hover': 'color', 'bg-active': 'color', fg: 'color', 'fg-hover': 'color', 'fg-active': 'color', 'fg-disabled': 'color', indicator: 'color', 'indicator-active': 'color',
    },
    tokenRoles: {
        textTypography: roleLadder(['text-xs', 'text-sm', 'text-base', 'text-base', 'text-lg']),
        paddingX: spaceLadder([8, 12, 16, 16, 24]),
        paddingY: spaceLadder([8, 8, 12, 12, 16]),
        gap: roleLadder(['gap-xs', 'gap-sm', 'gap', 'gap-lg', 'gap-xl']),
        indicatorHeight: { underline: 'outline-width', pill: 'border-width-none', default: 'outline-width' },
        bg: { underline: 'transparent', pill: 'transparent', default: 'transparent' },
        'bg-hover': { underline: 'transparent', pill: 'bg-subtle', default: 'transparent' },
        'bg-active': { underline: 'transparent', pill: 'brand-bg', default: 'transparent' },
        fg: 'fg-secondary',
        'fg-hover': 'fg',
        'fg-active': 'brand',
        'fg-disabled': 'fg-disabled',
        indicator: 'transparent',
        'indicator-active': 'brand',
    },
    // Active takes the brand text, and the brand indicator (underline) or pill background; disabled is declared last, so it wins over active.
    persistentStates: {
        active: { prop: 'active', tokens: { fg: 'fg-active', indicator: 'indicator-active', bg: 'bg-active' } },
        disabled: { prop: 'disabled', tokens: { fg: 'fg-disabled' } },
    },
    previewStates: {
        hover: { fg: 'fg-hover', bg: 'bg-hover' },
    },
    statePseudo: { active: '[data-active]', disabled: ':disabled', hover: ':hover' },
    // One of the tabs is the selected one: a click selects this tab and deselects the others in its box (Play), the way the Behavior tab's toggle does.
    toggle: { prop: 'active', once: true, exclusive: true, aria: 'selected' },
    cursor: [{ value: 'pointer' }],
    parts: [],
    playOnly: [
        { id: 'hover', reason: 'pointer state; the canvas shows the rest state and the Preview panel shows hover' },
    ],
    display: {
        root: { fill: 'bg', paddingX: 'paddingX', paddingY: 'paddingY', gap: 'gap' },
        label: { fill: 'fg', typography: 'textTypography' },
        indicator: { fill: 'indicator', height: 'indicatorHeight' },
    },
    events: [],
};
