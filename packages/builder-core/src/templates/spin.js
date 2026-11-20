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
const TWO_SCALE_RINGS = ON('ringScaleTwo');
const SQUARES = ON('squares');
const SLIDE = ON('dotSlide');
/** The stops a looping highlight is keyed at (SpinThatShit loaders 08 and 12 light one of four or five steps per cycle). */
const LOOP_STOPS = [0, 25, 50, 75, 100];
/** Opacity keys of a loop that lights one stop: full at `peak`, dim at every other stop. */
const lit = peak => LOOP_STOPS.map(at => ({ at, props: { opacity: at === peak ? 1 : 0.2 } }));
const ORBIT = ON('orbit');
const BARS = ON('bars');
const BOUNCE = ON('bounce');
const BOUNCE_ALT = ON('bounceAlt');
/** Eight dots on a circle (SpinThatShit loader 07): the colours step one place each eighth of the cycle, so the lit dot moves round clockwise. */
const ORBIT_ALPHAS = [0.05, 0.1, 0.2, 0.3, 0.4, 0.6, 0.8, 1];
const orbitFrames = k => ORBIT_ALPHAS.map((_, s) => ({ at: s * 12.5, props: { opacity: ORBIT_ALPHAS[(((k - s) % 8) + 8) % 8] } })).concat([{ at: 100, props: { opacity: ORBIT_ALPHAS[k] } }]);
/** The dots sit on a circle of 0.8 of the holder's half size, with the dot of the dot ring (the eight dots need that much room: a chord of 0.77 radius). */
const ORBIT_RADIUS = 0.8;
/** Loader 09: each bar is stretched by its box-shadow copies, 12 px up and down of its 20 px height: 44 of 20 at the middle of the cycle. */
const BAR_STRETCH = 44 / 20;
const STRETCH_FRAMES = [{ at: 0, props: { transform: 'scaleY(1)' } }, { at: 50, props: { transform: `scaleY(${BAR_STRETCH})` } }, { at: 100, props: { transform: 'scaleY(1)' } }];
/** Loader 10: a dot grows from a point to its full size where it sits, and back (alternate). */
const GROW_FRAMES = [{ at: 0, props: { transform: 'scale(0)' } }, { at: 100, props: { transform: 'scale(1)' } }];
/** Loader 11: a dot moves up by its own box (the loop's `travel` token, the Size's box), and back (alternate). */
const HOP_UP_FRAMES = [{ at: 0, props: { transform: 'translateY(0)' } }, { at: 100, props: { transform: 'translateY(calc($travel * -1))' } }];
/** The holder of the rings whose parts turn together (two arcs, a head on a track, a gap). */
const RING_BOX = { all: [SPINNING, { any: [TYPE('ring'), TYPE('ringTwo'), TYPE('ringGap')] }] };
/** antd's holder turns in 1.2 seconds; the SpinThatShit loaders turn in one. */
const HOLDER_SPIN = { seconds: 1.2 };
const RING_SPIN = { seconds: 1 };
/** The dot ring's holder turns with ease-in-out, as SpinThatShit's loader 04 does (the other rings turn linearly). */
const DOT_RING_SPIN = { seconds: 1, easing: 'ease-in-out' };

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
        { id: 'scaleBox', kind: 'frame', layout: 'none', managed: true, shownWhen: TWO_SCALE_RINGS },
        { id: 'squareBox', kind: 'frame', layout: 'horizontal', primaryAlign: 'center', counterAlign: 'center', managed: true, shownWhen: SQUARES },
        { id: 'squareCol1', kind: 'frame', parent: 'squareBox', layout: 'vertical', primaryAlign: 'start', counterAlign: 'center', managed: true, shownWhen: SQUARES },
        { id: 'squareCol2', kind: 'frame', parent: 'squareBox', layout: 'vertical', primaryAlign: 'start', counterAlign: 'center', managed: true, shownWhen: SQUARES },
        { id: 'slideBox', kind: 'frame', layout: 'horizontal', primaryAlign: 'center', counterAlign: 'center', managed: true, shownWhen: SLIDE },
        { id: 'orbitBox', kind: 'frame', layout: 'none', managed: true, shownWhen: ORBIT },
        { id: 'hopBox', kind: 'frame', layout: 'horizontal', primaryAlign: 'center', counterAlign: 'center', managed: true, shownWhen: BARS },
        { id: 'bounceBox', kind: 'frame', layout: 'horizontal', primaryAlign: 'center', counterAlign: 'center', managed: true, shownWhen: { any: [BOUNCE, BOUNCE_ALT] } },
        { id: 'dotRingBox', kind: 'frame', layout: 'none', managed: true, shownWhen: DOT_RING, spin: DOT_RING_SPIN },
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
            options: ['dots', 'arc', 'ring', 'ringTwo', 'ringDot', 'ringGap', 'ringScale', 'ringScaleTwo', 'squares', 'dotSlide', 'orbit', 'bars', 'bounce', 'bounceAlt'],
            labels: { dots: 'Dots', arc: 'Arc', ring: 'Ring', ringTwo: 'Two arcs', ringDot: 'Dot ring', ringGap: 'Gap ring', ringScale: 'Scale ring', ringScaleTwo: 'Two scale rings', squares: 'Squares', dotSlide: 'Dot slide', orbit: 'Eight dots', bars: 'Bars', bounce: 'Bounce', bounceAlt: 'Bounce (alternate)' },
        },
    },
    tokens: {
        fromColor: ['fg', 'ring-track'],
        fromSize: ['iconSize', 'boxSize', 'dotSize', 'ringDot', 'dotGap', 'radiusFull', 'barGap', 'barHeight'],
    },
    tokenKinds: { fg: 'color', 'ring-track': 'color', iconSize: 'length', boxSize: 'length', dotSize: 'length', dotGap: 'length', ringDot: 'length', radiusFull: 'length', barGap: 'length', barHeight: 'length' },
    tokenRoles: {
        fg: presetRoleMap('text'),
        'ring-track': presetRoleMap('border'),
        iconSize: roleLadder(['icon-xs', 'icon-sm', 'icon-md', 'icon-lg', 'icon-xl']),
        // antd: the holder is 14 (small), 20 (default), 32 (large); each dot is (holder - 2) / 2 across: 6, 9, 15.
        boxSize: roleLadder(['space-12', 'space-14', 'space-20', 'space-28', 'space-32']),
        dotSize: roleLadder(['space-5', 'space-6', 'space-9', 'space-12', 'space-15']),
        dotGap: 'space-2',
        // The dot of the dot ring is about a fifth of the holder: 2, 3, 4, 5, 6 across the five Sizes (every Size its own value).
        ringDot: roleLadder(['space-2', 'space-3', 'space-4', 'space-5', 'space-6']),
        // Loader 09 proportions, of its 56 px box: the gap of the bars is 12 px (2.6, 3, 4.3, 6, 6.9 across the Sizes; no 7 role, so xl takes 6).
        barGap: roleLadder(['space-3', 'space-3', 'space-4', 'space-6', 'space-6']),
        // The bar's height is 20 px of 56 (4.3, 5, 7.1, 10, 11.4 across the Sizes).
        barHeight: roleLadder(['space-4', 'space-5', 'space-8', 'space-10', 'space-12']),
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
        // The track's inner radius is 93% of its outer one: a thin ring of about 3.5% of the box, as SpinThatShit's loader 04 (a 2 px border on 56 px).
        ring('dotRingTrack', 'ring-track', 0, 100, DOT_RING, { parent: 'dotRingBox', ratio: 93, fill: true }),
        // Gap ring: a ring with an open quarter, turning in the holder.
        ring('gapRing', 'fg', 0, 75, GAP_RING, { parent: 'ringBox' }),
        // The dot of the dot ring: a circle at the top of its cap.
        // The dot is centred on the track's middle (out of the holder's flow), so it sits on the ring at every Size. It is drawn after the track.
        { id: 'dotHead', kind: 'frame', parent: 'dotRingBox', shownWhen: DOT_RING, lift: { ring: 93 } },
        // Scale ring: a full ring that grows and fades.
        ring('scaleRing', 'fg', 0, 100, SCALE_RING, { scale: { delayMs: 0 } }),
        // Two scale rings (SpinThatShit loader 06): a track ring and a solid ring, the solid one half a turn of the 1s cycle behind. Both in one holder.
        // The track is drawn at the box size, not the loader's 1.2x (the pulse is the same).
        ring('scaleTrackRing', 'ring-track', 0, 100, TWO_SCALE_RINGS, { parent: 'scaleBox', scale: { delayMs: 0 } }),
        ring('scaleSolidRing', 'fg', 0, 100, TWO_SCALE_RINGS, { parent: 'scaleBox', scale: { delayMs: 500 } }),
        // Squares (SpinThatShit loader 08): four squares in the holder's two columns, lit in turn clockwise from the top left (a quarter cycle each).
        { id: 'square1', kind: 'frame', parent: 'squareCol1', shownWhen: SQUARES, loop: { seconds: 1, easing: 'ease', delayMs: 0, frames: lit(0) } },
        { id: 'square2', kind: 'frame', parent: 'squareCol1', shownWhen: SQUARES, loop: { seconds: 1, easing: 'ease', delayMs: 750, frames: lit(0) } },
        { id: 'square3', kind: 'frame', parent: 'squareCol2', shownWhen: SQUARES, loop: { seconds: 1, easing: 'ease', delayMs: 250, frames: lit(0) } },
        { id: 'square4', kind: 'frame', parent: 'squareCol2', shownWhen: SQUARES, loop: { seconds: 1, easing: 'ease', delayMs: 500, frames: lit(0) } },
        // Dot slide (SpinThatShit loader 12): five dots in a row, the lit one moves along and back (alternate).
        ...[0, 1, 2, 3, 4].map(k => ({ id: `slide${k + 1}`, kind: 'frame', parent: 'slideBox', shownWhen: SLIDE, loop: { seconds: 1, easing: 'linear', delayMs: 0, alternate: true, frames: lit(25 * k) } })),
        // Eight dots (loader 07): on a circle, clockwise from the top, each lit in turn.
        ...[0, 1, 2, 3, 4, 5, 6, 7].map(k => ({ id: `orbit${k + 1}`, kind: 'frame', parent: 'orbitBox', shownWhen: ORBIT, lift: { orbit: { angle: 45 * k, radius: ORBIT_RADIUS } }, loop: { seconds: 1, easing: 'linear', delayMs: 0, frames: orbitFrames(k) } })),
        // Three bars (loader 09): the box-shadow copies stretch each bar up and down. Delays: left 0.2 s, middle 0.4 s, right 0.6 s (ease-in-out).
        { id: 'bar1', kind: 'frame', parent: 'hopBox', shownWhen: BARS, loop: { seconds: 1, easing: 'ease-in-out', delayMs: 200, frames: STRETCH_FRAMES } },
        { id: 'bar2', kind: 'frame', parent: 'hopBox', shownWhen: BARS, loop: { seconds: 1, easing: 'ease-in-out', delayMs: 400, frames: STRETCH_FRAMES } },
        { id: 'bar3', kind: 'frame', parent: 'hopBox', shownWhen: BARS, loop: { seconds: 1, easing: 'ease-in-out', delayMs: 600, frames: STRETCH_FRAMES } },
        // Three dots (loader 10): each grows from a point to its full size and back. Delays: left 0.2 s, middle 0.4 s, right 0.6 s (ease, alternate).
        { id: 'bounce1', kind: 'frame', parent: 'bounceBox', shownWhen: BOUNCE, loop: { seconds: 1, easing: 'ease', delayMs: 200, alternate: true, frames: GROW_FRAMES } },
        { id: 'bounce2', kind: 'frame', parent: 'bounceBox', shownWhen: BOUNCE, loop: { seconds: 1, easing: 'ease', delayMs: 400, alternate: true, frames: GROW_FRAMES } },
        { id: 'bounce3', kind: 'frame', parent: 'bounceBox', shownWhen: BOUNCE, loop: { seconds: 1, easing: 'ease', delayMs: 600, alternate: true, frames: GROW_FRAMES } },
        // Three dots hop up (loader 11): one box up and back. Delays: left 0.6 s, middle 0.4 s, right 0.2 s (ease-in-out, alternate).
        { id: 'bounceAlt1', kind: 'frame', parent: 'bounceBox', shownWhen: BOUNCE_ALT, loop: { seconds: 1, easing: 'ease-in-out', delayMs: 600, alternate: true, travel: 'boxSize', frames: HOP_UP_FRAMES } },
        { id: 'bounceAlt2', kind: 'frame', parent: 'bounceBox', shownWhen: BOUNCE_ALT, loop: { seconds: 1, easing: 'ease-in-out', delayMs: 400, alternate: true, travel: 'boxSize', frames: HOP_UP_FRAMES } },
        { id: 'bounceAlt3', kind: 'frame', parent: 'bounceBox', shownWhen: BOUNCE_ALT, loop: { seconds: 1, easing: 'ease-in-out', delayMs: 200, alternate: true, travel: 'boxSize', frames: HOP_UP_FRAMES } },
    ],
    playOnly: [
        { id: 'spin', reason: 'the arcs and the holders turn, the dots pulse, the scale rings grow and the squares and slide dots light in turn: animations, so the canvas and the export draw the indicator at rest' },
    ],
    display: {
        dotBox: { size: 'boxSize', gap: 'dotGap' },
        dotCol1: { gap: 'dotGap' },
        dotCol2: { gap: 'dotGap' },
        ringBox: { size: 'boxSize' },
        dotRingBox: { size: 'boxSize' },
        spinner: { stroke: 'fg', size: 'boxSize' },
        ringTrack: { stroke: 'ring-track', size: 'boxSize' },
        ringHead: { stroke: 'fg', size: 'boxSize' },
        ringTop: { stroke: 'fg', size: 'boxSize' },
        ringBottom: { stroke: 'fg', size: 'boxSize' },
        dotRingTrack: { fill: 'ring-track', size: 'boxSize' },
        gapRing: { stroke: 'fg', size: 'boxSize' },
        scaleRing: { stroke: 'fg', size: 'boxSize' },
        scaleBox: { size: 'boxSize' },
        squareBox: { size: 'boxSize', gap: 'dotGap' },
        squareCol1: { gap: 'dotGap' },
        squareCol2: { gap: 'dotGap' },
        square1: { fill: 'fg', size: 'dotSize' },
        square2: { fill: 'fg', size: 'dotSize' },
        square3: { fill: 'fg', size: 'dotSize' },
        square4: { fill: 'fg', size: 'dotSize' },
        slideBox: { gap: 'dotGap' },
        slide1: { fill: 'fg', radius: 'radiusFull', size: 'dotSize' },
        slide2: { fill: 'fg', radius: 'radiusFull', size: 'dotSize' },
        slide3: { fill: 'fg', radius: 'radiusFull', size: 'dotSize' },
        slide4: { fill: 'fg', radius: 'radiusFull', size: 'dotSize' },
        slide5: { fill: 'fg', radius: 'radiusFull', size: 'dotSize' },
        orbitBox: { size: 'boxSize' },
        hopBox: { gap: 'barGap' },
        bounceBox: { gap: 'barGap' },
        orbit1: { fill: 'fg', radius: 'radiusFull', size: 'ringDot' },
        orbit2: { fill: 'fg', radius: 'radiusFull', size: 'ringDot' },
        orbit3: { fill: 'fg', radius: 'radiusFull', size: 'ringDot' },
        orbit4: { fill: 'fg', radius: 'radiusFull', size: 'ringDot' },
        orbit5: { fill: 'fg', radius: 'radiusFull', size: 'ringDot' },
        orbit6: { fill: 'fg', radius: 'radiusFull', size: 'ringDot' },
        orbit7: { fill: 'fg', radius: 'radiusFull', size: 'ringDot' },
        orbit8: { fill: 'fg', radius: 'radiusFull', size: 'ringDot' },
        bar1: { fill: 'fg', width: 'boxSize', height: 'barHeight' },
        bar2: { fill: 'fg', width: 'boxSize', height: 'barHeight' },
        bar3: { fill: 'fg', width: 'boxSize', height: 'barHeight' },
        bounce1: { fill: 'fg', radius: 'radiusFull', size: 'boxSize' },
        bounce2: { fill: 'fg', radius: 'radiusFull', size: 'boxSize' },
        bounce3: { fill: 'fg', radius: 'radiusFull', size: 'boxSize' },
        bounceAlt1: { fill: 'fg', radius: 'radiusFull', size: 'boxSize' },
        bounceAlt2: { fill: 'fg', radius: 'radiusFull', size: 'boxSize' },
        bounceAlt3: { fill: 'fg', radius: 'radiusFull', size: 'boxSize' },
        scaleTrackRing: { stroke: 'ring-track', size: 'boxSize' },
        scaleSolidRing: { stroke: 'fg', size: 'boxSize' },
        dotHead: { fill: 'fg', radius: 'radiusFull', size: 'ringDot' },
        dot1: { fill: 'fg', radius: 'radiusFull', size: 'dotSize' },
        dot2: { fill: 'fg', radius: 'radiusFull', size: 'dotSize' },
        dot3: { fill: 'fg', radius: 'radiusFull', size: 'dotSize' },
        dot4: { fill: 'fg', radius: 'radiusFull', size: 'dotSize' },
    },
    events: [],
};
