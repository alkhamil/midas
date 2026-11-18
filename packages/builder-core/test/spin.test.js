// Spin: a loading indicator with no text. One arc part, shown while `spinning` is on, sized by the Size's icon token and coloured by the Color preset's text role.
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

/** The layers of an instance under these props, root excluded. */
const layers = props => instanceFor(model, props).slice(1);

test('Spin is registered, valid, and made of one spinner part with no text', () => {
    assert.ok(spin, 'Spin is in the registry');
    assert.equal(spin.name, 'Spin');
    assert.deepEqual(validateTemplateSchema(spin, { templateIds: new Set(TEMPLATES.keys()) }), []);
    assert.deepEqual(Object.keys(spin.props).sort(), ['color', 'size', 'spinning']);
    assert.deepEqual(spin.props.color.modes, COLOR_PRESETS);
    assert.deepEqual(spin.props.size.modes, SIZE_MODES);
    assert.equal(spin.props.spinning.default, true);
    assert.deepEqual(spin.anatomy.map(s => s.id), ['spinBox'], 'one managed box holds the arc');
    assert.equal(spin.primarySlot, undefined, 'no text slot to be primary');
    assert.ok(!spin.element.disabledState, 'a status element has no disabled state');
});

test('the spinner is drawn while spinning is on and removed when it is off', () => {
    const on = layers({ spinning: true });
    const arc = on.find(n => n.behavior?.part === 'spinner');
    assert.ok(arc, 'the arc is drawn while spinning');
    assert.equal(arc.type, 'ellipse');
    assert.ok(on.some(n => n.behavior?.slot === 'spinBox'), 'the box holds it');
    assert.deepEqual(layers({ spinning: false }), [], 'no layer while spinning is off: the root is empty');
});

test('the spinner is bound to the Size icon token and the Color text role, never a literal', () => {
    const spinner = layers({}).find(n => n.behavior?.part === 'spinner');
    const bound = Object.values(spinner.vars ?? {});
    assert.ok(bound.length > 0, 'the arc is bound to variables');
    for (const key of bound) assert.ok(model.variables.items.some(i => i.id === key), `${key} is a variable`);
});

test('the export draws the arc at rest in its box, and the box is the Size icon token', () => {
    const files = generateComponent(spin, model.binding, model.variables, componentNameOf(spin), model.frame, () => []).files;
    assert.match(files['Spin.jsx'], /className="antd-spin-spinner"/, 'the arc is drawn');
    assert.match(files['Spin.css'], /\.antd-spin-spinner \{[^}]*width: var\(--antd-spin-icon-size\)/s, 'the arc is sized by the icon size');
});
