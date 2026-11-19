// Spin: a loading indicator with no text. Type picks the indicator: dots (four drawn dots in a 2 by 2 grid, antd's default) or arc (the quarter arc Button
// draws). The indicator is shown while `spinning` is on and removed when it is off; Size (xs to xl) sizes the dots and the arc; Color is the text role.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { generateComponent, componentNameOf } from '../src/behavior-engine/codegen.js';
import { modelFor, instanceFor } from './helpers/box-template.js';
import { COLOR_PRESETS } from '../src/templates/color-presets.js';
import { SIZE_MODES } from '../src/templates/size-modes.js';

const spin = TEMPLATES.get('antd-spin');
const model = modelFor(spin);

/** The layers of an instance under these props, root excluded, by their part or anatomy id. */
const keysOf = props => instanceFor(model, props).slice(1).map(n => n.behavior?.part ?? n.behavior?.slot ?? n.name);

test('Spin is registered, valid, with Color, Size, spinning and Type (dots or arc)', () => {
    assert.ok(spin, 'Spin is in the registry');
    assert.equal(spin.name, 'Spin');
    assert.deepEqual(validateTemplateSchema(spin, { templateIds: new Set(TEMPLATES.keys()) }), []);
    assert.deepEqual(Object.keys(spin.props).sort(), ['color', 'size', 'spinning', 'type']);
    assert.deepEqual(spin.props.color.modes, COLOR_PRESETS);
    assert.deepEqual(spin.props.size.modes, SIZE_MODES);
    assert.deepEqual(spin.props.type.options, ['dots', 'arc']);
    assert.equal(spin.props.type.default, 'dots', 'dots is antd\'s default indicator');
    assert.equal(spin.props.spinning.default, true);
    assert.ok(!spin.element.disabledState, 'a status element has no disabled state');
});

test('Type dots draws four dots in two columns, and no arc', () => {
    const keys = keysOf({ type: 'dots' });
    assert.deepEqual(keys.filter(k => /^dot\d$/.test(k)), ['dot1', 'dot2', 'dot3', 'dot4']);
    assert.ok(keys.includes('dotBox') && keys.includes('dotCol1') && keys.includes('dotCol2'), 'a holder with two columns hold the dots');
    assert.ok(!keys.includes('spinner'), 'no arc');
});

test('Type arc draws the one arc, and no dots', () => {
    const keys = keysOf({ type: 'arc' });
    assert.ok(keys.includes('spinner'), 'the arc');
    assert.deepEqual(keys.filter(k => /^dot/.test(k)), []);
});

test('nothing is drawn while spinning is off, whatever the Type', () => {
    assert.deepEqual(keysOf({ spinning: false, type: 'dots' }), []);
    assert.deepEqual(keysOf({ spinning: false, type: 'arc' }), []);
});

test('each dot pulses with its own delay, so the four are out of step', () => {
    const delays = spin.parts.filter(p => /^dot\d$/.test(p.id)).map(p => p.pulse.delayMs);
    assert.deepEqual(delays, [0, 400, 800, 1200]);
});

test('the dots and the arc are bound to the Size and Color variables, never a literal', () => {
    const dot = instanceFor(model, { type: 'dots' }).find(n => n.behavior?.part === 'dot1');
    assert.ok(Object.keys(dot.vars ?? {}).length > 0, 'the dot is bound to variables');
    for (const key of Object.values(dot.vars ?? {})) assert.ok(model.variables.items.some(i => i.id === key), `${key} is a variable`);
});

test('the export draws the dots for the dots type and the arc for the arc type', () => {
    const files = generateComponent(spin, model.binding, model.variables, componentNameOf(spin), model.frame, () => []).files;
    assert.match(files['Spin.jsx'], /className="antd-spin-dot1"/);
    assert.match(files['Spin.jsx'], /className="antd-spin-spinner"/, 'the arc is drawn too, under its type');
});

test('the geometry is antd\'s: the holder is 14, 20 or 32 by Size (small, default, large), each dot (holder - 2) / 2, the gap 2', () => {
    const role = token => spin.tokenRoles[token];
    assert.deepEqual(role('dotBox'), { xs: 'space-14', sm: 'space-14', md: 'space-20', lg: 'space-32', xl: 'space-32', default: 'space-20' });
    assert.deepEqual(role('dotSize'), { xs: 'space-6', sm: 'space-6', md: 'space-9', lg: 'space-15', xl: 'space-15', default: 'space-9' });
    assert.equal(role('dotGap'), 'space-2');
});

test('the holder turns as a whole (1.2 seconds, antd), and each dot pulses 0.4 seconds after the one before', () => {
    assert.deepEqual(spin.anatomy.find(s => s.id === 'dotBox').spin, { seconds: 1.2 });
    assert.deepEqual(spin.parts.filter(p => /^dot\d$/.test(p.id)).map(p => p.pulse.delayMs), [0, 400, 800, 1200]);
});
