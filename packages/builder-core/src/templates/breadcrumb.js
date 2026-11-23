import { DEFAULT_SIZE_MODE, SIZE_MODES, roleLadder } from './size-modes.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Breadcrumb (antd Breadcrumb): a row of up to three items with a separator before each one after the first. The first item always shows; the second
// and third are managed texts, made while their text is not empty, and each separator is made with the item it precedes (no hidden layer). A list of any
// length needs a count of items the template does not have yet, so the row has three. Size is the one variable dimension: it sets the text style and the gap.
// Ant Design structure only; the items are text (their links and hover are not built yet).

/** @type {TemplateSchema} */
export const BREADCRUMB = {
    id: 'antd-breadcrumb',
    name: 'Breadcrumb',
    primarySlot: 'item1',
    sampleProps: { item1: 'Home', item2: 'Application', item3: '' },
    // A navigation row with no disabled state: no disabled attribute, rule or guard.
    element: { tag: 'nav', attrs: { 'aria-label': 'Breadcrumb' }, blockClickProps: [] },
    anatomy: [
        { id: 'item1', kind: 'text', typography: 'text' },
        { id: 'separator1', kind: 'text', optional: true, managed: true, typography: 'text', defaultText: '/', shownWhen: { prop: 'item2', empty: false } },
        { id: 'item2', kind: 'text', optional: true, managed: true, typography: 'text', shownWhen: { prop: 'item2', empty: false } },
        { id: 'separator2', kind: 'text', optional: true, managed: true, typography: 'text', defaultText: '/', shownWhen: { prop: 'item3', empty: false } },
        { id: 'item3', kind: 'text', optional: true, managed: true, typography: 'text', shownWhen: { prop: 'item3', empty: false } },
    ],
    icons: [],
    rootLayout: 'horizontal',
    rootAlign: 'center',
    rootPrimaryAlign: 'start',
    props: {
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        item1: { source: 'literal', type: 'string', default: 'Home', node: { key: 'item1', field: 'text' } },
        item2: { source: 'literal', type: 'string', default: 'Application', node: { key: 'item2', field: 'text' } },
        item3: { source: 'literal', type: 'string', default: '', node: { key: 'item3', field: 'text' } },
    },
    tokens: {
        fromSize: ['gap', 'textTypography', 'fg', 'fg-secondary'],
    },
    tokenKinds: { gap: 'length', textTypography: 'typography', fg: 'color', 'fg-secondary': 'color' },
    tokenRoles: {
        gap: roleLadder(['gap-xs', 'gap-sm', 'gap', 'gap-lg', 'gap-xl']),
        textTypography: roleLadder(['text-xs', 'text-sm', 'text-base', 'text-base', 'text-lg']),
        fg: 'fg',
        'fg-secondary': 'fg-secondary',
    },
    persistentStates: {},
    previewStates: {},
    statePseudo: {},
    parts: [],
    playOnly: [],
    display: {
        root: { gap: 'gap' },
        item1: { fill: 'fg-secondary', typography: 'textTypography' },
        separator1: { fill: 'fg-secondary', typography: 'textTypography' },
        item2: { fill: 'fg-secondary', typography: 'textTypography' },
        separator2: { fill: 'fg-secondary', typography: 'textTypography' },
        item3: { fill: 'fg', typography: 'textTypography' },
    },
    events: [],
};
