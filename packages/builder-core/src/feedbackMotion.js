// Enter and exit motion of Show feedback. Pure: no DOM, no timers. Preview plays the keyframes this file returns and drives the
// lifecycle through the injected ops of createFeedbackLifecycle; the same easing presets as Interactions (MOTION_EASING_MAP).
import { MOTION_EASING_MAP } from './behavior.js';

/** What an enter or exit plays. Scale fades too (the Modal default is "fade + scale"). */
export const FEEDBACK_EFFECTS = [
    { id: 'none', label: 'None' },
    { id: 'fade', label: 'Fade' },
    { id: 'slide', label: 'Slide' },
    { id: 'scale', label: 'Scale' },
    { id: 'slide-fade', label: 'Slide + fade' },
];
const EFFECT_IDS = FEEDBACK_EFFECTS.map(e => e.id);

/** Whose motion plays for the card: Midas's, the component's own (its Smart animate / Change variant), or none. */
export const FEEDBACK_SOURCES = [
    { id: 'midas', label: 'Midas animation' },
    { id: 'component', label: "Component's own" },
    { id: 'none', label: 'None' },
];

/** Per kind: the enter effect, its duration (ms), and whether hovering pauses the Hide-after timer. */
export const FEEDBACK_MOTION_DEFAULTS = {
    alert: { effect: 'slide-fade', duration: 200, hoverPause: false },
    message: { effect: 'slide-fade', duration: 200, hoverPause: true },
    notification: { effect: 'slide', duration: 250, hoverPause: true },
    modal: { effect: 'scale', duration: 200, hoverPause: false },
    drawer: { effect: 'slide', duration: 250, hoverPause: false },
    popconfirm: { effect: 'scale', duration: 200, hoverPause: false },
};
export const FEEDBACK_DISTANCE = 16;
export const FEEDBACK_BACKDROP = { opacity: 0.45, color: '#0f172a' };
/** Reduce motion (system or Preview toggle): spatial effects become a short fade. */
export const REDUCED_EFFECT = 'fade';
export const REDUCED_MAX_MS = 120;

const clampInt = (v, lo, hi, d) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d;
};
const normalizeStep = (s, d) => ({
    effect: EFFECT_IDS.includes(s?.effect) ? s.effect : d.effect,
    duration: clampInt(s?.duration, 0, 2000, d.duration),
    delay: clampInt(s?.delay, 0, 2000, d.delay),
    easing: MOTION_EASING_MAP[s?.easing] ? s.easing : d.easing,
});

/**
 * The stored motion of one Show feedback action, complete with defaults. Exit defaults to the enter effect (played in reverse);
 * a file without `motion` gets the defaults of its kind.
 */
export function normalizeFeedbackMotion(raw, kind) {
    const k = FEEDBACK_MOTION_DEFAULTS[kind] ? kind : 'alert';
    const base = FEEDBACK_MOTION_DEFAULTS[k];
    const r = raw && typeof raw === 'object' ? raw : {};
    const enter = normalizeStep(r.enter, { effect: base.effect, duration: base.duration, delay: 0, easing: 'standard' });
    const exit = normalizeStep(r.exit, { effect: enter.effect, duration: enter.duration, delay: 0, easing: enter.easing });
    const color = typeof r.backdrop?.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(r.backdrop.color) ? r.backdrop.color : FEEDBACK_BACKDROP.color;
    return {
        enter,
        exit,
        distance: clampInt(r.distance, 0, 200, FEEDBACK_DISTANCE),
        source: FEEDBACK_SOURCES.some(s => s.id === r.source) ? r.source : 'midas',
        hoverPause: typeof r.hoverPause === 'boolean' ? r.hoverPause : base.hoverPause,
        backdrop: {
            opacity: Number.isFinite(Number(r.backdrop?.opacity)) ? Math.min(1, Math.max(0, Number(r.backdrop.opacity))) : FEEDBACK_BACKDROP.opacity,
            color,
        },
    };
}

/**
 * The direction a slide comes from, by placement: top slides down (starts above), bottom slides up, left / right start at that edge.
 * Top-right (Notification) starts at the right edge. Center and other placements have no direction (slide acts as scale).
 */
export function feedbackAxis(placement) {
    const p = String(placement || '');
    if (p === 'top-right' || p === 'right') return { axis: 'x', sign: 1 };
    if (p === 'left') return { axis: 'x', sign: -1 };
    if (p.startsWith('top')) return { axis: 'y', sign: -1 };
    if (p.startsWith('bottom')) return { axis: 'y', sign: 1 };
    return null;
}

/**
 * WAAPI keyframes for one phase. `enter` runs hidden → shown; `exit` runs the same path back (shown → hidden), so a slide leaves
 * through the edge it came from. `base` is the card's own transform (a centered card keeps its translate(-50%,-50%)).
 */
export function feedbackKeyframes(effect, phase, { placement = '', distance = FEEDBACK_DISTANCE, base = '' } = {}) {
    if (!effect || effect === 'none') return [];
    const tf = t => [base, t].filter(Boolean).join(' ') || 'none';
    const ax = feedbackAxis(placement);
    const slides = effect === 'slide' || effect === 'slide-fade';
    let hidden, shown;
    if (slides && ax) {
        const off = ax.axis === 'x' ? `translateX(${ax.sign * distance}px)` : `translateY(${ax.sign * distance}px)`;
        hidden = { opacity: effect === 'slide-fade' ? 0 : 1, transform: tf(off) };
        shown = { opacity: 1, transform: tf('') };
    }
    else if (effect === 'fade') {
        hidden = { opacity: 0 };
        shown = { opacity: 1 };
    }
    else {
        // scale (and a slide with no direction): grows from 96 % while it fades in
        hidden = { opacity: 0, transform: tf('scale(.96)') };
        shown = { opacity: 1, transform: tf('scale(1)') };
    }
    return phase === 'exit' ? [shown, hidden] : [hidden, shown];
}

/**
 * What to play for one phase of a feedback, with the reduced-motion rule and the easing CSS applied.
 * `skip` means nothing is animated (effect none, duration 0, or the source is not Midas).
 */
export function resolveFeedbackMotion(raw, { kind, placement = '', reduced = false, base = '' } = {}) {
    const m = normalizeFeedbackMotion(raw, kind);
    const step = (phase, s) => {
        let effect = s.effect, duration = s.duration;
        if (reduced && effect !== 'none') {
            effect = REDUCED_EFFECT;
            duration = Math.min(duration, REDUCED_MAX_MS);
        }
        const source = m.source === 'midas';
        const skip = !source || effect === 'none' || duration === 0;
        return {
            effect: source ? effect : 'none',
            duration,
            delay: s.delay,
            easing: s.easing,
            easingCss: MOTION_EASING_MAP[s.easing].css,
            skip,
            keyframes: skip ? [] : feedbackKeyframes(effect, phase, { placement, distance: m.distance, base }),
        };
    };
    return { source: m.source, hoverPause: m.hoverPause, backdrop: m.backdrop, enter: step('enter', m.enter), exit: step('exit', m.exit), reduced: !!reduced };
}

/**
 * Stacking: the cards of a stack that move when a card is added or removed. `prev` and `next` map a card id to its top edge
 * before and after the change. Returns id → offset to animate from (old − new), only for cards that moved.
 */
export function flipDeltas(prev, next) {
    const out = {};
    for (const [id, top] of next) {
        if (!prev.has(id)) continue;
        const dy = prev.get(id) - top;
        if (Math.abs(dy) >= 0.5) out[id] = dy;
    }
    return out;
}

/**
 * The lifecycle of one feedback, without any DOM. ops (all supplied by the host):
 *   playEnter(done) → cancel()     runs the enter; calls done when it ends (synchronously when there is nothing to play)
 *   playExit(done)                 runs the exit; calls done when it ends
 *   schedule(fn, ms) → handle      one-shot timer
 *   cancel(handle)                 clears a timer
 *   now() → ms                     clock (used for the remaining time when hovering pauses the timer)
 *   remove()                       takes the feedback's nodes out of the page
 * Order: start → entering → shown (the Hide-after timer starts here) → exiting → done. close() at any point runs the exit once.
 * Hover (hoverIn / hoverOut) pauses the timer only when hoverPause is on, and keeps the time left.
 */
export function createFeedbackLifecycle({ autoMs = 0, hoverPause = false, ops }) {
    let phase = 'idle', timer = null, startedAt = 0, remaining = autoMs, hovered = false, cancelEnter = null;
    const arm = ms => {
        startedAt = ops.now();
        remaining = ms;
        timer = ops.schedule(() => { timer = null; close(); }, ms);
    };
    const disarm = () => {
        if (timer === null) return;
        ops.cancel(timer);
        timer = null;
        remaining = Math.max(0, remaining - (ops.now() - startedAt));
    };
    const finishExit = () => {
        if (phase === 'done') return;
        phase = 'done';
        disarm();
        ops.remove();
    };
    function close() {
        if (phase === 'exiting' || phase === 'done' || phase === 'idle') return;
        const wasEntering = phase === 'entering';
        phase = 'exiting';
        disarm();
        if (wasEntering && cancelEnter) cancelEnter();
        cancelEnter = null;
        ops.playExit(finishExit);
    }
    return {
        start() {
            if (phase !== 'idle') return;
            phase = 'entering';
            cancelEnter = ops.playEnter(() => {
                cancelEnter = null;
                if (phase !== 'entering') return;
                phase = 'shown';
                if (autoMs > 0 && !hovered) arm(remaining);
            });
        },
        close,
        hoverIn() {
            if (!hoverPause) return;
            hovered = true;
            if (phase === 'shown') disarm();
        },
        hoverOut() {
            if (!hoverPause) return;
            hovered = false;
            if (phase === 'shown' && autoMs > 0 && timer === null && remaining > 0) arm(remaining);
        },
        state: () => phase,
        remaining: () => remaining,
    };
}
