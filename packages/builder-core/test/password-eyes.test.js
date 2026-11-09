// Input's password kind: the eye and the eye-off are two icon slots (eyeOn, eyeOff), each with a picker and a default from the icon set's role
// (eyeOn, eyeOff). Only the slot of the visible state exists: a derived prop holds each state, and the slots sit in one box that the toggle press
// clicks (Play and the export flip passwordVisible). No eye exists for a text or text-area kind, nor when the toggle is off.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { createdIconDefaults, iconDefsOf } from '../src/behavior-engine/anatomy.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const input = TEMPLATES.get('input');
const model = modelFor(input);
const PW = { kind: 'password', visibilityToggle: true };

/** The managed slots an instance holds under these props (the eye slots among them). */
const slotsOf = props => instanceFor(model, props).filter(n => n.behavior?.slot !== undefined).map(n => n.behavior.slot);

test('the eyes are icon slots with pickers and roles, not glyphs', () => {
    const defs = iconDefsOf(input);
    const on = defs.find(d => d.slot === 'eyeOn'), off = defs.find(d => d.slot === 'eyeOff');
    assert.ok(on && off, 'both eye icon defs');
    assert.equal(on.component, 'eyeOnIcon');
    assert.equal(on.role, 'eyeOn');
    assert.equal(off.component, 'eyeOffIcon');
    assert.equal(off.role, 'eyeOff');
    assert.equal(input.props.eyeOnIcon.type, 'iconComponent');
    assert.equal(input.props.eyeOffIcon.type, 'iconComponent');
    assert.equal(input.anatomy.find(s => s.id === 'eye' && s.kind === 'glyph'), undefined, 'no eye glyph left');
    assert.equal(input.anatomy.find(s => s.id === 'eyeOff' && s.kind === 'glyph'), undefined, 'no eye-off glyph left');
});

test('a visible password shows the eye-on slot alone; a hidden one the eye-off slot alone', () => {
    const shown = slotsOf({ ...PW, passwordVisible: true });
    assert.ok(shown.includes('eyeOn') && !shown.includes('eyeOff'), `visible: ${shown}`);
    const hidden = slotsOf({ ...PW, passwordVisible: false });
    assert.ok(hidden.includes('eyeOff') && !hidden.includes('eyeOn'), `hidden: ${hidden}`);
});

test('no eye layer while the toggle is off, or for a text or text-area kind', () => {
    for (const props of [{ kind: 'password', visibilityToggle: false }, { kind: 'text' }, { kind: 'textarea' }]) {
        const slots = slotsOf(props);
        assert.ok(!slots.includes('eyeOn') && !slots.includes('eyeOff'), JSON.stringify(props));
    }
});

test('each eye layer exists exactly once while its state holds, and the eye box holds it', () => {
    const shown = slotsOf({ ...PW, passwordVisible: true });
    assert.equal(shown.filter(s => s === 'eyeOn').length, 1);
});

test('the default eye is the role glyph: eye-off for a hidden password, eye-on for a visible one, the file default when the role has none', () => {
    assert.deepEqual(createdIconDefaults(input, { ...PW, passwordVisible: false }, 'DEF', { eyeOff: 'OFF', eyeOn: 'ON' }), { eyeOffIcon: 'OFF' });
    assert.deepEqual(createdIconDefaults(input, { ...PW, passwordVisible: true }, 'DEF', { eyeOff: 'OFF', eyeOn: 'ON' }), { eyeOnIcon: 'ON' });
    assert.deepEqual(createdIconDefaults(input, { ...PW, passwordVisible: false }, 'DEF', {}), { eyeOffIcon: 'DEF' });
});

test('the eye box is the toggle: a click flips passwordVisible in Play and the export', () => {
    const press = input.press.find(p => p.toggle === 'passwordVisible');
    assert.deepEqual(press, { slot: 'eyeBox', toggle: 'passwordVisible' });
    assert.ok(input.anatomy.find(s => s.id === 'eyeBox' && s.kind === 'frame'), 'the box is a frame slot');
});
