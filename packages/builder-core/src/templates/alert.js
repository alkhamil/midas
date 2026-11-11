import { presetRole } from './color-presets.js';
import { DEFAULT_SIZE_MODE, SIZE_MODES } from './size-modes.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Alert (antd Alert): a box with a type icon, a message, an optional description, an optional action (a Button in a content slot) and an optional close.
// The Type mode (success, info, warning, error) picks the box's subtle fill, its border and its icon colour from the Color presets (error reads the danger
// preset, as antd's error colours do). The Size mode holds the padding, gap, icon and typography. The type icon's glyph follows the type (a role map on the
// icon def) until the user picks another one. The message is the managed primary text; the description and the close are managed layers made while their
// props are on, never hidden. With a description the message takes the title style (a marker state that swaps its typography). Banner is a marker state
// too: no radius, no border. Closing dismisses the element (the generic dismiss press on the closer). Ant Design structure only.

/** The Type modes, in the order the variable lists them. */
const TYPES = ['success', 'info', 'warning', 'error'];
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
        { id: 'content', kind: 'frame', layout: 'vertical', primaryAlign: 'start', counterAlign: 'start' },
        { id: 'label', kind: 'text', parent: 'content', optional: true, managed: true, typography: 'label', shownWhen: { prop: 'label', empty: false } },
        { id: 'description', kind: 'text', parent: 'content', optional: true, managed: true, typography: 'description', shownWhen: { prop: 'description', is: true } },
        // The close is an icon in a box of its own: the dismiss press takes the box out.
        { id: 'closer', kind: 'frame', layout: 'horizontal', primaryAlign: 'center', counterAlign: 'center', managed: true, shownWhen: { prop: 'closable', is: true } },
        { id: 'close', kind: 'icon', parent: 'closer', optional: true, managed: true },
    ],
    icons: [
        { show: 'showIcon', slot: 'icon', component: 'icon', role: TYPE_GLYPH, tokens: TYPE_ICON_TOKENS },
        { show: 'closable', slot: 'close', component: 'closeIcon', role: 'close', tokens: CLOSE_TOKENS },
    ],
    rootLayout: 'horizontal',
    rootAlign: 'center',
    rootPrimaryAlign: 'start',
    props: {
        type: { source: 'variable', collection: 'Type', modes: TYPES, defaultMode: 'info' },
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        showIcon: { source: 'literal', type: 'boolean', default: true },
        icon: { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'showIcon', is: true }, remembered: true },
        label: { source: 'literal', type: 'string', default: 'Alert message', node: { key: 'label', field: 'text' } },
        description: { source: 'literal', type: 'boolean', default: false },
        descriptionText: { source: 'literal', type: 'string', default: 'Additional description and information about this alert.', node: { key: 'description', field: 'text' }, visibleIf: { prop: 'description', is: true }, remembered: true },
        action: { source: 'literal', type: 'boolean', default: false },
        closable: { source: 'literal', type: 'boolean', default: false },
        closeIcon: { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'closable', is: true }, remembered: true },
        // A banner fills the width it is given (its root's sizing), and draws no radius and no border (the marker state below).
        banner: { source: 'literal', type: 'boolean', default: false, nodes: [{ key: 'root', field: 'widthSizing', values: { true: 'fill', false: 'hug' } }] },
    },
    // The action is a Button in the content slot below, a layer only while the `action` prop is on (its slot shows empty while it holds, never hidden).
    // The slot is named apart from the prop: a slot's id is its prop name in the generated code.
    slots: [{ id: 'actionButton', name: 'Action', description: 'A Button shown after the message', min: 0, max: 1, accepts: ['button'], onlyAccepts: true, showEmpty: true, layout: 'horizontal', shownWhen: { prop: 'action', is: true } }],
    tokens: {
        fromType: ['bg', 'border', 'icon', 'fg', 'fgSecondary'],
        fromSize: ['paddingX', 'paddingY', 'gap', 'radius', 'radiusNone', 'borderWidth', 'borderWidthNone', 'iconSize', 'iconSizeLarge', 'closeSize', 'labelTypography', 'titleTypography', 'descriptionTypography'],
    },
    tokenKinds: {
        bg: 'color', border: 'color', icon: 'color', fg: 'color', fgSecondary: 'color',
        paddingX: 'length', paddingY: 'length', gap: 'length', radius: 'length', radiusNone: 'length', borderWidth: 'length', borderWidthNone: 'length',
        iconSize: 'length', iconSizeLarge: 'length', closeSize: 'length',
        labelTypography: 'typography', titleTypography: 'typography', descriptionTypography: 'typography',
    },
    tokenRoles: {
        bg: typeRoles('subtle'),
        border: typeRoles('border'),
        icon: typeRoles('solid'),
        fg: 'fg',
        fgSecondary: 'fg-secondary',
        paddingX: 'alert-padding-x',
        paddingY: 'alert-padding-y',
        gap: 'gap-sm',
        radius: 'radius-lg',
        radiusNone: 'radius-none',
        borderWidth: 'border-width',
        borderWidthNone: 'border-width-none',
        iconSize: { xs: 'icon-xs', sm: 'icon-sm', md: 'icon-md', lg: 'icon-lg', xl: 'icon-xl', default: 'icon-md' },
        iconSizeLarge: { xs: 'icon-sm', sm: 'icon-md', md: 'icon-xl', lg: 'icon-xl', xl: 'icon-xl', default: 'icon-xl' },
        closeSize: 'icon-xs',
        labelTypography: { xs: 'text-xs', sm: 'text-xs', md: 'text-sm', lg: 'text-base', xl: 'text-lg', default: 'text-sm' },
        titleTypography: { xs: 'text-xs-strong', sm: 'text-sm-strong', md: 'text-lg-strong', lg: 'text-lg-strong', xl: 'text-xl-strong', default: 'text-lg-strong' },
        descriptionTypography: { xs: 'text-xs', sm: 'text-xs', md: 'text-sm', lg: 'text-base', xl: 'text-lg', default: 'text-sm' },
    },
    // Markers: each says a data attribute and swaps tokens; neither is a state the instance is in. The banner drops the radius and the border; a
    // description lifts the message to the title style.
    persistentStates: {
        banner: { prop: 'banner', tokens: { radius: 'radiusNone', borderWidth: 'borderWidthNone' }, marker: true },
        withDescription: { prop: 'description', tokens: { labelTypography: 'titleTypography', iconSize: 'iconSizeLarge' }, marker: true },
    },
    previewStates: {},
    statePseudo: { banner: '[data-banner]', withDescription: '[data-description]' },
    parts: [],
    playOnly: [],
    press: [{ slot: 'closer', dismiss: true }],
    display: {
        root: { fill: 'bg', stroke: 'border', strokeWidth: 'borderWidth', radius: 'radius', paddingX: 'paddingX', paddingY: 'paddingY', gap: 'gap' },
        label: { fill: 'fg', typography: 'labelTypography' },
        description: { fill: 'fgSecondary', typography: 'descriptionTypography' },
        icon: { size: 'iconSize' },
        close: { size: 'closeSize' },
    },
    events: [],
};
