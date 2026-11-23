import { DEFAULT_SIZE_MODE, SIZE_MODES, roleLadder } from './size-modes.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Pagination (antd Pagination, the compact row): a previous and a next chevron around the current page, with the total beside it while Show Total is on.
// The page list of antd (one button per page) needs a count of items the template does not have yet, so the row shows the page as text. The chevrons are
// icons on every instance (always visible). Size is the one variable dimension: it sets the icon size, the gap and the text style. Ant Design structure only.

/** @type {TemplateSchema} */
export const PAGINATION = {
    id: 'antd-pagination',
    name: 'Pagination',
    primarySlot: 'page',
    sampleProps: { page: '1', total: 'of 10' },
    // A row of controls with no disabled state of its own: no disabled attribute, rule or guard.
    element: { tag: 'div', attrs: {}, blockClickProps: [] },
    anatomy: [
        { id: 'prev', kind: 'icon', managed: true, alwaysVisible: true },
        { id: 'page', kind: 'text', typography: 'text' },
        { id: 'total', kind: 'text', optional: true, managed: true, typography: 'text', shownWhen: { all: [{ prop: 'showTotal', is: true }, { prop: 'total', empty: false }] } },
        { id: 'next', kind: 'icon', managed: true, alwaysVisible: true },
    ],
    icons: [
        { slot: 'prev', component: 'prevIcon', label: 'Previous icon', role: 'chevronLeft', tokens: { colour: 'fg', disabledColour: 'fg-disabled', size: 'iconSize' } },
        { slot: 'next', component: 'nextIcon', label: 'Next icon', role: 'chevronRight', tokens: { colour: 'fg', disabledColour: 'fg-disabled', size: 'iconSize' } },
    ],
    rootLayout: 'horizontal',
    rootAlign: 'center',
    rootPrimaryAlign: 'start',
    props: {
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        page: { source: 'literal', type: 'string', default: '1', node: { key: 'page', field: 'text' } },
        // The chevrons: an icon each, the role glyph until the designer picks another (Icon Button's icon is the same kind of prop).
        prevIcon: { source: 'literal', type: 'iconComponent', default: null },
        nextIcon: { source: 'literal', type: 'iconComponent', default: null },
        showTotal: { source: 'literal', type: 'boolean', default: true },
        total: { source: 'literal', type: 'string', default: 'of 10', node: { key: 'total', field: 'text' }, visibleIf: { prop: 'showTotal', is: true }, remembered: true },
    },
    tokens: {
        fromSize: ['iconSize', 'gap', 'textTypography', 'fg', 'fg-secondary', 'fg-disabled'],
    },
    tokenKinds: { iconSize: 'length', gap: 'length', textTypography: 'typography', fg: 'color', 'fg-secondary': 'color', 'fg-disabled': 'color' },
    tokenRoles: {
        iconSize: roleLadder(['icon-xs', 'icon-sm', 'icon-md', 'icon-lg', 'icon-xl']),
        gap: roleLadder(['gap-xs', 'gap-sm', 'gap', 'gap-lg', 'gap-xl']),
        textTypography: roleLadder(['text-xs', 'text-sm', 'text-base', 'text-base', 'text-lg']),
        fg: 'fg',
        'fg-secondary': 'fg-secondary',
        'fg-disabled': 'fg-disabled',
    },
    persistentStates: {},
    previewStates: {},
    statePseudo: {},
    parts: [],
    playOnly: [],
    display: {
        root: { gap: 'gap' },
        page: { fill: 'fg', typography: 'textTypography' },
        total: { fill: 'fg-secondary', typography: 'textTypography' },
        prev: { size: 'iconSize' },
        next: { size: 'iconSize' },
    },
    events: [],
};
