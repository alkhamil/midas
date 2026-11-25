import { DEFAULT_SIZE_MODE, SIZE_MODES, roleLadder } from './size-modes.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Skeleton (antd Skeleton, with its Button, Input, Avatar, Image and Node placeholders in one component): a placeholder while content loads. Type picks the kind:
// text (a title bar and three lines, with an optional avatar beside them), paragraph (the three lines), avatar, button, input, image or node. Each kind shows only its
// own layers, and a prop shows only for the kinds it applies to: Shape for button, Avatar Shape for avatar (and text with an avatar), Block for button and input, and
// the glyph for image and node. Size is the five Midas steps. Active pulses the shown blocks in Play (an opacity pulse standing in for antd's sweep; the canvas and
// the export draw them at rest). Every block is a drawn box with its own size tokens; the root has a fixed width, so the blocks have room.

const ACTIVE = { prop: 'active', is: true };
const PULSE = [{ at: 0, props: { opacity: 1 } }, { at: 50, props: { opacity: 0.4 } }, { at: 100, props: { opacity: 1 } }];
/** The loop a shown block runs while Active is on (Play only). */
const ACTIVE_PULSE = { seconds: 1.4, easing: 'ease-in-out', delayMs: 0, when: ACTIVE, frames: PULSE };
/** The condition of a layer shown for one type. */
const TYPE = type => ({ prop: 'type', is: type });
/** The text kinds: the title bar and the lines. */
const TEXTUAL = { any: [TYPE('text'), TYPE('paragraph')] };
/** A picture or node glyph: its colour and size are tokens of the Size. */
const GLYPH = role => ({ role, tokens: { colour: 'iconColour', disabledColour: 'iconColour', size: 'iconSize' } });

/** @type {TemplateSchema} */
export const SKELETON = {
    id: 'antd-skeleton',
    name: 'Skeleton',
    // A non-interactive placeholder: no disabled state, so no disabled attribute, rule or guard.
    element: { tag: 'div', attrs: {}, blockClickProps: [] },
    anatomy: [
        // The text kinds: a column of a title bar and three lines (the paragraph has the lines only).
        { id: 'content', kind: 'frame', layout: 'vertical', primaryAlign: 'start', counterAlign: 'start', fill: true },
        { id: 'title', kind: 'frame', parent: 'content', layout: 'none', fill: true, managed: true, shownWhen: { all: [TYPE('text'), { prop: 'title', is: true }] }, loop: ACTIVE_PULSE },
        { id: 'row1', kind: 'frame', parent: 'content', layout: 'none', fill: true, managed: true, shownWhen: TEXTUAL, loop: ACTIVE_PULSE },
        { id: 'row2', kind: 'frame', parent: 'content', layout: 'none', fill: true, managed: true, shownWhen: TEXTUAL, loop: ACTIVE_PULSE },
        { id: 'row3', kind: 'frame', parent: 'content', layout: 'none', fill: true, managed: true, shownWhen: TEXTUAL, loop: ACTIVE_PULSE },
        // The block kinds: one drawn box each, shown for its type only (each with its own width and height tokens).
        { id: 'buttonBlock', kind: 'frame', layout: 'horizontal', primaryAlign: 'start', counterAlign: 'center', managed: true, shownWhen: TYPE('button'), loop: ACTIVE_PULSE },
        { id: 'inputBlock', kind: 'frame', layout: 'horizontal', primaryAlign: 'start', counterAlign: 'center', managed: true, shownWhen: TYPE('input'), loop: ACTIVE_PULSE },
        { id: 'imageBlock', kind: 'frame', layout: 'horizontal', primaryAlign: 'center', counterAlign: 'center', managed: true, shownWhen: TYPE('image'), loop: ACTIVE_PULSE },
        { id: 'nodeBlock', kind: 'frame', layout: 'horizontal', primaryAlign: 'center', counterAlign: 'center', managed: true, shownWhen: TYPE('node'), loop: ACTIVE_PULSE },
        // The glyph of each picture kind, drawn in its box (always shown there).
        { id: 'imageIcon', kind: 'icon', managed: true, alwaysVisible: true, parent: 'imageBlock' },
        { id: 'nodeIcon', kind: 'icon', managed: true, alwaysVisible: true, parent: 'nodeBlock' },
    ],
    icons: [
        { slot: 'imageIcon', component: 'imageIcon', label: 'Image', ...GLYPH('skeletonImage') },
        { slot: 'nodeIcon', component: 'nodeIcon', label: 'Node', ...GLYPH('skeletonNode') },
    ],
    slots: [],
    rootLayout: 'horizontal',
    rootAlign: 'start',
    rootPrimaryAlign: 'start',
    props: {
        type: { source: 'literal', type: 'enum', default: 'text', options: ['text', 'paragraph', 'avatar', 'button', 'input', 'image', 'node'], labels: { text: 'Text', paragraph: 'Paragraph', avatar: 'Avatar', button: 'Button', input: 'Input', image: 'Image', node: 'Node' } },
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        // Shape: the Button's corner (default, square, round, circle).
        shape: { source: 'variable', collection: 'Shape', modes: ['default', 'square', 'round', 'circle'], defaultMode: 'default', visibleIf: TYPE('button') },
        // Avatar Shape: the avatar's corner (square, circle), for the avatar kind and for the text kind with an avatar.
        avatarShape: { source: 'variable', collection: 'Avatar Shape', modes: ['square', 'circle'], defaultMode: 'circle', visibleIf: { any: [TYPE('avatar'), TYPE('text')] } },
        avatar: { source: 'literal', type: 'boolean', default: false, visibleIf: TYPE('text'), requires: ['size'] },
        title: { source: 'literal', type: 'boolean', default: true, visibleIf: TYPE('text'), requires: ['size'] },
        block: { source: 'literal', type: 'boolean', default: false, visibleIf: TYPE('button'), requires: ['size'], node: { key: 'buttonBlock', field: 'widthSizing', values: { true: 'fill', false: 'fixed' } } },
        inputBlock: { source: 'literal', type: 'boolean', default: false, visibleIf: TYPE('input'), requires: ['size'], node: { key: 'inputBlock', field: 'widthSizing', values: { true: 'fill', false: 'fixed' } } },
        imageIcon: { source: 'literal', type: 'iconComponent', default: null, visibleIf: TYPE('image'), remembered: true },
        nodeIcon: { source: 'literal', type: 'iconComponent', default: null, visibleIf: TYPE('node'), remembered: true },
        active: { source: 'literal', type: 'boolean', default: true, requires: ['size'] },
    },
    tokens: {
        fromSize: ['fill', 'iconColour', 'avatarSize', 'titleHeight', 'rowHeight', 'gap', 'radiusSmall', 'blockWidth', 'buttonHeight', 'buttonWidth', 'inputWidth', 'boxSize', 'iconSize'],
        fromShape: ['shapeRadius'],
        fromAvatarShape: ['avatarRadius'],
    },
    tokenKinds: {
        fill: 'color', iconColour: 'color', avatarSize: 'length', titleHeight: 'length', rowHeight: 'length', gap: 'length', radiusSmall: 'length', blockWidth: 'length',
        buttonHeight: 'length', buttonWidth: 'length', inputWidth: 'length', boxSize: 'length', iconSize: 'length', shapeRadius: 'length', avatarRadius: 'length',
    },
    tokenRoles: {
        // The subtle neutral of a placeholder (neutral 200): the page's background layer is too pale to show a block.
        fill: 'bg-disabled',
        iconColour: 'fg-secondary',
        // Approximate antd steps (its avatar is 24 small, 32 default, 40 large); each Size keeps its own role.
        avatarSize: roleLadder(['space-24', 'space-24', 'space-32', 'space-40', 'space-40']),
        titleHeight: roleLadder(['space-16', 'space-16', 'space-24', 'space-32', 'space-32']),
        rowHeight: roleLadder(['space-12', 'space-12', 'space-16', 'space-16', 'space-20']),
        gap: roleLadder(['gap-xs', 'gap-sm', 'gap', 'gap-lg', 'gap-xl']),
        radiusSmall: 'radius-sm',
        // The root's width: its blocks fill it, and a hugging root would leave a block with no content no width (antd's block is 100% here, a fixed 200).
        blockWidth: 'space-200',
        // antd's small, default and large buttons are 24, 32 and 40 high, 56 to 72 wide; an input is 200 wide (antd's default).
        buttonHeight: roleLadder(['space-24', 'space-24', 'space-32', 'space-40', 'space-40']),
        buttonWidth: roleLadder(['space-56', 'space-56', 'space-64', 'space-72', 'space-72']),
        inputWidth: 'space-200',
        // The picture and node boxes step with the Size, from 56 to 96.
        boxSize: roleLadder(['space-56', 'space-64', 'space-72', 'space-96', 'space-96']),
        iconSize: roleLadder(['icon-xs', 'icon-sm', 'icon-md', 'icon-lg', 'icon-xl']),
        // The Button's corner: the small radius, none for square, the full radius for round and circle.
        shapeRadius: { default: 'radius-sm', square: 'radius-none', round: 'radius-full', circle: 'radius-full' },
        // The avatar's corner: the small radius for a square, the full radius for a circle.
        avatarRadius: { square: 'radius-sm', circle: 'radius-full' },
    },
    persistentStates: {},
    previewStates: {},
    statePseudo: {},
    parts: [
        // The avatar: a round or square block beside the text (its own part, at the root). Shown for the avatar kind and for the text kind with an avatar.
        { id: 'avatar', kind: 'frame', shownWhen: { any: [TYPE('avatar'), { all: [TYPE('text'), { prop: 'avatar', is: true }] }] }, loop: ACTIVE_PULSE },
    ],
    playOnly: [],
    display: {
        root: { width: 'blockWidth' },
        content: { gap: 'gap' },
        title: { fill: 'fill', radius: 'radiusSmall', height: 'titleHeight' },
        row1: { fill: 'fill', radius: 'radiusSmall', height: 'rowHeight' },
        row2: { fill: 'fill', radius: 'radiusSmall', height: 'rowHeight' },
        row3: { fill: 'fill', radius: 'radiusSmall', height: 'rowHeight' },
        avatar: { fill: 'fill', radius: 'avatarRadius', size: 'avatarSize' },
        buttonBlock: { fill: 'fill', radius: 'shapeRadius', height: 'buttonHeight', width: 'buttonWidth' },
        inputBlock: { fill: 'fill', radius: 'radiusSmall', height: 'buttonHeight', width: 'inputWidth' },
        imageBlock: { fill: 'fill', radius: 'radiusSmall', size: 'boxSize' },
        nodeBlock: { fill: 'fill', radius: 'radiusSmall', size: 'boxSize' },
        imageIcon: { size: 'iconSize' },
        nodeIcon: { size: 'iconSize' },
    },
    events: [],
};
