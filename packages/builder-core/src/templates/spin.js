import { DEFAULT_SIZE_MODE, SIZE_MODES, roleLadder } from './size-modes.js';
import { COLOR_PRESETS, presetRoleMap } from './color-presets.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Spin: a loading indicator with no text. Type picks the indicator. Dots (antd's default: four circles at the corners of a square, which turns as a whole and
// whose dots take turns to fade in) and arc (the quarter arc Button draws) are antd's. The rings are SpinThatShit's loaders, drawn as arcs of the same geometry:
// ring (a track with a turning head), two arcs (top and bottom, turning), dot ring (a track with a head that turns), gap ring (a ring with an open quarter that
// turns), scale ring (a ring that grows and fades). Each indicator is shown while `spinning` is on and removed when it is off, so there is no hidden layer.
// The geometry follows antd's three sizes: small (xs, sm), default (md), large (lg, xl). Play animates the indicator; the export and the canvas draw it at rest.

const DOT_PARTS = ['dot1', 'dot2', 'dot3', 'dot4'];
const SPINNING = { prop: 'spinning', is: true };
const TYPE = type => ({ prop: 'type', is: type });
const ON = type => ({ all: [SPINNING, TYPE(type)] });
const DOTS = ON('dots');
const ARC = ON('arc');
const RING = ON('ring');
const TWO_ARCS = ON('ringTwo');
const DOT_RING = ON('ringDot');
const GAP_RING = ON('ringGap');
const SCALE_RING = ON('ringScale');
/** The holder of the rings whose parts turn together (two arcs, a head on a track, a gap). */
const RING_BOX = { all: [SPINNING, { any: [TYPE('ring'), TYPE('ringTwo'), TYPE('ringDot'), TYPE('ringGap')] }] };
/** antd's holder turns in 1.2 seconds; the SpinThatShit loaders turn in one. */
const HOLDER_SPIN = { seconds: 1.2 };
const RING_SPIN = { seconds: 1 };

/** An arc part of the rings: the same ring geometry, drawn at the Size's box, with its colour token. */
const ring = (id, colour, start, sweep, shownWhen, { ratio = 75, fill = false, ...extra } = {}) => ({
    id, kind: 'frame', shownWhen, ...extra,
    tokens: { colour, disabledColour: colour, size: 'boxSize' },
    // A fill ring is a donut drawn in its colour (the ratio is its inner radius): no stroke, so its width is 0.
    arc: { size: 14, start, sweep, ratio, width: fill ? 0 : 1.5 },
});

/** @type {TemplateSchema} */
export const SPIN = {
    id: 'antd-spin',
    name: 'Spin',
    // A non-interactive status element: no disabled state, so no disabled attribute, rule or guard.
    element: { tag: 'span', attrs: { role: 'status' }, blockClickProps: [] },
    // dotBox is the holder of the dots (a square the Size sets) with two columns of two dots; ringBox is the holder of the rings that turn together. Containers
    // nest one level, so each holder sits at the root. The arc and the scale ring are parts at the root: no box of their own.
    anatomy: [
        { id: 'dotBox', kind: 'frame', layout: 'horizontal', primaryAlign: 'center', counterAlign: 'center', managed: true, shownWhen: DOTS, spin: HOLDER_SPIN },
        { id: 'dotCol1', kind: 'frame', parent: 'dotBox', layout: 'vertical', primaryAlign: 'start', counterAlign: 'center', managed: true, shownWhen: DOTS },
        { id: 'dotCol2', kind: 'frame', parent: 'dotBox', layout: 'vertical', primaryAlign: 'start', counterAlign: 'center', managed: true, shownWhen: DOTS },
        { id: 'ringBox', kind: 'frame', layout: 'none', managed: true, shownWhen: RING_BOX, spin: RING_SPIN },
    ],
    icons: [],
    rootLayout: 'horizontal',
    rootAlign: 'center',
    rootPrimaryAlign: 'center',
    props: {
        color: { source: 'variable', collection: 'Color', modes: COLOR_PRESETS, defaultMode: 'primary' },
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        spinning: { source: 'literal', type: 'boolean', default: true },
        type: {
            source: 'literal', type: 'enum', default: 'dots',
            options: ['dots', 'arc', 'ring', 'ringTwo', 'ringDot', 'ringGap', 'ringScale'],
            labels: { dots: 'Dots', arc: 'Arc', ring: 'Ring', ringTwo: 'Two arcs', ringDot: 'Dot ring', ringGap: 'Gap ring', ringScale: 'Scale ring' },
        },
    },
    tokens: {
        fromColor: ['fg', 'ring-track'],
        fromSize: ['iconSize', 'boxSize', 'dotSize', 'ringDot', 'dotGap', 'radiusFull'],
    },
    tokenKinds: { fg: 'color', 'ring-track': 'color', iconSize: 'length', boxSize: 'length', dotSize: 'length', dotGap: 'length', ringDot: 'length', radiusFull: 'length' },
    tokenRoles: {
        fg: presetRoleMap('text'),
        'ring-track': presetRoleMap('border'),
        iconSize: roleLadder(['icon-xs', 'icon-sm', 'icon-md', 'icon-lg', 'icon-xl']),
        // antd: the holder is 14 (small), 20 (default), 32 (large); each dot is (holder - 2) / 2 across: 6, 9, 15.
        boxSize: roleLadder(['space-14', 'space-14', 'space-20', 'space-32', 'space-32']),
        dotSize: roleLadder(['space-6', 'space-6', 'space-9', 'space-15', 'space-15']),
        dotGap: 'space-2',
        // The dot of the dot ring is a fifth of the holder (antd's proportions: 2 at the small sizes, 4 at md, 6 at the large sizes).
        ringDot: roleLadder(['space-2', 'space-2', 'space-4', 'space-6', 'space-6']),
        radiusFull: 'radius-full',
    },
    persistentStates: {},
    previewStates: {},
    statePseudo: {},
    // Parts: the arc (type arc); the four dots, two per column, each pulsing 0.4 seconds after the one before (type dots); the ring parts; the scale ring.
    parts: [
        { id: 'spinner', kind: 'frame', shownWhen: ARC, spin: true, tokens: { colour: 'fg', disabledColour: 'fg', size: 'boxSize' }, arc: { size: 14, start: -90, sweep: 25, ratio: 75, width: 1.5 } },
        ...DOT_PARTS.map((id, i) => ({ id, kind: 'frame', parent: i < 2 ? 'dotCol1' : 'dotCol2', shownWhen: DOTS, pulse: { delayMs: i * 400 } })),
        // Ring: a track, and a head that turns over it.
        ring('ringTrack', 'ring-track', 0, 100, RING, { parent: 'ringBox' }),
        ring('ringHead', 'fg', -90, 25, RING, { parent: 'ringBox' }),
        // Two arcs: a top and a bottom one, turning together in the holder.
        ring('ringTop', 'fg', -135, 25, TWO_ARCS, { parent: 'ringBox' }),
        ring('ringBottom', 'fg', 45, 25, TWO_ARCS, { parent: 'ringBox' }),
        // Dot ring: a track and a head, turning together in the holder.
        ring('dotRingTrack', 'ring-track', 0, 100, DOT_RING, { parent: 'ringBox', ratio: 90, fill: true }),
        // Gap ring: a ring with an open quarter, turning in the holder.
        ring('gapRing', 'fg', 0, 75, GAP_RING, { parent: 'ringBox' }),
        // The dot of the dot ring: a circle at the top of its cap.
        // The dot sits centred on the holder, lifted 1.5 px above its top edge at every Size (out of the holder's flow). It is drawn after the track, so it sits on the ring.
        { id: 'dotHead', kind: 'frame', parent: 'ringBox', shownWhen: DOT_RING, lift: -1.5 },
        // Scale ring: a full ring that grows and fades.
        ring('scaleRing', 'fg', 0, 100, SCALE_RING, { scale: { delayMs: 0 } }),
    ],
    playOnly: [
        { id: 'spin', reason: 'the arcs and the holders turn, the dots pulse and the scale ring grows: animations, so the canvas and the export draw the indicator at rest' },
    ],
    display: {
        dotBox: { size: 'boxSize', gap: 'dotGap' },
        dotCol1: { gap: 'dotGap' },
        dotCol2: { gap: 'dotGap' },
        ringBox: { size: 'boxSize' },
        spinner: { stroke: 'fg', size: 'boxSize' },
        ringTrack: { stroke: 'ring-track', size: 'boxSize' },
        ringHead: { stroke: 'fg', size: 'boxSize' },
        ringTop: { stroke: 'fg', size: 'boxSize' },
        ringBottom: { stroke: 'fg', size: 'boxSize' },
        dotRingTrack: { fill: 'ring-track', size: 'boxSize' },
        gapRing: { stroke: 'fg', size: 'boxSize' },
        scaleRing: { stroke: 'fg', size: 'boxSize' },
        dotHead: { fill: 'fg', radius: 'radiusFull', size: 'ringDot' },
        dot1: { fill: 'fg', radius: 'radiusFull', size: 'dotSize' },
        dot2: { fill: 'fg', radius: 'radiusFull', size: 'dotSize' },
        dot3: { fill: 'fg', radius: 'radiusFull', size: 'dotSize' },
        dot4: { fill: 'fg', radius: 'radiusFull', size: 'dotSize' },
    },
    events: [],
};
