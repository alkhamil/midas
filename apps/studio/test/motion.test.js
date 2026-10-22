// Standar motion (tab Behavior → live preview): jenis transisi, easing, dan durasi default per aksi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRANSITIONS, MOTION_EASINGS, MOTION_EASING_MAP, MOTION_DEFAULTS, resolveMotion, normalizeAction } from '../src/engine/behavior.js';

test('the motion standard covers navigate, overlays, and state changes', () => {
    assert.deepEqual(TRANSITIONS.map(t => t.id), ['dissolve', 'fade', 'fade-scale', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'instant']);
    for (const e of MOTION_EASINGS) assert.match(e.css, /cubic-bezier|linear/, `${e.id} maps to real CSS easing`);
    assert.equal(MOTION_DEFAULTS.navigate.transition, 'dissolve');
    assert.equal(MOTION_DEFAULTS['open-overlay'].transition, 'fade-scale');
    assert.equal(MOTION_DEFAULTS['close-overlay'].transition, 'fade');
});

test('resolveMotion falls back to the standard per action kind', () => {
    assert.deepEqual(resolveMotion(null, 'navigate'), { transition: 'dissolve', duration: 220, easing: 'standard', easingCss: MOTION_EASING_MAP.standard.css });
    assert.deepEqual(resolveMotion({}, 'close-overlay'), { transition: 'fade', duration: 140, easing: 'ease-out', easingCss: MOTION_EASING_MAP['ease-out'].css });
    assert.equal(resolveMotion({}, 'no-such-kind').transition, 'dissolve');
});

test('resolveMotion keeps what the designer set and clamps the rest', () => {
    const m = resolveMotion({ transition: 'slide-left', duration: '300', easing: 'spring' }, 'navigate');
    assert.equal(m.transition, 'slide-left');
    assert.equal(m.duration, 300);
    assert.equal(m.easingCss, MOTION_EASING_MAP.spring.css);
    assert.equal(resolveMotion({ duration: -50 }, 'navigate').duration, 0);
    assert.equal(resolveMotion({ duration: 99999 }, 'navigate').duration, 2000);
    assert.equal(resolveMotion({ duration: 'soon' }, 'navigate').duration, 220);
    assert.equal(resolveMotion({ transition: 'warp', easing: 'bouncy' }, 'navigate').transition, 'dissolve');
});

test('normalizeAction keeps motion only where motion plays', () => {
    const nav = normalizeAction({ type: 'navigate', targetFrameId: 'f1', transition: 'slide-up', duration: 300, easing: 'linear' });
    assert.equal(nav.transition, 'slide-up');
    assert.equal(nav.duration, 300);
    assert.equal(nav.easing, 'linear');
    const open = normalizeAction({ type: 'open-overlay', transition: 'instant' });
    assert.equal(open.transition, 'instant');
    assert.equal(open.duration, undefined);
    const sel = normalizeAction({ type: 'set-selected', mode: 'toggle', transition: 'fade', duration: 300, easing: 'linear' });
    assert.equal(sel.transition, undefined);
    assert.equal(sel.duration, undefined);
    assert.equal(sel.easing, undefined);
    const empty = normalizeAction({ type: 'navigate', targetFrameId: 'f1', transition: '', duration: '', easing: '' });
    assert.deepEqual(empty, { type: 'navigate', targetFrameId: 'f1' });
});
