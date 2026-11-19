import { DEFAULT_SIZE_MODE, SIZE_MODES, roleLadder } from './size-modes.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Statistic (antd Statistic): a title above a value, with an optional prefix and suffix icon beside the value. The title is a managed text, made while it is not
// empty, in the secondary colour. The value is always drawn, in a heading style. Size is the one variable dimension: it picks the text styles, the gap and the icon
// size (antd's Statistic has one fixed size; Midas uses the five Size modes, as Empty does). Ant Design structure only.

/** @type {TemplateSchema} */
export const STATISTIC = {
    id: 'antd-statistic',
    name: 'Statistic',
    primarySlot: 'value',
    sampleProps: { title: 'Statistic', value: '112' },
    // A non-interactive block: no disabled state, so no disabled attribute, rule or guard.
    element: { tag: 'div', attrs: {}, blockClickProps: [] },
    anatomy: [
        { id: 'title', kind: 'text', optional: true, managed: true, typography: 'title', shownWhen: { prop: 'title', empty: false } },
        // The value row: the prefix, the value and the suffix sit on one line.
        { id: 'valueBox', kind: 'frame', layout: 'horizontal', primaryAlign: 'start', counterAlign: 'center' },
        { id: 'prefix', kind: 'icon', parent: 'valueBox', optional: true, managed: true },
        { id: 'value', kind: 'text', parent: 'valueBox', typography: 'value' },
        { id: 'suffix', kind: 'icon', parent: 'valueBox', optional: true, managed: true },
    ],
    icons: [
        { show: 'hasPrefix', slot: 'prefix', component: 'prefix', tokens: { colour: 'fg', disabledColour: 'fg', size: 'iconSize' } },
        { show: 'hasSuffix', slot: 'suffix', component: 'suffix', tokens: { colour: 'fg', disabledColour: 'fg', size: 'iconSize' } },
    ],
    rootLayout: 'vertical',
    rootAlign: 'start',
    rootPrimaryAlign: 'start',
    props: {
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        title: { source: 'literal', type: 'string', default: 'Statistic', node: { key: 'title', field: 'text' } },
        value: { source: 'literal', type: 'string', default: '112', node: { key: 'value', field: 'text' } },
        hasPrefix: { source: 'literal', type: 'boolean', default: false },
        prefix: { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'hasPrefix', is: true }, remembered: true },
        hasSuffix: { source: 'literal', type: 'boolean', default: false },
        suffix: { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'hasSuffix', is: true }, remembered: true },
    },
    tokens: {
        fromSize: ['iconSize', 'gap', 'titleTypography', 'valueTypography', 'fg', 'fg-secondary'],
    },
    tokenKinds: {
        'fg-secondary': 'color', fg: 'color', gap: 'length', iconSize: 'length', titleTypography: 'typography', valueTypography: 'typography',
    },
    tokenRoles: {
        'fg-secondary': 'fg-secondary',
        fg: 'fg',
        gap: roleLadder(['gap-xs', 'gap-sm', 'gap', 'gap-lg', 'gap-xl']),
        iconSize: roleLadder(['icon-xs', 'icon-sm', 'icon-md', 'icon-lg', 'icon-xl']),
        titleTypography: roleLadder(['text-xs', 'text-sm', 'text-base', 'text-base', 'text-lg']),
        valueTypography: roleLadder(['heading-5', 'heading-4', 'heading-3', 'heading-2', 'heading-1']),
    },
    persistentStates: {},
    previewStates: {},
    statePseudo: {},
    parts: [],
    playOnly: [],
    display: {
        root: { gap: 'gap' },
        valueBox: { gap: 'gap' },
        title: { fill: 'fg-secondary', typography: 'titleTypography' },
        value: { fill: 'fg', typography: 'valueTypography' },
        prefix: { size: 'iconSize' },
        suffix: { size: 'iconSize' },
    },
    events: [],
};
