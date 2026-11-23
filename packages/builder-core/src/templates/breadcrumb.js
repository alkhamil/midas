import { DEFAULT_SIZE_MODE, SIZE_MODES, roleLadder } from './size-modes.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Breadcrumb (antd Breadcrumb): a row of Link instances. The items box holds the Links only; a new Breadcrumb starts with two, and the Plus row adds one
// more. A separator goes before every item but the first: a plain text layer ("/") or, with Separator = Icon, an instance of the icon the Separator icon
// prop picks. Truncated keeps the first and the last item on the canvas and hides the ones between them behind an ellipsis, whose dropdown Play opens
// (see box-between.js). Size is the one variable dimension: it sets the text style and the gap. Ant Design structure only.

/** @type {TemplateSchema} */
export const BREADCRUMB = {
    id: 'antd-breadcrumb',
    name: 'Breadcrumb',
    // The text layers are the box's own (separator, ellipsis), not a label a prop writes: the primary text names one of them.
    primarySlot: 'separator',
    element: { tag: 'nav', attrs: { 'aria-label': 'Breadcrumb' }, blockClickProps: [] },
    anatomy: [
        { id: 'itemsBox', kind: 'frame', layout: 'horizontal', primaryAlign: 'start', counterAlign: 'center' },
        // The layers the box makes between its items (the separators and the ellipsis): made by the studio's sync, never a stub on the instance.
        { id: 'separator', kind: 'text', optional: true, managed: true, parent: 'itemsBox', typography: 'text', shownWhen: { prop: 'separatorKind', is: 'text' } },
        { id: 'ellipsis', kind: 'text', optional: true, managed: true, parent: 'itemsBox', typography: 'text', shownWhen: { prop: 'truncated', is: true } },
    ],
    icons: [],
    rootLayout: 'horizontal',
    rootAlign: 'center',
    rootPrimaryAlign: 'start',
    props: {
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        truncated: { source: 'literal', type: 'boolean', default: false },
        separatorKind: { source: 'literal', type: 'enum', options: ['text', 'icon'], labels: { text: 'Text', icon: 'Icon' }, control: 'segmented', default: 'text' },
        separatorIcon: { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'separatorKind', is: 'icon' }, remembered: true },
    },
    slots: [
        {
            id: 'items', name: 'Item', description: 'The Link items of the row', holds: 'instance', accepts: ['antd-link'], onlyAccepts: true, min: 0, showEmpty: true,
            layout: 'horizontal', box: 'itemsBox', seed: [{ template: 'antd-link', props: { label: 'Item' } }], start: 2,
            // The separator the box puts before each item but the first; the ellipsis stands between the first and the first hidden item while truncated.
            between: { kind: 'separatorKind', icon: 'separatorIcon', layer: 'separator', text: '/' },
            overflow: { prop: 'truncated', layer: 'ellipsis', text: '…' },
        },
    ],
    tokens: {
        fromSize: ['gap', 'textTypography', 'fg-secondary'],
    },
    tokenKinds: { gap: 'length', textTypography: 'typography', 'fg-secondary': 'color' },
    tokenRoles: {
        gap: roleLadder(['gap-xs', 'gap-sm', 'gap', 'gap-lg', 'gap-xl']),
        textTypography: roleLadder(['text-xs', 'text-sm', 'text-base', 'text-base', 'text-lg']),
        'fg-secondary': 'fg-secondary',
    },
    persistentStates: {},
    previewStates: {},
    statePseudo: {},
    parts: [],
    playOnly: [],
    display: {
        itemsBox: { gap: 'gap' },
        separator: { fill: 'fg-secondary', typography: 'textTypography' },
        ellipsis: { fill: 'fg-secondary', typography: 'textTypography' },
    },
    events: [],
};
