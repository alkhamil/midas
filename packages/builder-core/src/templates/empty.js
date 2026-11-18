import { DEFAULT_SIZE_MODE, SIZE_MODES, roleLadder } from './size-modes.js';
import { TEXT_STYLES } from './typography-base.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Empty (antd Empty): a centred placeholder for a missing list or result. It holds an image (the file's default icon, a managed icon slot shown by hasImage),
// a description (a managed text, made while the text is not empty) and an action (a content slot of Buttons or Links, shown by hasAction). Every size is a
// token of the Size mode: the image box, the gap between the parts and the description's text style. Ant Design structure only; the colour is the secondary text.

/** The image size of each Size mode (antd's empty image is 40 px, a larger one at the bigger sizes). */
const IMAGE_SIZE = roleLadder(['space-40', 'space-40', 'space-56', 'space-64', 'space-72']);

/** @type {TemplateSchema} */
export const EMPTY = {
    id: 'antd-empty',
    name: 'Empty',
    primarySlot: 'description',
    sampleProps: { description: 'No Data' },
    // A non-interactive block: no disabled state, so no disabled attribute, rule or guard.
    element: { tag: 'div', attrs: {}, blockClickProps: [] },
    anatomy: [
        { id: 'icon', kind: 'icon', optional: true, managed: true },
        { id: 'description', kind: 'text', optional: true, managed: true, typography: 'label', shownWhen: { prop: 'description', empty: false } },
    ],
    icons: [{ show: 'hasImage', slot: 'icon', component: 'icon', label: 'Image', tokens: { colour: 'fg-secondary', disabledColour: 'fg-secondary', size: 'imageSize' } }],
    slots: [
        // The action is an instance (a Button or a Link) that sits under the description, shown while hasAction is on.
        { id: 'action', name: 'Action', description: 'A Button or Link under the description', holds: 'instance', min: 0, max: 1, accepts: ['button', 'antd-link'], onlyAccepts: true, showEmpty: true, layout: 'horizontal', shownWhen: { prop: 'hasAction', is: true } },
    ],
    rootLayout: 'vertical',
    rootAlign: 'center',
    rootPrimaryAlign: 'center',
    props: {
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        hasImage: { source: 'literal', type: 'boolean', default: true, requires: ['size'] },
        description: { source: 'literal', type: 'string', default: 'No Data', node: { key: 'description', field: 'text' } },
        icon: { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'hasImage', is: true }, remembered: true },
        hasAction: { source: 'literal', type: 'boolean', default: false, requires: ['size'] },
    },
    tokens: {
        fromSize: ['imageSize', 'gap', 'labelTypography', 'fg-secondary'],
    },
    tokenKinds: { 'fg-secondary': 'color', imageSize: 'length', gap: 'length', labelTypography: 'typography' },
    tokenRoles: {
        'fg-secondary': 'fg-secondary',
        imageSize: IMAGE_SIZE,
        gap: roleLadder(['gap-xs', 'gap-sm', 'gap', 'gap-lg', 'gap-xl']),
        labelTypography: TEXT_STYLES,
    },
    persistentStates: {},
    previewStates: {},
    statePseudo: {},
    parts: [],
    playOnly: [],
    display: {
        root: { gap: 'gap' },
        icon: { size: 'imageSize' },
        description: { fill: 'fg-secondary', typography: 'labelTypography' },
    },
    events: [],
};
