import { DEFAULT_SIZE_MODE, SIZE_MODES } from './size-modes.js';
import { COLOR_PRESETS, presetRoleMap } from './color-presets.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Tag (antd Tag): a label in a box, with an optional leading icon (hasIcon) and an optional close icon (closable). The box takes the Color preset's
// subtle fill, solid fill or border, and the Variant picks which (filled, solid, outlined). Closing dismisses the element (the generic dismiss press).
// Every size is a Tag role (tag-height per Size mode, the inset, the icon size); colours are preset tokens.

/** A Tag icon takes the text colour and the Size mode's icon size. Tag has no disabled state, so its disabled colour is the same text colour. */
const TAG_ICON_TOKENS = { colour: 'fg', disabledColour: 'fg', size: 'iconSize' };
/** The close is clickable: it recolours to the preset's solid colour on hover (Play and the export only). */
const CLOSE_TOKENS = { ...TAG_ICON_TOKENS, hoverColour: 'color-solid' };

/** @type {TemplateSchema} */
export const TAG = {
    id: 'antd-tag',
    name: 'Tag',
    primarySlot: 'label',
    sampleProps: { label: 'Tag' },
    element: { tag: 'span', attrs: {}, blockClickProps: [] },
    anatomy: [
        { id: 'icon', kind: 'icon', optional: true, managed: true },
        { id: 'label', kind: 'text', optional: true, managed: true, typography: 'label', shownWhen: { prop: 'label', empty: false } },
        // The close is an icon in a box of its own: the dismiss press takes the box out.
        { id: 'closer', kind: 'frame', layout: 'horizontal', primaryAlign: 'center', counterAlign: 'center', managed: true, shownWhen: { prop: 'closable', is: true } },
        { id: 'close', kind: 'icon', parent: 'closer', optional: true, managed: true },
    ],
    icons: [
        { show: 'hasIcon', slot: 'icon', component: 'icon', tokens: TAG_ICON_TOKENS },
        { show: 'closable', slot: 'close', component: 'closeIcon', role: 'close', tokens: CLOSE_TOKENS },
    ],
    rootLayout: 'horizontal',
    rootAlign: 'center',
    rootPrimaryAlign: 'start',
    props: {
        color: { source: 'variable', collection: 'Color', modes: COLOR_PRESETS, defaultMode: 'primary' },
        variant: { source: 'variable', collection: 'Variant', modes: ['filled', 'solid', 'outlined'], defaultMode: 'filled' },
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        label: { source: 'literal', type: 'string', default: 'Tag', node: { key: 'label', field: 'text' } },
        hasIcon: { source: 'literal', type: 'boolean', default: false },
        icon: { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'hasIcon', is: true }, remembered: true },
        closable: { source: 'literal', type: 'boolean', default: false },
        closeIcon: { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'closable', is: true }, remembered: true },
    },
    tokens: {
        fromSize: ['height', 'paddingX', 'iconSize', 'radius', 'gap', 'borderWidth', 'labelTypography'],
        fromColor: ['color-bg', 'color-solid', 'color-text', 'color-border', 'color-solid-text'],
        fromVariant: ['bg', 'fg', 'border'],
    },
    tokenKinds: {
        height: 'length', paddingX: 'length', iconSize: 'length', radius: 'length', gap: 'length', borderWidth: 'length', labelTypography: 'typography',
        'color-bg': 'color', 'color-solid': 'color', 'color-text': 'color', 'color-border': 'color', 'color-solid-text': 'color',
        bg: 'color', fg: 'color', border: 'color',
    },
    tokenRoles: {
        height: { xs: 'tag-height-xs', sm: 'tag-height-sm', md: 'tag-height', lg: 'tag-height-lg', xl: 'tag-height-xl', default: 'tag-height' },
        paddingX: 'tag-padding-x',
        iconSize: 'tag-icon-size',
        radius: 'radius-sm',
        gap: 'gap-xs',
        borderWidth: 'border-width',
        labelTypography: 'text-xs',
        'color-bg': presetRoleMap('subtle'),
        'color-solid': presetRoleMap('solid'),
        'color-text': presetRoleMap('text'),
        'color-border': presetRoleMap('border'),
        'color-solid-text': 'solid-text',
        bg: { filled: './color-bg', solid: './color-solid', outlined: 'transparent', default: './color-bg' },
        fg: { filled: './color-text', solid: './color-solid-text', outlined: './color-text', default: './color-text' },
        border: { filled: 'transparent', solid: 'transparent', outlined: './color-border', default: 'transparent' },
    },
    persistentStates: {},
    previewStates: {},
    parts: [],
    playOnly: [],
    press: [{ slot: 'closer', dismiss: true }],
    display: {
        root: { fill: 'bg', stroke: 'border', strokeWidth: 'borderWidth', radius: 'radius', height: 'height', paddingX: 'paddingX', gap: 'gap' },
        label: { fill: 'fg', typography: 'labelTypography' },
        icon: { size: 'iconSize' },
        close: { size: 'iconSize' },
    },
    events: [],
};
