import { DEFAULT_SIZE_MODE, SIZE_MODES } from './size-modes.js';
import { COLOR_PRESETS, presetRoleMap } from './color-presets.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Avatar (antd Avatar): a square box (the Size on both axes) holding a label, an icon or a picture, round or square by Shape. The content picks which managed layer
// the instance holds (text or icon), so none is ever hidden. Color picks one of the eight presets and Variant (filled, solid) which of its colours the box takes. Size and radius are tokens: the Size is antd's 24 / 32 / 40, the square radius is the
// Size radius and a circle is the full radius. Ant Design structure only. The picture is an image fill on the box (`src`), over the colour.

/** The icon follows the text colour and the Size mode's icon size. Avatar has no disabled state, so its disabled colour is the same colour. */
const AVATAR_ICON_TOKENS = { colour: 'fg', disabledColour: 'fg', size: 'iconSize' };

/** @type {TemplateSchema} */
export const AVATAR = {
    id: 'antd-avatar',
    name: 'Avatar',
    primarySlot: 'label',
    sampleProps: { label: 'U' },
    // A non-interactive element: no disabled state, so no disabled attribute, rule or guard.
    element: { tag: 'span', attrs: {}, blockClickProps: [] },
    anatomy: [
        { id: 'label', kind: 'text', optional: true, managed: true, typography: 'label', shownWhen: { all: [{ prop: 'content', is: 'text' }, { prop: 'label', empty: false }] } },
        { id: 'icon', kind: 'icon', optional: true, managed: true },
    ],
    icons: [{ show: 'showIcon', slot: 'icon', component: 'icon', tokens: AVATAR_ICON_TOKENS }],
    rootLayout: 'horizontal',
    rootAlign: 'center',
    rootPrimaryAlign: 'center',
    props: {
        color: { source: 'variable', collection: 'Color', modes: COLOR_PRESETS, defaultMode: 'neutral' },
        variant: { source: 'variable', collection: 'Variant', modes: ['filled', 'solid'], defaultMode: 'solid' },
        shape: { source: 'variable', collection: 'Shape', modes: ['circle', 'square'], defaultMode: 'circle' },
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        content: { source: 'literal', type: 'enum', options: ['text', 'icon', 'image'], default: 'text', control: 'segmented' },
        label: { source: 'literal', type: 'string', default: 'U', node: { key: 'label', field: 'text' }, visibleIf: { prop: 'content', is: 'text' }, remembered: true },
        icon: { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'content', is: 'icon' }, remembered: true },
        // The picture: an uploaded asset (the export takes a URL string). A fill on the root, over the colour; hidden props resolve to nothing, so only the image content shows it.
        src: { source: 'literal', type: 'image', default: null, visibleIf: { prop: 'content', is: 'image' }, node: { key: 'root', field: 'imageFill' }, remembered: true },
        // Read from content, never stored: whether the icon layer exists.
        showIcon: { source: 'literal', type: 'boolean', default: false, derived: { when: { prop: 'content', is: 'icon' } } },
    },
    tokens: {
        fromShape: ['shapeRadius'],
        fromColor: ['color-bg', 'color-solid', 'color-text', 'color-solid-text'],
        fromVariant: ['bg', 'fg'],
        fromSize: ['avatarSize', 'radius', 'iconSize', 'labelTypography'],
    },
    tokenKinds: {
        shapeRadius: 'length',
        avatarSize: 'length', radius: 'length', iconSize: 'length', labelTypography: 'typography',
        'color-bg': 'color', 'color-solid': 'color', 'color-text': 'color', 'color-solid-text': 'color', bg: 'color', fg: 'color',
    },
    tokenRoles: {
        // The Shape picks the radius: the full radius for a circle, the Size radius for a square (followed through the Size collection).
        shapeRadius: { circle: 'radius-full', square: './radius', default: './radius' },
        avatarSize: { xs: 'avatar-size-xs', sm: 'avatar-size-sm', md: 'avatar-size', lg: 'avatar-size-lg', xl: 'avatar-size-xl', default: 'avatar-size' },
        radius: { xs: 'radius-xs', sm: 'radius-sm', md: 'radius', lg: 'radius-lg', xl: 'radius-xl', default: 'radius' },
        iconSize: { xs: 'avatar-icon-size-xs', sm: 'avatar-icon-size-sm', md: 'avatar-icon-size', lg: 'avatar-icon-size-lg', xl: 'avatar-icon-size-xl', default: 'avatar-icon-size' },
        // The Color preset's tokens; the Variant picks which the box and the label read (filled: the subtle fill and the text colour, solid: the solid fill and its text).
        'color-bg': presetRoleMap('subtle'),
        'color-solid': presetRoleMap('solid'),
        'color-text': presetRoleMap('text'),
        'color-solid-text': 'solid-text',
        bg: { filled: './color-bg', solid: './color-solid', default: './color-solid' },
        fg: { filled: './color-text', solid: './color-solid-text', default: './color-solid-text' },
        labelTypography: 'text-sm',
    },
    persistentStates: {},
    previewStates: {},
    parts: [],
    playOnly: [],
    display: {
        root: { fill: 'bg', radius: 'shapeRadius', size: 'avatarSize' },
        label: { fill: 'fg', typography: 'labelTypography' },
        icon: { size: 'iconSize' },
    },
    events: [],
};
