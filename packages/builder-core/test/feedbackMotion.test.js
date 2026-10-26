// Show feedback motion: defaults and normalization, direction by placement, keyframes, reduced motion, and the lifecycle
// (enter, Hide-after timer that starts after enter, hover pause, close during enter, stacking deltas).
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFeedbackMotion, feedbackKeyframes, feedbackAxis, resolveFeedbackMotion, flipDeltas, createFeedbackLifecycle, FEEDBACK_MOTION_DEFAULTS, normalizeStateAction, resolveFeedback } from '../src/index.js';

/** A fake clock and scheduler: timers fire only when advance() passes their time; enter and exit finish when the test says so. */
function harness() {
    let t = 0, id = 0;
    const timers = new Map();
    const log = [];
    const enter = { done: null, cancelled: false };
    const exit = { done: null };
    const ops = {
        now: () => t,
        schedule: (fn, ms) => { const h = ++id; timers.set(h, { at: t + ms, fn }); return h; },
        cancel: h => { timers.delete(h); },
        playEnter: done => { enter.done = done; return () => { enter.cancelled = true; }; },
        playExit: done => { exit.done = done; log.push('exit'); },
        remove: () => log.push('removed'),
    };
    const advance = ms => {
        const end = t + ms;
        for (;;) {
            const next = [...timers.entries()].filter(([, v]) => v.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
            if (!next) break;
            t = next[1].at;
            timers.delete(next[0]);
            next[1].fn();
        }
        t = end;
    };
    return { ops, advance, enter, exit, log, timers, get t() { return t; } };
}

test('defaults per kind match the spec', () => {
    assert.equal(FEEDBACK_MOTION_DEFAULTS.message.effect, 'slide-fade');
    assert.equal(FEEDBACK_MOTION_DEFAULTS.alert.duration, 200);
    assert.equal(FEEDBACK_MOTION_DEFAULTS.notification.effect, 'slide');
    assert.equal(FEEDBACK_MOTION_DEFAULTS.notification.duration, 250);
    assert.equal(FEEDBACK_MOTION_DEFAULTS.modal.effect, 'scale');
    assert.equal(FEEDBACK_MOTION_DEFAULTS.drawer.duration, 250);
    assert.equal(FEEDBACK_MOTION_DEFAULTS.popconfirm.effect, 'scale');
    assert.equal(FEEDBACK_MOTION_DEFAULTS.message.hoverPause, true);
    assert.equal(FEEDBACK_MOTION_DEFAULTS.notification.hoverPause, true);
    assert.equal(FEEDBACK_MOTION_DEFAULTS.modal.hoverPause, false);
});

test('a file without motion gets the kind defaults; exit follows enter; distance defaults to 16', () => {
    const m = normalizeFeedbackMotion(undefined, 'drawer');
    assert.equal(m.enter.effect, 'slide');
    assert.equal(m.enter.duration, 250);
    assert.equal(m.exit.effect, 'slide', 'exit defaults to the enter effect (played in reverse)');
    assert.equal(m.distance, 16);
    assert.equal(m.source, 'midas');
    assert.deepEqual(m.backdrop, { opacity: 0.45, color: '#0f172a' });
});

test('bad values fall back, numbers are clamped, the backdrop colour must be hex', () => {
    const m = normalizeFeedbackMotion({ enter: { effect: 'spin', duration: 99999, delay: -5, easing: 'bounce' }, distance: 'x', source: 'other', backdrop: { opacity: 3, color: 'red' } }, 'alert');
    assert.equal(m.enter.effect, 'slide-fade');
    assert.equal(m.enter.duration, 2000);
    assert.equal(m.enter.delay, 0);
    assert.equal(m.enter.easing, 'standard');
    assert.equal(m.distance, 16);
    assert.equal(m.source, 'midas');
    assert.equal(m.backdrop.opacity, 1);
    assert.equal(m.backdrop.color, '#0f172a');
});

test('direction follows the placement: top down, bottom up, edges, centre scales', () => {
    assert.deepEqual(feedbackAxis('top'), { axis: 'y', sign: -1 });
    assert.deepEqual(feedbackAxis('bottom'), { axis: 'y', sign: 1 });
    assert.deepEqual(feedbackAxis('top-right'), { axis: 'x', sign: 1 });
    assert.deepEqual(feedbackAxis('right'), { axis: 'x', sign: 1 });
    assert.deepEqual(feedbackAxis('left'), { axis: 'x', sign: -1 });
    assert.equal(feedbackAxis('center'), null);
});

test('enter keyframes start hidden at the edge; exit runs the same path back', () => {
    const enter = feedbackKeyframes('slide-fade', 'enter', { placement: 'top', distance: 16 });
    assert.deepEqual(enter[0], { opacity: 0, transform: 'translateY(-16px)' });
    assert.deepEqual(enter[1], { opacity: 1, transform: 'none' });
    const exit = feedbackKeyframes('slide-fade', 'exit', { placement: 'top', distance: 16 });
    assert.deepEqual(exit[0], enter[1]);
    assert.deepEqual(exit[1], enter[0]);
    assert.deepEqual(feedbackKeyframes('slide', 'enter', { placement: 'bottom' })[0], { opacity: 1, transform: 'translateY(16px)' });
});

test('a centred card keeps its own translate while it scales; none plays nothing', () => {
    const k = feedbackKeyframes('scale', 'enter', { placement: 'center', base: 'translate(-50%,-50%)' });
    assert.equal(k[0].transform, 'translate(-50%,-50%) scale(.96)');
    assert.equal(k[1].transform, 'translate(-50%,-50%) scale(1)');
    assert.deepEqual(feedbackKeyframes('none', 'enter'), []);
});

test('resolveFeedbackMotion: easing CSS, skip rules, source none and component', () => {
    const r = resolveFeedbackMotion({ enter: { effect: 'fade', duration: 200, easing: 'spring' } }, { kind: 'alert' });
    assert.equal(r.enter.easingCss, 'cubic-bezier(0.34, 1.4, 0.64, 1)');
    assert.equal(r.enter.skip, false);
    assert.equal(resolveFeedbackMotion({ enter: { effect: 'none' } }, { kind: 'alert' }).enter.skip, true);
    assert.equal(resolveFeedbackMotion({ source: 'none' }, { kind: 'alert' }).enter.skip, true);
    assert.equal(resolveFeedbackMotion({ source: 'component' }, { kind: 'modal' }).enter.skip, true, 'the component draws its own motion');
});

test('reduced motion: spatial effects become a short fade, none stays none', () => {
    const r = resolveFeedbackMotion({ enter: { effect: 'slide', duration: 400 }, exit: { effect: 'scale', duration: 400 } }, { kind: 'drawer', placement: 'right', reduced: true });
    assert.equal(r.reduced, true);
    assert.equal(r.enter.effect, 'fade');
    assert.equal(r.enter.duration, 120);
    assert.equal(r.exit.effect, 'fade');
    assert.deepEqual(r.enter.keyframes, [{ opacity: 0 }, { opacity: 1 }]);
    assert.equal(resolveFeedbackMotion({ enter: { effect: 'none' } }, { kind: 'alert', reduced: true }).enter.effect, 'none');
});

test('lifecycle: the Hide-after timer starts only after enter finishes, then exit, then removal', () => {
    const h = harness();
    const life = createFeedbackLifecycle({ autoMs: 1000, hoverPause: false, ops: h.ops });
    life.start();
    assert.equal(life.state(), 'entering');
    h.advance(500);
    assert.equal(h.timers.size, 0, 'no timer while entering');
    h.enter.done();
    assert.equal(life.state(), 'shown');
    h.advance(999);
    assert.equal(life.state(), 'shown');
    h.advance(1);
    assert.equal(life.state(), 'exiting');
    assert.deepEqual(h.log, ['exit']);
    h.exit.done();
    assert.equal(life.state(), 'done');
    assert.deepEqual(h.log, ['exit', 'removed']);
});

test('hover pauses the timer and keeps the time left; leaving resumes it', () => {
    const h = harness();
    const life = createFeedbackLifecycle({ autoMs: 1000, hoverPause: true, ops: h.ops });
    life.start();
    h.enter.done();
    h.advance(300);
    life.hoverIn();
    h.advance(5000);
    assert.equal(life.state(), 'shown', 'paused while hovered');
    life.hoverOut();
    h.advance(699);
    assert.equal(life.state(), 'shown');
    h.advance(1);
    assert.equal(life.state(), 'exiting');
});

test('hover does nothing when the kind has no hover pause', () => {
    const h = harness();
    const life = createFeedbackLifecycle({ autoMs: 500, hoverPause: false, ops: h.ops });
    life.start();
    h.enter.done();
    life.hoverIn();
    h.advance(500);
    assert.equal(life.state(), 'exiting');
});

test('close during enter cancels the enter, runs the exit once, and leaves no timer behind', () => {
    const h = harness();
    const life = createFeedbackLifecycle({ autoMs: 1000, hoverPause: false, ops: h.ops });
    life.start();
    h.advance(100);
    life.close();
    assert.equal(h.enter.cancelled, true);
    assert.deepEqual(h.log, ['exit']);
    life.close();
    assert.deepEqual(h.log, ['exit'], 'a second close does nothing');
    h.exit.done();
    assert.deepEqual(h.log, ['exit', 'removed']);
    assert.equal(h.timers.size, 0, 'no orphan timer');
    h.enter.done?.();
    assert.equal(life.state(), 'done', 'a late enter callback cannot revive it');
});

test('close by the user before the timer fires removes the timer', () => {
    const h = harness();
    const life = createFeedbackLifecycle({ autoMs: 1000, hoverPause: false, ops: h.ops });
    life.start();
    h.enter.done();
    life.close();
    assert.equal(h.timers.size, 0);
    h.exit.done();
    assert.deepEqual(h.log, ['exit', 'removed']);
});

test('two feedbacks run their own clocks and their own exits', () => {
    const a = harness(), b = harness();
    const la = createFeedbackLifecycle({ autoMs: 1000, ops: a.ops });
    const lb = createFeedbackLifecycle({ autoMs: 3000, ops: b.ops });
    la.start(); lb.start();
    a.enter.done(); b.enter.done();
    a.advance(1000);
    assert.equal(la.state(), 'exiting');
    assert.equal(lb.state(), 'shown');
    b.advance(2000);
    assert.equal(lb.state(), 'shown');
    b.advance(1000);
    assert.equal(lb.state(), 'exiting');
});

test('stacking: cards that move get an offset back to their old place; new and unchanged cards get none', () => {
    const prev = new Map([['a', 16], ['b', 80]]);
    const next = new Map([['a', 16], ['b', 56], ['c', 96]]);
    assert.deepEqual(flipDeltas(prev, next), { b: 24 });
    assert.deepEqual(flipDeltas(new Map([['a', 10]]), new Map([['a', 10.2]])), {}, 'sub-pixel moves are not animated');
});

test('actions keep the motion through normalize and resolve, and an old action still gets defaults', () => {
    const a = { type: 'show-feedback', kind: 'drawer', message: 'Hi', motion: { enter: { effect: 'fade', duration: 150 }, hoverPause: true } };
    const out = normalizeStateAction('show-feedback', a, x => x);
    assert.equal(out.motion.enter.effect, 'fade');
    assert.equal(out.motion.enter.duration, 150);
    assert.equal(out.motion.hoverPause, true);
    const ev = { interpolate: s => s };
    assert.equal(resolveFeedback(out, ev).motion.enter.effect, 'fade');
    const old = { type: 'show-feedback', kind: 'modal', message: 'Old' };
    assert.equal(resolveFeedback(old, ev).motion.enter.effect, 'scale');
});
