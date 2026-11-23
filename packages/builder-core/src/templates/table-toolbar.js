import { DEFAULT_SIZE_MODE, SIZE_MODES, roleLadder, spaceLadder } from './size-modes.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Table Toolbar (the header row of a table): a title and, while it is on, the count of selected rows, then a search field (a Search Field instance) that
// fills the space, then the actions (Buttons or Icon Buttons). Each part is a layer of the instance only: the title and the selected count are managed texts
// made while their text is not empty; the search and the actions are content slots, shown by Search and Actions, and the search starts with a Search Field.
// Filters (a Select per filter) wait for the Select template. Size is the one variable dimension: text style, gap and padding. Not an antd component.

/** @type {TemplateSchema} */
export const TABLE_TOOLBAR = {
    id: 'table-toolbar',
    name: 'Table Toolbar',
    primarySlot: 'title',
    sampleProps: { title: 'Table title', selectedText: '' },
    // A header row with no disabled state: no disabled attribute, rule or guard.
    element: { tag: 'div', attrs: {}, blockClickProps: [] },
    anatomy: [
        { id: 'title', kind: 'text', optional: true, managed: true, typography: 'title', shownWhen: { prop: 'title', empty: false } },
        { id: 'selectedText', kind: 'text', optional: true, managed: true, typography: 'label', shownWhen: { prop: 'selectedText', empty: false } },
    ],
    icons: [],
    rootLayout: 'horizontal',
    rootAlign: 'center',
    rootPrimaryAlign: 'start',
    props: {
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        title: { source: 'literal', type: 'string', default: 'Table title', node: { key: 'title', field: 'text' } },
        selectedText: { source: 'literal', type: 'string', default: '', node: { key: 'selectedText', field: 'text' } },
        hasSearch: { source: 'literal', type: 'boolean', default: false },
        hasActions: { source: 'literal', type: 'boolean', default: false },
    },
    slots: [
        // The search field: a Search Field instance (the Input family with the search glyph), fills the row.
        { id: 'search', name: 'Search', description: 'A Search Field', holds: 'content', accepts: ['antd-search'], onlyAccepts: true, min: 0, max: 1, showEmpty: true, layout: 'horizontal', fill: true, shownWhen: { prop: 'hasSearch', is: true }, seed: [{ template: 'antd-search', props: {}, follow: { size: 'size' } }] },
        // The actions: Buttons or Icon Buttons, at the end of the row.
        { id: 'actions', name: 'Actions', description: 'Buttons or Icon Buttons at the end of the row', holds: 'content', accepts: ['button', 'icon-button'], onlyAccepts: true, min: 0, showEmpty: true, layout: 'horizontal', shownWhen: { prop: 'hasActions', is: true }, seed: [{ template: 'button', props: { label: 'Export' }, follow: { size: 'size' } }] },
    ],
    tokens: {
        fromSize: ['gap', 'padding', 'titleTypography', 'labelTypography', 'fg', 'fg-secondary'],
    },
    tokenKinds: { gap: 'length', padding: 'length', titleTypography: 'typography', labelTypography: 'typography', fg: 'color', 'fg-secondary': 'color' },
    tokenRoles: {
        gap: roleLadder(['gap-xs', 'gap-sm', 'gap', 'gap-lg', 'gap-xl']),
        padding: spaceLadder([8, 12, 16, 16, 24]),
        titleTypography: roleLadder(['text-sm-strong', 'text-base-strong', 'text-lg-strong', 'text-xl-strong', 'text-xl-strong']),
        labelTypography: roleLadder(['text-xs', 'text-sm', 'text-base', 'text-base', 'text-lg']),
        fg: 'fg',
        'fg-secondary': 'fg-secondary',
    },
    persistentStates: {},
    previewStates: {},
    statePseudo: {},
    parts: [],
    playOnly: [],
    display: {
        root: { gap: 'gap', paddingX: 'padding', paddingY: 'padding' },
        title: { fill: 'fg', typography: 'titleTypography' },
        selectedText: { fill: 'fg-secondary', typography: 'labelTypography' },
    },
    events: [],
};
