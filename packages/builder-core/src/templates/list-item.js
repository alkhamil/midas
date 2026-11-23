import { DEFAULT_SIZE_MODE, SIZE_MODES, roleLadder, spaceLadder } from './size-modes.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// List Item (antd List.Item, without its actions and meta): one row with an optional leading icon, a content column (a title, and a description
// while it is not empty) and an optional trailing icon. Size is the one variable dimension (xs to xl, as every component with a Size): it sets the
// padding, the gap, the icon size and the two text styles. Selected is a persistent state (a data attribute and a fill); hover is the one preview
// state, since every item can be clicked. Disabled dims the text and blocks hover. Ant Design structure only.

/** @type {TemplateSchema} */
export const LIST_ITEM = {
    id: 'antd-list-item',
    name: 'List Item',
    primarySlot: 'title',
    sampleProps: { title: 'List item' },
    element: { tag: 'div', attrs: {}, disabledState: 'disabled', blockClickProps: [] },
    anatomy: [
        { id: 'leading', kind: 'icon', optional: true, managed: true },
        // The content column: the title, and the description under it while the description is not empty.
        { id: 'content', kind: 'frame', layout: 'vertical', primaryAlign: 'center', counterAlign: 'start', fill: true },
        { id: 'title', kind: 'text', parent: 'content', typography: 'title' },
        { id: 'description', kind: 'text', parent: 'content', optional: true, managed: true, typography: 'description', shownWhen: { prop: 'description', empty: false } },
        { id: 'trailing', kind: 'icon', optional: true, managed: true },
    ],
    icons: [
        { show: 'hasLeading', slot: 'leading', component: 'leading', label: 'Leading icon', tokens: { colour: 'fg-secondary', disabledColour: 'fg-disabled', size: 'iconSize' } },
        { show: 'hasTrailing', slot: 'trailing', component: 'trailing', label: 'Trailing icon', tokens: { colour: 'fg-secondary', disabledColour: 'fg-disabled', size: 'iconSize' } },
    ],
    rootLayout: 'horizontal',
    rootAlign: 'center',
    rootPrimaryAlign: 'start',
    props: {
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        title: { source: 'literal', type: 'string', default: 'List item', node: { key: 'title', field: 'text' } },
        description: { source: 'literal', type: 'string', default: '', node: { key: 'description', field: 'text' } },
        hasLeading: { source: 'literal', type: 'boolean', default: false },
        leading: { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'hasLeading', is: true }, remembered: true },
        hasTrailing: { source: 'literal', type: 'boolean', default: false },
        trailing: { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'hasTrailing', is: true }, remembered: true },
        selected: { source: 'literal', type: 'boolean', default: false },
        disabled: { source: 'literal', type: 'boolean', default: false },
    },
    tokens: {
        fromSize: ['paddingX', 'paddingY', 'gap', 'iconSize', 'titleTypography', 'descriptionTypography', 'bg', 'bg-hover', 'bg-selected', 'fg', 'fg-secondary', 'fg-disabled'],
    },
    tokenKinds: {
        paddingX: 'length', paddingY: 'length', gap: 'length', iconSize: 'length',
        titleTypography: 'typography', descriptionTypography: 'typography',
        bg: 'color', 'bg-hover': 'color', 'bg-selected': 'color', fg: 'color', 'fg-secondary': 'color', 'fg-disabled': 'color',
    },
    tokenRoles: {
        paddingX: spaceLadder([16, 16, 24, 24, 24]),
        paddingY: spaceLadder([8, 8, 12, 16, 16]),
        gap: roleLadder(['gap-xs', 'gap-sm', 'gap', 'gap-lg', 'gap-xl']),
        iconSize: roleLadder(['icon-xs', 'icon-sm', 'icon-md', 'icon-lg', 'icon-xl']),
        titleTypography: roleLadder(['text-xs', 'text-sm', 'text-base', 'text-base', 'text-lg']),
        descriptionTypography: roleLadder(['text-xs', 'text-xs', 'text-sm', 'text-sm', 'text-base']),
        bg: 'bg',
        'bg-hover': 'bg-subtle',
        'bg-selected': 'preset-primary-subtle',
        fg: 'fg',
        'fg-secondary': 'fg-secondary',
        'fg-disabled': 'fg-disabled',
    },
    persistentStates: {
        selected: { prop: 'selected', tokens: { bg: 'bg-selected' } },
        disabled: { prop: 'disabled', tokens: { fg: 'fg-disabled', 'fg-secondary': 'fg-disabled' } },
    },
    // Hover is the one interaction state: a list item is clickable, so the fill of the row changes; disabled blocks it (the engine's guard).
    previewStates: {
        hover: { bg: 'bg-hover' },
    },
    statePseudo: { selected: '[data-selected]', disabled: ':disabled', hover: ':hover' },
    motion: { transitions: [{ key: 'root', props: ['background-color'], duration: '0.2s', timing: 'ease' }] },
    parts: [],
    playOnly: [],
    display: {
        root: { fill: 'bg', paddingX: 'paddingX', paddingY: 'paddingY', gap: 'gap' },
        content: { gap: 'gap' },
        title: { fill: 'fg', typography: 'titleTypography' },
        description: { fill: 'fg-secondary', typography: 'descriptionTypography' },
        leading: { size: 'iconSize' },
        trailing: { size: 'iconSize' },
    },
    events: [],
};
