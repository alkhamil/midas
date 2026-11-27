import { DEFAULT_SIZE_MODE, SIZE_MODES, roleLadder, spaceLadder } from './size-modes.js';
import { ICON_DEFS, ICON_DISPLAY, ICON_END, ICON_PROPS, ICON_START } from './icon-slots.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Tab (antd Tabs item): one tab in a Tabs' row, a label over an indicator. An optional icon sits before or after the label, in the same row. Variant is underline only (a bar under the label, brand when the tab is
// active). Active is exclusive in its box: a click in Play, or turning it on in the Behavior tab,
// turns it off on the other tabs (the toggle's `exclusive`). Size is the one variable dimension besides Variant. Ant Design structure only.

/** The close is quiet and darkens on hover (Play and the export only). */
const CLOSE_TOKENS = { colour: 'fg', disabledColour: 'fg', size: 'iconSize', hoverColour: 'fg-hover' };

/** @type {TemplateSchema} */
export const TAB = {
    id: 'antd-tab',
    name: 'Tab',
    primarySlot: 'label',
    sampleProps: { label: 'Tab' },
    // A tab is a button-like element in a tablist (role tab); its selected state is aria-selected (the toggle's `aria`).
    element: { tag: 'div', attrs: { role: 'tab' }, disabledState: 'disabled', blockClickProps: [] },
    anatomy: [
        // The icon and the label share one row; the indicator sits under the row.
        { id: 'row', kind: 'frame', layout: 'horizontal', primaryAlign: 'start', counterAlign: 'center' },
        { ...ICON_START, parent: 'row' },
        { id: 'label', kind: 'text', optional: true, managed: true, parent: 'row', typography: 'text', shownWhen: { prop: 'label', empty: false } },
        { ...ICON_END, parent: 'row' },
        // The close is an icon in a box of its own, after the label: the dismiss press takes the tab's box out (Play).
        { id: 'closer', kind: 'frame', parent: 'row', layout: 'horizontal', primaryAlign: 'center', counterAlign: 'center', managed: true, shownWhen: { prop: 'closable', is: true } },
        { id: 'close', kind: 'icon', parent: 'closer', optional: true, managed: true },
        // The indicator is a bar in its own box, which spans the tab: the box's align places the bar (start, centre or end) when it has a width.
        { id: 'indicatorBox', kind: 'frame', layout: 'horizontal', primaryAlign: 'start', counterAlign: 'center', fill: true },
        { id: 'indicator', kind: 'frame', parent: 'indicatorBox', layout: 'horizontal', primaryAlign: 'start', counterAlign: 'center', fill: true },
    ],
    icons: [...ICON_DEFS, { show: 'closable', slot: 'close', component: 'closeIcon', role: 'close', tokens: CLOSE_TOKENS }],
    rootLayout: 'vertical',
    rootAlign: 'center',
    rootPrimaryAlign: 'center',
    props: {
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        variant: { source: 'variable', collection: 'Variant', modes: ['underline'], defaultMode: 'underline' },
        label: { source: 'literal', type: 'string', default: 'Tab', node: { key: 'label', field: 'text' } },
        ...ICON_PROPS,
        closable: { source: 'literal', type: 'boolean', default: false },
        closeIcon: { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'closable', is: true }, remembered: true },
        // The indicator's width (px, used while Fixed is on) and its align: the Tabs sets them and its tabs follow.
        indicatorWidth: { source: 'literal', type: 'number', default: 24, node: { key: 'indicator', field: 'width' } },
        indicatorAlign: { source: 'literal', type: 'enum', options: ['start', 'center', 'end'], default: 'center', node: { key: 'indicatorBox', field: 'primaryAlign', values: { start: 'start', center: 'center', end: 'end' } } },
        // Fixed takes the width; off, the indicator fills the tab (written after the width, so it wins).
        indicatorFixed: { source: 'literal', type: 'boolean', default: false, node: { key: 'indicator', field: 'widthSizing', values: { true: 'fixed', false: 'fill' } } },
        // Tab has no loading state, so the placement shows with the icon only.
        iconPlacement: { ...ICON_PROPS.iconPlacement, visibleIf: { prop: 'hasIcon', is: true } },
        active: { source: 'literal', type: 'boolean', default: false },
        disabled: { source: 'literal', type: 'boolean', default: false },
    },
    tokens: {
        fromSize: ['textTypography', 'paddingX', 'paddingY', 'gap', 'iconSize'],
        fromVariant: ['bg', 'bg-hover', 'bg-active', 'indicatorHeight', 'fg', 'fg-hover', 'fg-active', 'fg-disabled', 'indicator', 'indicator-active'],
    },
    tokenKinds: {
        textTypography: 'typography', paddingX: 'length', paddingY: 'length', gap: 'length', iconSize: 'length', indicatorHeight: 'length',
        bg: 'color', 'bg-hover': 'color', 'bg-active': 'color', fg: 'color', 'fg-hover': 'color', 'fg-active': 'color', 'fg-disabled': 'color', indicator: 'color', 'indicator-active': 'color',
    },
    tokenRoles: {
        textTypography: roleLadder(['text-xs', 'text-sm', 'text-base', 'text-base', 'text-lg']),
        paddingX: spaceLadder([8, 12, 16, 16, 24]),
        paddingY: spaceLadder([8, 8, 12, 12, 16]),
        gap: roleLadder(['gap-xs', 'gap-sm', 'gap', 'gap-lg', 'gap-xl']),
        iconSize: roleLadder(['icon-xs', 'icon-sm', 'icon-md', 'icon-lg', 'icon-xl']),
        indicatorHeight: 'outline-width',
        bg: 'transparent',
        'bg-hover': 'transparent',
        'bg-active': 'transparent',
        fg: 'fg-secondary',
        'fg-hover': 'fg',
        'fg-active': 'brand',
        'fg-disabled': 'fg-disabled',
        indicator: 'transparent',
        'indicator-active': 'brand',
    },
    // Active takes the brand text and the brand indicator; disabled is declared last, so it wins over active.
    persistentStates: {
        active: { prop: 'active', tokens: { fg: 'fg-active', indicator: 'indicator-active', bg: 'bg-active' } },
        disabled: { prop: 'disabled', tokens: { fg: 'fg-disabled' } },
    },
    previewStates: {
        hover: { fg: 'fg-hover', bg: 'bg-hover' },
    },
    statePseudo: { active: '[data-active]', disabled: ':disabled', hover: ':hover' },
    // One of the tabs is the selected one: a click selects this tab and deselects the others in its box (Play), the way the Behavior tab's toggle does.
    // Closing takes the tab out of the bar (Play); the canvas keeps it.
    press: [{ slot: 'closer', dismiss: true }],
    toggle: { prop: 'active', once: true, exclusive: true, aria: 'selected', slide: 'indicator' },
    cursor: [{ value: 'pointer' }],
    parts: [],
    playOnly: [
        { id: 'hover', reason: 'pointer state; the canvas shows the rest state and the Preview panel shows hover' },
    ],
    display: {
        // antd's line tab: the label has the vertical padding, and the bar sits flush under it at the tab's bottom edge (on the baseline).
        root: { fill: 'bg', paddingX: 'paddingX' },
        row: { gap: 'gap', paddingY: 'paddingY' },
        label: { fill: 'fg', typography: 'textTypography' },
        ...ICON_DISPLAY,
        indicator: { fill: 'indicator', height: 'indicatorHeight' },
        close: { size: 'iconSize' },
    },
    events: [],
};
