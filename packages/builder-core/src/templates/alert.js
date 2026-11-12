import { presetRole } from './color-presets.js';
import { DEFAULT_SIZE_MODE, SIZE_MODES, roleLadder, spaceLadder } from './size-modes.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Alert (antd Alert): a box with a type icon, a message, an optional description, an optional action (a Button in a content slot) and an optional close.
// Type (success, info, warning, error) picks the box's subtle fill, border and icon colour from the Color presets (error reads the danger preset). Variant is outlined
// (a border) or filled (none). Size is the five Midas steps, a ladder of spacing, icon, close and typography. The type glyph follows the type until the user picks another.
// The message is the managed primary text; the description, the action and the close are managed layers made while their props are on, never hidden. With a description
// a marker state takes the larger padding, gap, icon and the title style, and the root aligns its row to the top. Banner is a marker too. Ant Design structure only.

/** The Type modes, in the order the variable lists them. */
const TYPES = ['success', 'info', 'warning', 'error'];
/** The Variant modes: the outlined box has a border, the filled one has none. */
const VARIANTS = ['outlined', 'filled'];
/** The Color preset each type reads: antd's error colours are the danger palette. */
const TYPE_PRESET = { success: 'success', info: 'info', warning: 'warning', error: 'danger' };

/** A `tokenRoles` entry for one use of a type's preset: each Type mode maps to the preset's role of that use. */
const typeRoles = use => Object.fromEntries(TYPES.map(type => [type, presetRole(TYPE_PRESET[type], use)]));

/** The type glyph follows its type: a role map on the def (`alertSuccess`, ...), the glyph of the file for each. */
const TYPE_GLYPH = { prop: 'type', map: { success: 'alertSuccess', info: 'alertInfo', warning: 'alertWarning', error: 'alertError' } };

/** The type icon takes the type's solid colour and the Size icon; Alert has no disabled state. */
const TYPE_ICON_TOKENS = { colour: 'icon', disabledColour: 'icon', size: 'iconSize' };
/** The close is a quiet icon that darkens on hover (Play and the export only). */
const CLOSE_TOKENS = { colour: 'fgSecondary', disabledColour: 'fgSecondary', size: 'closeSize', hoverColour: 'fg' };

/** @type {TemplateSchema} */
export const ALERT = {
    id: 'antd-alert',
    name: 'Alert',
    primarySlot: 'label',
    sampleProps: { label: 'Alert message' },
    // A non-interactive element of its own: no disabled state. Its role is the alert landmark.
    element: { tag: 'div', attrs: { role: 'alert' }, blockClickProps: [] },
    anatomy: [
        { id: 'icon', kind: 'icon', optional: true, managed: true },
        // The message and the description stack in one column, between the icon and the action.
        { id: 'content', kind: 'frame', layout: 'vertical', primaryAlign: 'start', counterAlign: 'start', fill: true },
        { id: 'label', name: 'Title', kind: 'text', parent: 'content', optional: true, managed: true, typography: 'label', shownWhen: { prop: 'label', empty: false } },
        { id: 'description', kind: 'text', parent: 'content', optional: true, managed: true, typography: 'description', shownWhen: { prop: 'description', is: true } },
        // The action sits right of the message block, before the close: a box of its own that holds the Action slot.
        { id: 'actionBox', kind: 'frame', layout: 'horizontal', primaryAlign: 'center', counterAlign: 'center', managed: true, shownWhen: { prop: 'action', is: true } },
        // The close is an icon in a box of its own: the dismiss press takes the box out.
        { id: 'closer', kind: 'frame', layout: 'horizontal', primaryAlign: 'center', counterAlign: 'center', managed: true, shownWhen: { prop: 'closable', is: true } },
        { id: 'close', kind: 'icon', parent: 'closer', optional: true, managed: true },
    ],
    icons: [
        { show: 'iconShown', slot: 'icon', component: 'icon', role: TYPE_GLYPH, tokens: TYPE_ICON_TOKENS },
        { show: 'closable', slot: 'close', component: 'closeIcon', role: 'close', tokens: CLOSE_TOKENS },
    ],
    rootLayout: 'horizontal',
    rootAlign: 'center',
    rootPrimaryAlign: 'start',
    // 400 on the canvas; the Alert fills the width its container gives it (the `fills` prop below), so the number only holds a free-standing alert.
    rootWidth: 400,
    props: {
        type: { source: 'variable', collection: 'Type', modes: TYPES, defaultMode: 'info' },
        variant: { source: 'variable', collection: 'Variant', modes: VARIANTS, defaultMode: 'outlined' },
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        showIcon: { source: 'literal', type: 'boolean', default: true, visibleIf: { prop: 'banner', is: false } },
        // A banner always shows its icon (read from the others, never stored).
        iconShown: { source: 'literal', type: 'boolean', default: true, derived: { when: { any: [{ prop: 'showIcon', is: true }, { prop: 'banner', is: true }] } } },
        icon: { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'iconShown', is: true }, remembered: true },
        label: { source: 'literal', type: 'string', default: 'Alert message', node: { key: 'label', field: 'text' } },
        // With a description the icon and the close align to the first line (the top), else everything is centred on the row.
        description: { source: 'literal', type: 'boolean', default: false, node: { key: 'root', field: 'counterAlign' } },
        descriptionText: { source: 'literal', type: 'string', default: 'Additional description and information about this alert.', node: { key: 'description', field: 'text' }, visibleIf: { prop: 'description', is: true }, remembered: true },
        action: { source: 'literal', type: 'boolean', default: false },
        closable: { source: 'literal', type: 'boolean', default: false },
        closeIcon: { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'closable', is: true }, remembered: true },
        // The alert fills the width it is given by default; off, it hugs its content. A banner always fills (the derived prop below writes the sizing).
        fillWidth: { source: 'literal', type: 'boolean', default: true, visibleIf: { prop: 'banner', is: false } },
        fills: { source: 'literal', type: 'boolean', default: true, derived: { when: { any: [{ prop: 'fillWidth', is: true }, { prop: 'banner', is: true }] } }, node: { key: 'root', field: 'widthSizing', values: { true: 'fill', false: 'hug' } } },
        // A banner draws no radius and no border (the marker state below), and always shows its icon.
        banner: { source: 'literal', type: 'boolean', default: false },
    },
    // The action is a Button in the content slot below, inside the action box (a layer only while the `action` prop is on).
    // The slot is named apart from the prop: a slot's id is its prop name in the generated code.
    slots: [{ id: 'actionButton', name: 'Action', description: 'A Button shown after the message', holds: 'instance', min: 0, max: 1, accepts: ['button'], onlyAccepts: true, showEmpty: true, layout: 'horizontal', parent: 'actionBox' }],
    tokens: {
        fromType: ['bg', 'border', 'icon', 'fg', 'fgSecondary'],
        fromVariant: ['borderWidth', 'borderWidthNone'],
        fromSize: ['paddingX', 'paddingY', 'paddingXLarge', 'paddingYLarge', 'gap', 'gapLarge', 'contentGap', 'radius', 'radiusNone', 'iconSize', 'iconSizeLarge', 'closeSize', 'labelTypography', 'titleTypography', 'descriptionTypography'],
    },
    tokenKinds: {
        bg: 'color', border: 'color', icon: 'color', fg: 'color', fgSecondary: 'color',
        paddingX: 'length', paddingY: 'length', paddingXLarge: 'length', paddingYLarge: 'length', gap: 'length', gapLarge: 'length', contentGap: 'length', radius: 'length', radiusNone: 'length', borderWidth: 'length', borderWidthNone: 'length',
        iconSize: 'length', iconSizeLarge: 'length', closeSize: 'length',
        labelTypography: 'typography', titleTypography: 'typography', descriptionTypography: 'typography',
    },
    // The metrics are the ladder of the five Size steps (xs to xl). Font, icon and radius follow the same Midas steps as Button, Input and Tag; the spacing is the Alert's own.
    // Without a description: padding Y/X and the icon-to-content gap. With one: the larger padding, the icon size and the gaps (icon-to-content, title-to-description).
    tokenRoles: {
        bg: typeRoles('subtle'),
        border: typeRoles('border'),
        icon: typeRoles('solid'),
        fg: 'fg',
        fgSecondary: 'fg-secondary',
        borderWidth: { outlined: 'border-width', filled: 'border-width-none', default: 'border-width' },
        borderWidthNone: 'border-width-none',
        paddingY: spaceLadder([4, 6, 8, 10, 12]),
        paddingX: spaceLadder([8, 10, 12, 16, 20]),
        gap: spaceLadder([6, 8, 8, 10, 12]),
        paddingYLarge: spaceLadder([8, 12, 20, 24, 28]),
        paddingXLarge: spaceLadder([12, 16, 24, 28, 32]),
        gapLarge: spaceLadder([8, 10, 12, 14, 16]),
        contentGap: spaceLadder([4, 6, 8, 10, 12]),
        radius: roleLadder(['radius-xs', 'radius-sm', 'radius', 'radius-lg', 'radius-xl']),
        radiusNone: 'radius-none',
        iconSize: roleLadder(['icon-xs', 'icon-sm', 'icon-md', 'icon-lg', 'icon-xl']),
        iconSizeLarge: spaceLadder([16, 20, 24, 28, 32]),
        closeSize: spaceLadder([10, 12, 12, 14, 16]),
        labelTypography: roleLadder(['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl']),
        titleTypography: roleLadder(['text-sm', 'text-base', 'text-lg', 'text-xl', 'text-xl']),
        descriptionTypography: roleLadder(['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl']),
    },
    // Markers: each says a data attribute and swaps tokens; neither is a state the instance is in. The banner drops the radius and the border; a
    // description lifts the message to the title style and takes the larger padding, gap and icon.
    persistentStates: {
        banner: { prop: 'banner', tokens: { radius: 'radiusNone', borderWidth: 'borderWidthNone' }, marker: true },
        withDescription: { prop: 'description', tokens: { labelTypography: 'titleTypography', iconSize: 'iconSizeLarge', paddingX: 'paddingXLarge', paddingY: 'paddingYLarge', gap: 'gapLarge' }, marker: true },
    },
    previewStates: {},
    statePseudo: { banner: '[data-banner]', withDescription: '[data-description]' },
    parts: [],
    playOnly: [],
    press: [{ slot: 'closer', dismiss: true }],
    display: {
        root: { fill: 'bg', stroke: 'border', strokeWidth: 'borderWidth', radius: 'radius', paddingX: 'paddingX', paddingY: 'paddingY', gap: 'gap' },
        content: { gap: 'contentGap' },
        label: { fill: 'fg', typography: 'labelTypography' },
        description: { fill: 'fgSecondary', typography: 'descriptionTypography' },
        icon: { size: 'iconSize' },
        close: { size: 'closeSize' },
    },
    events: [],
};
