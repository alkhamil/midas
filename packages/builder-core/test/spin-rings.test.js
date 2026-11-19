// Spin's ring types, from SpinThatShit: each type draws its own parts, nothing is left for the others, and the ring holder turns as one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { generateComponent, componentNameOf } from '../src/behavior-engine/codegen.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const spin = TEMPLATES.get('antd-spin');
const model = modelFor(spin);
const keysOf = props => instanceFor(model, props).slice(1).map(n => n.behavior?.part ?? n.behavior?.slot ?? n.name);
const RING_PARTS = ['ringTrack', 'ringHead', 'ringTop', 'ringBottom', 'dotRingTrack', 'dotHead', 'gapRing', 'scaleRing'];

test('each ring type draws only its own parts', () => {
    assert.deepEqual(keysOf({ type: 'ring' }).filter(k => RING_PARTS.includes(k)), ['ringTrack', 'ringHead']);
    assert.deepEqual(keysOf({ type: 'ringTwo' }).filter(k => RING_PARTS.includes(k)), ['ringTop', 'ringBottom']);
    assert.deepEqual(keysOf({ type: 'ringDot' }).filter(k => RING_PARTS.includes(k)), ['dotRingTrack', 'dotHead']);
    assert.deepEqual(keysOf({ type: 'ringGap' }).filter(k => RING_PARTS.includes(k)), ['gapRing']);
    assert.deepEqual(keysOf({ type: 'ringScale' }).filter(k => RING_PARTS.includes(k)), ['scaleRing']);
    assert.deepEqual(keysOf({ type: 'ringScale' }).filter(k => /^dot\d$/.test(k)), [], 'no dots with the scale ring');
});

test('the ring holder holds the parts that turn together, and only for the holder types', () => {
    assert.ok(keysOf({ type: 'ringTwo' }).includes('ringBox'));
    assert.ok(keysOf({ type: 'ringDot' }).includes('ringBox'));
    assert.ok(keysOf({ type: 'ringGap' }).includes('ringBox'));
    assert.ok(keysOf({ type: 'ring' }).includes('ringBox'), 'the ring stacks its track and head in the holder, which turns');
    assert.ok(!keysOf({ type: 'ringScale' }).includes('ringBox'));
    assert.deepEqual(spin.anatomy.find(s => s.id === 'ringBox').spin, { seconds: 1 });
});

test('nothing of a ring is drawn while spinning is off', () => {
    for (const type of ['ring', 'ringTwo', 'ringDot', 'ringGap', 'ringScale']) assert.deepEqual(keysOf({ spinning: false, type }), [], type);
});

test('the scale ring grows and fades in Play, and the export draws the ring at rest', () => {
    assert.deepEqual(spin.parts.find(p => p.id === 'scaleRing').scale, { delayMs: 0 });
    const files = generateComponent(spin, model.binding, model.variables, componentNameOf(spin), model.frame, () => []).files;
    assert.match(files['Spin.jsx'], /className="antd-spin-scaleRing"/);
    assert.match(files['Spin.jsx'], /className="antd-spin-ringBox"/);
});
