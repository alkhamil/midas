// Spin's ring types, from SpinThatShit: each type draws its own parts, nothing is left for the others, and the ring holder turns as one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { generateComponent, componentNameOf, spinAnimation, loopAnimation, loopKeyframes } from '../src/behavior-engine/codegen.js';
import { ringMiddleOffset, orbitCentre } from '../src/behavior-engine/template-master.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const spin = TEMPLATES.get('antd-spin');
const model = modelFor(spin);
const keysOf = props => instanceFor(model, props).slice(1).map(n => n.behavior?.part ?? n.behavior?.slot ?? n.name);
const RING_PARTS = ['ringTrack', 'ringHead', 'ringTop', 'ringBottom', 'dotRingTrack', 'dotHead', 'gapRing', 'scaleRing', 'scaleTrackRing', 'scaleSolidRing'];

test('each ring type draws only its own parts', () => {
    assert.deepEqual(keysOf({ type: 'ring' }).filter(k => RING_PARTS.includes(k)), ['ringTrack', 'ringHead']);
    assert.deepEqual(keysOf({ type: 'ringTwo' }).filter(k => RING_PARTS.includes(k)), ['ringTop', 'ringBottom']);
    assert.deepEqual(keysOf({ type: 'ringDot' }).filter(k => RING_PARTS.includes(k)), ['dotRingTrack', 'dotHead']);
    assert.deepEqual(keysOf({ type: 'ringGap' }).filter(k => RING_PARTS.includes(k)), ['gapRing']);
    assert.deepEqual(keysOf({ type: 'ringScale' }).filter(k => RING_PARTS.includes(k)), ['scaleRing']);
    assert.deepEqual(keysOf({ type: 'ringScale' }).filter(k => /^dot\d$/.test(k)), [], 'no dots with the scale ring');
    assert.deepEqual(keysOf({ type: 'ringScaleTwo' }).filter(k => RING_PARTS.includes(k)), ['scaleTrackRing', 'scaleSolidRing']);
});

test('two scale rings: a holder with both rings, the solid one half a cycle behind the track (loader 06: 1s, 500 ms)', () => {
    assert.ok(keysOf({ type: 'ringScaleTwo' }).includes('scaleBox'));
    assert.ok(!keysOf({ type: 'ringScale' }).includes('scaleBox'), 'the single scale ring has no holder');
    assert.deepEqual(spin.parts.filter(p => p.id.startsWith('scale') && p.scale).map(p => [p.id, p.scale.delayMs]), [['scaleRing', 0], ['scaleTrackRing', 0], ['scaleSolidRing', 500]]);
});

test('the ring holder holds the parts that turn together, and only for the holder types', () => {
    assert.ok(keysOf({ type: 'ringTwo' }).includes('ringBox'));
    assert.ok(keysOf({ type: 'ringGap' }).includes('ringBox'));
    assert.ok(keysOf({ type: 'ring' }).includes('ringBox'), 'the ring stacks its track and head in the holder, which turns');
    assert.ok(!keysOf({ type: 'ringDot' }).includes('ringBox'), 'the dot ring has its own holder');
    assert.ok(!keysOf({ type: 'ringScale' }).includes('ringBox'));
    assert.deepEqual(spin.anatomy.find(s => s.id === 'ringBox').spin, { seconds: 1 });
});

test('the dot ring turns in its own holder with ease-in-out, as SpinThatShit loader 04 (the others are linear)', () => {
    assert.deepEqual(keysOf({ type: 'ringDot' }).filter(k => k === 'dotRingBox'), ['dotRingBox']);
    assert.deepEqual(keysOf({ type: 'ring' }).filter(k => k === 'dotRingBox'), []);
    assert.deepEqual(spin.anatomy.find(s => s.id === 'dotRingBox').spin, { seconds: 1, easing: 'ease-in-out' });
    assert.deepEqual(spin.parts.filter(p => p.id === 'dotRingTrack' || p.id === 'dotHead').map(p => p.parent), ['dotRingBox', 'dotRingBox']);
    assert.equal(spinAnimation({ seconds: 1, easing: 'ease-in-out' }), 'midas-spin 1s ease-in-out infinite');
    assert.equal(spinAnimation({ seconds: 1.2 }), 'midas-spin 1.2s linear infinite');
});

test('nothing of a ring is drawn while spinning is off', () => {
    for (const type of ['ring', 'ringTwo', 'ringDot', 'ringGap', 'ringScale', 'ringScaleTwo']) assert.deepEqual(keysOf({ spinning: false, type }), [], type);
});

test('squares: four squares in a holder, lit in turn clockwise from the top left (loader 08: a quarter cycle each)', () => {
    assert.deepEqual(keysOf({ type: 'squares' }).filter(k => /^square\d$/.test(k)), ['square1', 'square2', 'square3', 'square4']);
    assert.ok(keysOf({ type: 'squares' }).includes('squareBox'));
    assert.ok(!keysOf({ type: 'dots' }).includes('squareBox'));
    const delays = Object.fromEntries(spin.parts.filter(p => p.id.startsWith('square')).map(p => [p.id, p.loop.delayMs]));
    // Top left (square1), top right (square3), bottom right (square4), bottom left (square2).
    assert.deepEqual(delays, { square1: 0, square3: 250, square4: 500, square2: 750 });
});

test('dot slide: five dots in a row, the lit one moves along and back (loader 12)', () => {
    assert.deepEqual(keysOf({ type: 'dotSlide' }).filter(k => /^slide\d$/.test(k)), ['slide1', 'slide2', 'slide3', 'slide4', 'slide5']);
    const lit = id => spin.parts.find(p => p.id === id).loop.frames.find(f => f.props.opacity === 1).at;
    assert.deepEqual([1, 2, 3, 4, 5].map(k => lit(`slide${k}`)), [0, 25, 50, 75, 100]);
    assert.equal(spin.parts.find(p => p.id === 'slide1').loop.alternate, true);
});

test('eight dots on a circle, clockwise from the top, each lit in turn (loader 07)', () => {
    assert.deepEqual(keysOf({ type: 'orbit' }).filter(k => /^orbit\d$/.test(k)), ['orbit1', 'orbit2', 'orbit3', 'orbit4', 'orbit5', 'orbit6', 'orbit7', 'orbit8']);
    // The brightest colour (1) starts at the top left dot (orbit8); one step later it is the top dot: the brightness moves clockwise.
    const opacityAt = (id, at) => spin.parts.find(p => p.id === id).loop.frames.find(f => f.at === at).props.opacity;
    assert.equal(opacityAt('orbit8', 0), 1);
    assert.equal(opacityAt('orbit1', 12.5), 1, 'the top dot is lit one step after the top left one');
    assert.equal(opacityAt('orbit2', 0), 0.1);
    assert.equal(opacityAt('orbit2', 100), 0.1, 'the stop at 100 is the stop at 0');
});

test('the circle places each dot by its angle, as a fraction of the holder (a lift with an orbit)', () => {
    const top = orbitCentre({ angle: 0, radius: 0.7 }), right = orbitCentre({ angle: 90, radius: 0.7 });
    assert.ok(Math.abs(top.x - 0.5) < 1e-9 && Math.abs(top.y - (0.5 - 0.35)) < 1e-9, 'the top dot is above the centre');
    assert.ok(Math.abs(right.x - (0.5 + 0.35)) < 1e-9 && Math.abs(right.y - 0.5) < 1e-9, 'the right dot is right of the centre');
});

test('the hop keyframe is valid CSS: a unary minus is not allowed in front of var() (calc(-var(x)) is dropped, so nothing moved)', () => {
    const files = generateComponent(spin, model.binding, model.variables, componentNameOf(spin), model.frame, () => []).files;
    const css = String(Object.values(files).find(t => /@keyframes midas-loop-antd-spin-bounceAlt1/.test(String(t))));
    assert.ok(css, 'the stylesheet holds the loader 11 keyframes');
    assert.match(css, /translateY\(calc\(var\(--antd-spin-box-size\) \* -1\)\)/);
    assert.doesNotMatch(css, /calc\(-var/);
});

test('a loop part animates its own opacity keys, named by template and part, with its delay and direction', () => {
    assert.equal(loopAnimation('antd-spin', 'slide1', { seconds: 1, easing: 'linear', delayMs: 0, alternate: true, frames: [] }), 'midas-loop-antd-spin-slide1 1s linear 0ms infinite alternate');
    assert.equal(loopKeyframes('antd-spin', 'square2'), 'midas-loop-antd-spin-square2');
    const files = generateComponent(spin, model.binding, model.variables, componentNameOf(spin), model.frame, () => []).files;
    assert.match(files['Spin.jsx'], /className="antd-spin-square1"/);
});

test('the scale ring grows and fades in Play, and the export draws the ring at rest', () => {
    assert.deepEqual(spin.parts.find(p => p.id === 'scaleRing').scale, { delayMs: 0 });
    const files = generateComponent(spin, model.binding, model.variables, componentNameOf(spin), model.frame, () => []).files;
    assert.match(files['Spin.jsx'], /className="antd-spin-scaleRing"/);
    assert.match(files['Spin.jsx'], /className="antd-spin-ringBox"/);
});

test('the dot is centred on the track: its middle is at the track\'s middle at every Size', () => {
    assert.equal(spin.parts.find(p => p.id === 'dotHead').lift.ring, spin.parts.find(p => p.id === 'dotRingTrack').arc.ratio);
    for (const box of [12, 14, 20, 28, 32]) {
        const trackMiddle = (1 - 0.93) * box / 2 / 2;
        assert.ok(Math.abs(ringMiddleOffset(93, box) - trackMiddle) < 1e-9, `box ${box}`);
    }
});

test('loader 09 bars: three bars stretched by the shadow copies (44 of 20), delays 0.2, 0.4, 0.6 s; width is the box, height the bar height', () => {
    const part = id => spin.parts.find(p => p.id === id);
    assert.deepEqual(['bar1', 'bar2', 'bar3'].map(id => part(id).loop.delayMs), [200, 400, 600]);
    assert.equal(part('bar1').loop.frames.find(f => f.at === 50).props.transform, 'scaleY(2.2)');
    assert.deepEqual(spin.display.bar1, { fill: 'fg', width: 'boxSize', height: 'barHeight' });
    for (const token of ['barGap', 'barHeight']) assert.ok(spin.tokens.fromSize.includes(token) && spin.tokenRoles[token], token);
});

test('loader 10 dots grow from a point to their full size (scale), delays 0.2, 0.4, 0.6 s, alternate', () => {
    const part = id => spin.parts.find(p => p.id === id);
    assert.deepEqual(['bounce1', 'bounce2', 'bounce3'].map(id => part(id).loop.delayMs), [200, 400, 600]);
    assert.deepEqual(part('bounce1').loop.frames.map(f => f.props.transform), ['scale(0)', 'scale(1)']);
    assert.equal(part('bounce1').loop.alternate, true);
    assert.equal(spin.display.bounce1.size, 'boxSize');
});

test('loader 11 dots hop one box up and back, delays 0.6, 0.4, 0.2 s, ease-in-out alternate', () => {
    const part = id => spin.parts.find(p => p.id === id);
    assert.deepEqual(['bounceAlt1', 'bounceAlt2', 'bounceAlt3'].map(id => part(id).loop.delayMs), [600, 400, 200]);
    assert.equal(part('bounceAlt1').loop.travel, 'boxSize', 'one box');
    assert.equal(part('bounceAlt1').loop.easing, 'ease-in-out');
    assert.equal(part('bounceAlt1').loop.alternate, true);
});
