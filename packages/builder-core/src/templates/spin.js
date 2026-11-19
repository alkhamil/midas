import { ICON_PART_DISPLAY } from './icon-slots.js';
import { DEFAULT_SIZE_MODE, SIZE_MODES, roleLadder } from './size-modes.js';
import { COLOR_PRESETS, presetRoleMap } from './color-presets.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Spin (antd Spin): a loading indicator with no text. Type picks the indicator: dots (antd's default: four circles at the corners of a square, which turns
// as a whole and whose dots take turns to fade in) or arc (the quarter arc Button draws). Each is shown while `spinning` is on and removed when it is off, so
// there is no hidden layer. The geometry is antd's: the dot holder is a square of the holder size, each dot is (holder - 2) / 2 across and the gap between
// them is 2, so the four dots fill the square. Size follows antd's three sizes: small (xs, sm), default (md), large (lg, xl). The export draws the indicator at
// rest; Play turns the holder and pulses the dots.

const DOT_PARTS = ['dot1', 'dot2', 'dot3', 'dot4'];
const SPINNING = { prop: 'spinning', is: true };
const DOTS = { all: [SPINNING, { prop: 'type', is: 'dots' }] };
const ARC = { all: [SPINNING, { prop: 'type', is: 'arc' }] };
/** antd's holder turns in 1.2 seconds. */
const HOLDER_SPIN = { seconds: 1.2 };

/** @type {TemplateSchema} */
export const SPIN = {
    id: 'antd-spin',
    name: 'Spin',
    // A non-interactive status element: no disabled state, so no disabled attribute, rule or guard.
    element: { tag: 'span', attrs: { role: 'status' }, blockClickProps: [] },
    // dotBox is the holder for the dots (a square the Size sets) with two columns of two dots; containers nest one level, so the columns are its own.
    // The arc is a part at the root: no box of its own.
    anatomy: [
        { id: 'dotBox', kind: 'frame', layout: 'horizontal', primaryAlign: 'center', counterAlign: 'center', managed: true, shownWhen: DOTS, spin: HOLDER_SPIN },
        { id: 'dotCol1', kind: 'frame', parent: 'dotBox', layout: 'vertical', primaryAlign: 'start', counterAlign: 'center', managed: true, shownWhen: DOTS },
        { id: 'dotCol2', kind: 'frame', parent: 'dotBox', layout: 'vertical', primaryAlign: 'start', counterAlign: 'center', managed: true, shownWhen: DOTS },
    ],
    icons: [],
    rootLayout: 'horizontal',
    rootAlign: 'center',
    rootPrimaryAlign: 'center',
    props: {
        color: { source: 'variable', collection: 'Color', modes: COLOR_PRESETS, defaultMode: 'primary' },
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        spinning: { source: 'literal', type: 'boolean', default: true },
        type: { source: 'literal', type: 'enum', options: ['dots', 'arc'], default: 'dots' },
    },
    tokens: {
        fromColor: ['fg'],
        fromSize: ['iconSize', 'dotBox', 'dotSize', 'dotGap', 'radiusFull'],
    },
    tokenKinds: { fg: 'color', iconSize: 'length', dotBox: 'length', dotSize: 'length', dotGap: 'length', radiusFull: 'length' },
    tokenRoles: {
        fg: presetRoleMap('text'),
        iconSize: roleLadder(['icon-xs', 'icon-sm', 'icon-md', 'icon-lg', 'icon-xl']),
        // antd: the holder is 14 (small), 20 (default), 32 (large); each dot is (holder - 2) / 2 across: 6, 9, 15.
        dotBox: roleLadder(['space-14', 'space-14', 'space-20', 'space-32', 'space-32']),
        dotSize: roleLadder(['space-6', 'space-6', 'space-9', 'space-15', 'space-15']),
        dotGap: 'space-2',
        radiusFull: 'radius-full',
    },
    persistentStates: {},
    previewStates: {},
    statePseudo: {},
    // The arc is the part for the arc type; the four dots are parts for the dots type, two per column, each pulsing 0.4 seconds after the one before.
    // The arc turns in Play and the export draws it at rest; the holder turns in Play (its own spin on the anatomy frame).
    parts: [
        { id: 'spinner', kind: 'frame', shownWhen: ARC, spin: true, tokens: { colour: 'fg', disabledColour: 'fg', size: 'iconSize' }, arc: { size: 14, start: -90, sweep: 25, ratio: 75, width: 1.5 } },
        ...DOT_PARTS.map((id, i) => ({ id, kind: 'frame', parent: i < 2 ? 'dotCol1' : 'dotCol2', shownWhen: DOTS, pulse: { delayMs: i * 400 } })),
    ],
    playOnly: [
        { id: 'spin', reason: 'the arc and the holder turn, and the dots pulse: animations, so the canvas and the export draw the indicator at rest' },
    ],
    display: {
        dotBox: { size: 'dotBox', gap: 'dotGap' },
        dotCol1: { gap: 'dotGap' },
        dotCol2: { gap: 'dotGap' },
        spinner: ICON_PART_DISPLAY,
        dot1: { fill: 'fg', radius: 'radiusFull', size: 'dotSize' },
        dot2: { fill: 'fg', radius: 'radiusFull', size: 'dotSize' },
        dot3: { fill: 'fg', radius: 'radiusFull', size: 'dotSize' },
        dot4: { fill: 'fg', radius: 'radiusFull', size: 'dotSize' },
    },
    events: [],
};
