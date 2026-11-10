// Input's password kind: the eye box holds the eye-off layer (the hidden state, the only canvas layer), and the eye-on icon is prop-only for the
// revealed state. Pressing the box flips a local revealed state that swaps the eye and unmasks the text (Play and the export); no toggle prop and no
// visible-state prop exist anywhere. No eye exists for a text or text-area kind.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { createdIconDefaults, iconDefsOf } from '../src/behavior-engine/anatomy.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const input = TEMPLATES.get('input');
const model = modelFor(input);
const PW = { kind: 'password' };

/** The managed slots an instance holds under these props (the eye slots among them). */
const slotsOf = props => instanceFor(model, props).filter(n => n.behavior?.slot !== undefined).map(n => n.behavior.slot);

test('the eyes are icon slots with pickers, roles and labels, not glyphs; the revealed eye is prop-only', () => {
    const defs = iconDefsOf(input);
    const on = defs.find(d => d.slot === 'eyeOn'), off = defs.find(d => d.slot === 'eyeOff');
    assert.ok(on && off, 'both eye icon defs');
    assert.equal(on.component, 'eyeOnIcon');
    assert.equal(on.role, 'eyeOn');
    assert.equal(on.label, 'Icon eyeOn');
    assert.deepEqual(on.swap, { by: 'revealed', is: true });
    assert.equal(off.component, 'eyeOffIcon');
    assert.equal(off.role, 'eyeOff');
    assert.equal(off.label, 'Icon eyeOff');
    assert.deepEqual(off.swap, { by: 'revealed', is: false });
    assert.equal(input.props.eyeOnIcon.type, 'iconComponent');
    assert.equal(input.props.eyeOffIcon.type, 'iconComponent');
    assert.equal(input.anatomy.find(s => s.id === 'eye' && s.kind === 'glyph'), undefined, 'no eye glyph left');
    assert.equal(input.anatomy.find(s => s.id === 'eyeOff' && s.kind === 'glyph'), undefined, 'no eye-off glyph left');
    assert.equal(input.anatomy.find(s => s.id === 'eyeOn'), undefined, 'the revealed eye has no canvas slot');
    assert.equal(input.props.visibilityToggle, undefined, 'no toggle prop');
    assert.equal(input.props.passwordVisible, undefined, 'no visible-state prop');
});

test('a password shows the eye-off layer alone on the canvas, whatever the revealed eye picks', () => {
    assert.deepEqual(slotsOf(PW).filter(s => s.startsWith('eye')), ['eyeBox', 'eyeOff']);
    assert.deepEqual(slotsOf({ ...PW, eyeOnIcon: 'Icon/eye' }).filter(s => s.startsWith('eye')), ['eyeBox', 'eyeOff'], 'the revealed eye adds no layer');
});

test('no eye layer for a text or text-area kind', () => {
    for (const props of [{ kind: 'text' }, { kind: 'textarea' }]) {
        const slots = slotsOf(props);
        assert.ok(!slots.includes('eyeBox') && !slots.includes('eyeOff') && !slots.includes('eyeOn'), JSON.stringify(props));
    }
});

test('the eye-off layer exists exactly once, and the eye box holds it', () => {
    assert.equal(slotsOf(PW).filter(s => s === 'eyeOff').length, 1);
    const held = instanceFor(model, PW);
    assert.equal(held.find(n => n.behavior?.slot === 'eyeOff').parentId, held.find(n => n.behavior?.slot === 'eyeBox').id, 'the eye sits in the box');
});

test('the default eye is the role glyph, the file default when the role has none', () => {
    assert.deepEqual(createdIconDefaults(input, PW, 'DEF', { eyeOff: 'OFF', eyeOn: 'ON' }), { eyeOffIcon: 'OFF', eyeOnIcon: 'ON' });
    assert.deepEqual(createdIconDefaults(input, PW, 'DEF', {}), { eyeOffIcon: 'DEF', eyeOnIcon: 'DEF' });
});

test('the eye box is the toggle: a click flips the local revealed state in Play and the export', () => {
    const press = input.press.find(p => p.slot === 'eyeBox');
    assert.deepEqual(press, { slot: 'eyeBox', toggleState: 'revealed' });
    assert.ok(input.anatomy.find(s => s.id === 'eyeBox' && s.kind === 'frame'), 'the box is a frame slot');
});
