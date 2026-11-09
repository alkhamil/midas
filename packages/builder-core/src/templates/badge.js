import { DEFAULT_SIZE_MODE, SIZE_MODES } from './size-modes.js';
import { COLOR_PRESETS, presetRoleMap } from './color-presets.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Badge (antd Badge: a count, a dot, a status). The root holds one of three forms, chosen by `type`: a count pill (a managed frame with the count text, which
// reads `<overflowCount>+` above the limit), a dot (a managed circle), or a status row (a status dot and an optional label). The root is a plain wrapper that
// hugs its form. It hides in Play and the export while a count of zero is not shown (showZero off): a hiding state, so the canvas keeps the node.
// Colours are the Color presets (the count and the dot), the Status modes (the status dot); every size is a token. Ant Design structure only.

/** The status modes, each reading a preset's solid colour (antd: success, processing, default, error, warning). */
const STATUS_MODES = ['success', 'processing', 'default', 'error', 'warning'];

/** @type {TemplateSchema} */
export const BADGE = {
    id: 'antd-badge',
    name: 'Badge',
    primarySlot: 'countText',
    sampleProps: { count: 5 },
    // A non-interactive element: no disabled state, so no disabled attribute, rule or guard.
    element: { tag: 'span', attrs: {}, blockClickProps: [] },
    anatomy: [
        { id: 'pill', kind: 'frame', layout: 'horizontal', primaryAlign: 'center', counterAlign: 'center', managed: true, shownWhen: { prop: 'type', is: 'count' } },
        { id: 'countText', kind: 'text', parent: 'pill', optional: true, managed: true, typography: 'count', shownWhen: { prop: 'type', is: 'count' }, text: { overflow: { value: 'count', limit: 'overflowCount' } } },
        { id: 'dot', kind: 'frame', layout: 'horizontal', managed: true, shownWhen: { prop: 'type', is: 'dot' } },
        { id: 'statusDot', kind: 'frame', layout: 'horizontal', managed: true, shownWhen: { prop: 'type', is: 'status' } },
        { id: 'label', kind: 'text', optional: true, managed: true, typography: 'label', shownWhen: { all: [{ prop: 'type', is: 'status' }, { prop: 'hasText', is: true }, { prop: 'label', empty: false }] } },
    ],
    icons: [],
    rootLayout: 'horizontal',
    rootAlign: 'center',
    rootPrimaryAlign: 'start',
    props: {
        color: { source: 'variable', collection: 'Color', modes: COLOR_PRESETS, defaultMode: 'danger' },
        status: { source: 'variable', collection: 'Status', modes: STATUS_MODES, defaultMode: 'default' },
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        type: { source: 'literal', type: 'enum', options: ['count', 'dot', 'status'], default: 'count' },
        count: { source: 'literal', type: 'number', default: 0, visibleIf: { prop: 'type', is: 'count' } },
        overflowCount: { source: 'literal', type: 'number', default: 99, visibleIf: { prop: 'type', is: 'count' } },
        showZero: { source: 'literal', type: 'boolean', default: false, visibleIf: { prop: 'type', is: 'count' } },
        hasText: { source: 'literal', type: 'boolean', default: true, visibleIf: { prop: 'type', is: 'status' } },
        label: { source: 'literal', type: 'string', default: 'Status', node: { key: 'label', field: 'text' }, visibleIf: { all: [{ prop: 'type', is: 'status' }, { prop: 'hasText', is: true }] }, remembered: true },
        // A count of zero (a derived boolean, never stored): it holds at zero and below.
        isZero: { source: 'literal', type: 'boolean', default: false, derived: { value: 'count', limit: 0, cmp: 'lte' } },
        // The root hides while the count is zero, the type is a count and showZero is off.
        zeroHidden: { source: 'literal', type: 'boolean', default: false, derived: { when: { all: [{ prop: 'isZero', is: true }, { prop: 'showZero', is: false }, { prop: 'type', is: 'count' }] } } },
    },
    tokens: {
        fromColor: ['badge-bg', 'badge-fg', 'fg'],
        fromStatus: ['status-dot'],
        fromSize: ['badge-height', 'badge-dot', 'badge-padding-x', 'radius-full', 'gap', 'countTypography', 'labelTypography'],
    },
    tokenKinds: {
        'badge-bg': 'color', 'badge-fg': 'color', fg: 'color', 'status-dot': 'color',
        'badge-height': 'length', 'badge-dot': 'length', 'badge-padding-x': 'length', 'radius-full': 'length', gap: 'length',
        countTypography: 'typography', labelTypography: 'typography',
    },
    tokenRoles: {
        'badge-bg': presetRoleMap('solid'), 'badge-fg': 'solid-text', fg: 'fg',
        'status-dot': { success: 'badge-status-success', processing: 'badge-status-processing', default: 'badge-status-default', error: 'badge-status-error', warning: 'badge-status-warning' },
        'badge-height': 'badge-height', 'badge-dot': 'badge-dot', 'badge-padding-x': 'badge-padding-x', 'radius-full': 'radius-full', gap: 'gap-xs',
        countTypography: 'text-xs', labelTypography: 'text-xs',
    },
    // The hiding state: an attribute the stylesheet hides the root by. It replaces no token.
    persistentStates: { zeroHidden: { prop: 'zeroHidden', tokens: {}, hide: true } },
    previewStates: {},
    statePseudo: { zeroHidden: '[data-zero-hidden]' },
    parts: [],
    playOnly: [],
    display: {
        root: { gap: 'gap' },
        pill: { fill: 'badge-bg', radius: 'radius-full', height: 'badge-height', paddingX: 'badge-padding-x' },
        countText: { fill: 'badge-fg', typography: 'countTypography' },
        dot: { fill: 'badge-bg', radius: 'radius-full', size: 'badge-dot' },
        statusDot: { fill: 'status-dot', radius: 'radius-full', size: 'badge-dot' },
        label: { fill: 'fg', typography: 'labelTypography' },
    },
    events: [],
};
