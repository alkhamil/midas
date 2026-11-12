import { DEFAULT_SIZE_MODE, SIZE_MODES, roleLadder, spaceLadder } from './size-modes.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Card (antd Card): a box of up to four stacked parts, top to bottom: the head (the title and an optional extra at the end, with a border under it), a cover, the body
// (any children; three text lines to start) and an actions bar (three equal cells divided by borders, each its own slot). Each optional part is a layer of the instance
// only, made while its prop is on and removed while it is off; no layer is hidden. Size is the five Midas steps (head height, padding, action padding, typography).
// Variant is outlined (a border) or borderless (no border, a subtle resting shadow); Type is default or inner (the head takes a subtle fill). Hoverable is a marker:
// while it holds, the hover state turns the border transparent and lifts the card with a shadow (a preview state gated by the prop, never an outline), with a pointer cursor.
// The Extra and the actions are seeded with instances of other templates (a Link, Icon Buttons), whose own hover applies. Ant Design structure only.

const VARIANTS = ['outlined', 'borderless'];
const TYPES = ['default', 'inner'];

/** Where the cover sits: above the head or below it, while Cover is on. */
const COVER_ABOVE = { all: [{ prop: 'cover', is: true }, { prop: 'coverPosition', is: 'above' }] };
const COVER_BELOW = { all: [{ prop: 'cover', is: true }, { prop: 'coverPosition', is: 'below' }] };

/** The actions bar and its cells exist while Actions is on. */
const ACTIONS_ON = { prop: 'actions', is: true };

/** A cell of the actions bar: a container that centres its slot; the divider is its end border. */
const cell = (id, divider) => ({ id, kind: 'frame', parent: 'footer', managed: true, layout: 'horizontal', primaryAlign: 'center', counterAlign: 'center', fill: true, shownWhen: ACTIONS_ON, ...(divider ? { strokeSides: 'right' } : {}) });
/** The slot of a cell: it starts with an Icon Button (text variant) of the Card's size step. */
const actionSlot = (n, icon) => ({
    id: `action${n}`, name: `Action ${n}`, description: 'An icon button, a Button or text', holds: 'instance', min: 0, max: 1, showEmpty: true, layout: 'horizontal', parent: `action${n}Box`, shownWhen: ACTIONS_ON,
    seed: [{ template: 'icon-button', icon, modes: { variant: 'text' }, follow: { size: 'size' } }],
});
/** A line of the body's starting text. */
const bodyLine = id => ({ id, kind: 'text', parent: 'bodyBox', fill: true, typography: 'body', defaultText: 'Card content' });

/** @type {TemplateSchema} */
export const CARD = {
    id: 'antd-card',
    name: 'Card',
    primarySlot: 'title',
    sampleProps: { title: 'Card title' },
    element: { tag: 'div', attrs: {}, blockClickProps: [] },
    // The box's containers, in render order: the head, the cover, the body, the actions bar. Each optional container is made while its prop is on.
    anatomy: [
        // The cover is a frame drawn as a picture (an image slot), above the head or below it: one container for each place, there while Cover is on and its position holds.
        { id: 'aboveBox', kind: 'frame', layout: 'vertical', primaryAlign: 'start', counterAlign: 'start', managed: true, fill: true, shownWhen: COVER_ABOVE },
        // The head: the title fills it, so the extra sits at its end. Its bottom border divides it from what follows.
        { id: 'header', kind: 'frame', layout: 'horizontal', primaryAlign: 'start', counterAlign: 'center', strokeSides: 'bottom', managed: true, fill: true, shownWhen: { prop: 'header', is: true } },
        { id: 'title', name: 'Title', kind: 'text', parent: 'header', optional: true, managed: true, fill: true, typography: 'title', shownWhen: { prop: 'title', empty: false } },
        // The body is the frame that holds the children (no layer between): three lines of text to start, which the designer replaces or drops others beside.
        { id: 'belowBox', kind: 'frame', layout: 'vertical', primaryAlign: 'start', counterAlign: 'start', managed: true, fill: true, shownWhen: COVER_BELOW },
        { id: 'bodyBox', kind: 'frame', layout: 'vertical', primaryAlign: 'start', counterAlign: 'start', fill: true },
        bodyLine('bodyLine1'),
        bodyLine('bodyLine2'),
        bodyLine('bodyLine3'),
        // The actions bar: a top border, three equal cells divided by a border each (the last has none), each cell holds its own slot.
        { id: 'footer', kind: 'frame', layout: 'horizontal', primaryAlign: 'center', counterAlign: 'center', strokeSides: 'top', managed: true, fill: true, shownWhen: ACTIONS_ON },
        cell('action1Box', true),
        cell('action2Box', true),
        cell('action3Box', false),
    ],
    icons: [],
    rootLayout: 'vertical',
    rootAlign: 'start',
    rootPrimaryAlign: 'start',
    // 300 on the canvas, resizable: the node owns the width after the bind.
    rootWidth: 300,
    props: {
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        variant: { source: 'variable', collection: 'Variant', modes: VARIANTS, defaultMode: 'outlined' },
        type: { source: 'variable', collection: 'Type', modes: TYPES, defaultMode: 'default' },
        header: { source: 'literal', type: 'boolean', default: true },
        title: { source: 'literal', type: 'string', default: 'Card title', node: { key: 'title', field: 'text' }, visibleIf: { prop: 'header', is: true } },
        extra: { source: 'literal', type: 'boolean', default: false, visibleIf: { prop: 'header', is: true } },
        cover: { source: 'literal', type: 'boolean', default: false },
        // Where the cover sits; a Prop, not a slot. It starts below the head.
        coverPosition: { source: 'literal', type: 'enum', options: ['above', 'below'], labels: { above: 'Above header', below: 'Below header' }, default: 'below', visibleIf: { prop: 'cover', is: true } },
        // The cover's picture: it starts as the bundled placeholder when Cover turns on, and the Fill panel's image on the cover layer edits this same prop.
        coverImage: { source: 'literal', type: 'image', default: null, placeholder: true, nodes: [{ key: 'aboveBox', field: 'imageFill' }, { key: 'belowBox', field: 'imageFill' }], visibleIf: { prop: 'cover', is: true } },
        actions: { source: 'literal', type: 'boolean', default: false },
        hoverable: { source: 'literal', type: 'boolean', default: false },
    },
    // The cover, the head's extra and the three actions are content slots (a slot's id is its prop name in the generated code, so they are named apart from the
    // boolean props that show them). Extra starts with a Link ("More", the primary link colour), each action with an Icon Button: their own hover applies.
    slots: [
        { id: 'extraContent', name: 'Extra', description: 'A Link or Button at the end of the head', holds: 'instance', min: 0, max: 1, accepts: ['button', 'antd-link'], onlyAccepts: true, showEmpty: true, layout: 'horizontal', parent: 'header', shownWhen: { prop: 'extra', is: true }, seed: [{ template: 'antd-link', props: { label: 'More' }, follow: { size: 'size' } }] },
        { id: 'body', name: 'Body', description: 'The content of the card: anything', holds: 'content', min: 0, showEmpty: true, fill: true, layout: 'vertical', box: 'bodyBox' },
        { id: 'coverPicture', name: 'Cover', description: 'The cover picture: above the head or below it', holds: 'image', box: ['aboveBox', 'belowBox'], showEmpty: true, fill: true, layout: 'vertical' },
        actionSlot(1, 'setting'),
        actionSlot(2, 'edit'),
        actionSlot(3, 'ellipsis'),
    ],
    tokens: {
        fromSize: ['padding', 'actionPaddingY', 'gap', 'headHeight', 'coverHeight', 'radius', 'titleTypography', 'bodyTypography', 'bg', 'border', 'borderHover', 'fg', 'coverBg', 'lineWidth', 'shadowHover'],
        fromVariant: ['borderWidth', 'shadow'],
        fromType: ['headBg'],
    },
    tokenKinds: {
        bg: 'color', border: 'color', borderHover: 'color', fg: 'color', coverBg: 'color', headBg: 'color',
        padding: 'length', actionPaddingY: 'length', gap: 'length', headHeight: 'length', coverHeight: 'length', radius: 'length', borderWidth: 'length', lineWidth: 'length',
        titleTypography: 'typography', bodyTypography: 'typography',
        shadow: 'effect', shadowHover: 'effect',
    },
    // Size ladder (xs to xl). Head height 32/40/56/64/72; head padding-x and body padding 8/12/24/28/32; action cell padding-y 6/8/12/14/16. Font, radius and gap follow the
    // same Midas steps as Button, Input and Tag; the title is one text step up from the body, in the strong weight.
    tokenRoles: {
        bg: 'bg',
        border: 'border-secondary',
        // Hover: the border goes transparent and the lift shadow shows (Hoverable). At rest the card is flat.
        borderHover: 'transparent',
        coverBg: 'bg-subtle',
        headBg: { default: 'transparent', inner: 'bg-subtle' },
        fg: 'fg',
        lineWidth: 'border-width',
        borderWidth: { outlined: 'border-width', borderless: 'border-width-none', default: 'border-width' },
        shadow: { outlined: 'shadow-none', borderless: 'shadow-card-borderless', default: 'shadow-none' },
        shadowHover: 'shadow-card-hover',
        padding: spaceLadder([8, 12, 24, 28, 32]),
        actionPaddingY: spaceLadder([6, 8, 12, 14, 16]),
        gap: roleLadder(['gap-xs', 'gap-sm', 'gap', 'gap-lg', 'gap-xl']),
        headHeight: spaceLadder([32, 40, 56, 64, 72]),
        coverHeight: 'card-cover-height',
        radius: roleLadder(['radius-xs', 'radius-sm', 'radius', 'radius-lg', 'radius-xl']),
        titleTypography: roleLadder(['text-sm-strong', 'text-base-strong', 'text-lg-strong', 'text-xl-strong', 'text-xl-strong']),
        bodyTypography: roleLadder(['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl']),
    },
    // Hoverable is a marker: it says a data attribute, which gates the hover state and the pointer cursor.
    persistentStates: {
        hoverable: { prop: 'hoverable', tokens: {}, marker: true },
    },
    // Hover (Hoverable only): a transparent border and the lift shadow, over 0.2s. It is the one interaction state.
    previewStates: {
        hover: { border: 'borderHover', shadow: 'shadowHover' },
    },
    previewRequires: { hover: 'hoverable' },
    statePseudo: { hoverable: '[data-hoverable]', hover: ':hover' },
    motion: { transitions: [{ key: 'root', props: ['border-color', 'box-shadow'], duration: '0.2s', timing: 'ease' }] },
    cursor: [{ when: 'hoverable', value: 'pointer' }],
    parts: [],
    playOnly: [],
    press: [],
    // The root clips its children to its corners, so a cover follows the rounded top.
    clipsContent: true,
    display: {
        // The root's padding is its border width: the canvas stroke takes no room, so the children sit inside it as they do inside Play's border.
        root: { fill: 'bg', stroke: 'border', strokeWidth: 'borderWidth', radius: 'radius', shadow: 'shadow', paddingX: 'borderWidth', paddingY: 'borderWidth' },
        header: { fill: 'headBg', stroke: 'border', strokeWidth: 'lineWidth', paddingX: 'padding', gap: 'gap', minHeight: 'headHeight' },
        title: { fill: 'fg', typography: 'titleTypography' },
        // The cover's colour is the fallback under its picture, not a fill: the Fill list holds the picture alone.
        aboveBox: { fillFallback: 'coverBg', minHeight: 'coverHeight' },
        belowBox: { fillFallback: 'coverBg', minHeight: 'coverHeight' },
        bodyBox: { paddingX: 'padding', paddingY: 'padding' },
        bodyLine1: { fill: 'fg', typography: 'bodyTypography' },
        bodyLine2: { fill: 'fg', typography: 'bodyTypography' },
        bodyLine3: { fill: 'fg', typography: 'bodyTypography' },
        footer: { stroke: 'border', strokeWidth: 'lineWidth', paddingY: 'actionPaddingY' },
        action1Box: { stroke: 'border', strokeWidth: 'lineWidth' },
        action2Box: { stroke: 'border', strokeWidth: 'lineWidth' },
    },
    events: [],
};
