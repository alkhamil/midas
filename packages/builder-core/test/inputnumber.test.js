// InputNumber: the Input for numbers. min, max, step and precision are props; a stepper (two stacked arrow glyphs in a container) is made while `controls` is on and
// its position is right, and removed when not. An arrow whose limit the value has reached is recoloured (a colour token, never a hidden layer). Clicking an arrow in Play
// steps the value; the export reports the press.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { INPUT_BASE as INPUT } from '../src/templates/input-base.js';
import { planAnatomy } from '../src/behavior-engine/anatomy.js';
import { resolveProps, setInstanceProp } from '../src/behavior-engine/instance-props.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const number = TEMPLATES.get('inputnumber');
const model = modelFor(number);
const base = { placeholder: 'Enter number' };
const names = props => instanceFor(model, { ...base, ...props }).slice(1).map(n => n.name);
const exported = () => generateComponent(number, model.binding, model.variables, 'InputNumber', model.frame, id => model.created.filter(n => n.parentId === id));
const playRoot = props => {
    const nodes = instanceFor(model, { ...base, ...props });
    return toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, ...nodes] }], variables: model.variables }, nodes[0].id);
};
const find = (el, pred) => pred(el) ? el : (el.children ?? []).map(c => find(c, pred)).find(Boolean);

test('InputNumber is a registered form control built on the Input: its sizes, variants, statuses, sides and managed text; no clear icon, no counter', () => {
    assert.ok(number);
    assert.equal(number.isControl, true);
    assert.deepEqual(validateTemplateSchema(number), []);
    for (const prop of ['variant', 'status', 'size', 'value', 'placeholder', 'hasPrefix', 'prefixKind', 'prefixText', 'prefixIcon', 'hasSuffix', 'suffixText', 'suffixIcon', 'disabled', 'readOnly']) assert.deepEqual(number.props[prop], INPUT.props[prop], prop);
    for (const prop of ['allowClear', 'clearIcon', 'showCount', 'maxLength']) assert.ok(!(prop in number.props), `${prop} is not an InputNumber prop`);
    assert.deepEqual(number.sampleProps, { placeholder: 'Enter number' });
});

test('min, max and step are decimal numbers, precision a whole number; controls is on, its position is right or none', () => {
    for (const p of ['min', 'max', 'step']) assert.equal(number.props[p].decimal, true, p);
    assert.equal(number.props.step.default, 1);
    assert.equal(number.props.min.default, null);
    assert.equal(number.props.precision.default, null);
    assert.ok(!number.props.precision.decimal);
    assert.equal(number.props.controls.default, true);
    assert.deepEqual(number.props.controlsPosition.options, ['right', 'none']);
    assert.deepEqual(number.props.controlsPosition.visibleIf, { prop: 'controls', is: true });
    assert.equal(setInstanceProp(number, {}, 'min', -5.5).min, -5.5);
    assert.throws(() => setInstanceProp(number, {}, 'precision', 1.5));
    assert.throws(() => setInstanceProp(number, { min: 5 }, 'max', 3), /more than|less than|at most/i, 'min is never above max');
});

test('atMin and atMax are read from the value and the limits, and are never stored', () => {
    const at = props => { const r = resolveProps(number, props); return [r.atMin, r.atMax]; };
    assert.deepEqual(at({ value: '10', min: 0, max: 10 }), [false, true]);
    assert.deepEqual(at({ value: '0', min: 0, max: 10 }), [true, false]);
    assert.deepEqual(at({ value: '', min: 0, max: 10 }), [false, false]);
    assert.throws(() => setInstanceProp(number, {}, 'atMax', true), /derived/);
});

test('the master is the root, the placeholder and the empty stepper container; a fresh instance has the container with both arrows', () => {
    assert.deepEqual(model.created.map(n => n.name), ['placeholder', 'stepper'], 'the arrows are instance layers; the container is there while controls is on at the sample props');
    assert.deepEqual(names({}), ['placeholder', 'stepper', 'stepUp', 'stepDown']);
});

test('controls off, or the position none, removes the stepper with its arrows; turning it back on makes them again', () => {
    assert.deepEqual(names({ controls: false }), ['placeholder']);
    assert.deepEqual(names({ controlsPosition: 'none' }), ['placeholder']);
    const held = instanceFor(model, { ...base }).slice(1).map(n => ({ id: n.id, slot: n.behavior?.slot ?? null, name: n.name, ...(n.behavior?.slot === 'stepUp' || n.behavior?.slot === 'stepDown' ? { parent: 'stepper' } : {}) }));
    const off = planAnatomy(number, resolveProps(number, { ...base, controls: false }), held);
    assert.deepEqual(off.map(o => o.op), ['remove', 'remove', 'remove'], 'the container and both arrows go');
    assert.deepEqual(planAnatomy(number, resolveProps(number, base), held), [], 'the plan converges');
});

test('the arrows sit in the stepper, which sits after the suffix; a prefix and a suffix are the Input\'s', () => {
    const nodes = instanceFor(model, { ...base, hasSuffix: true, suffixText: 'kg' });
    assert.deepEqual(nodes.slice(1).filter(n => n.parentId === nodes[0].id).map(n => n.name), ['placeholder', 'suffixText', 'stepper']);
    const stepper = nodes.find(n => n.name === 'stepper');
    assert.deepEqual(nodes.filter(n => n.parentId === stepper.id).map(n => n.name), ['stepUp', 'stepDown']);
    assert.equal(stepper.layout, 'vertical');
});

test('no instance holds a hidden, transparent or zero-size layer, with the stepper on or off, at a limit or not', () => {
    for (const props of [{}, { controls: false }, { value: '10', max: 10 }, { value: '0', min: 0 }, { disabled: true }]) {
        for (const n of instanceFor(model, { ...base, ...props })) assert.ok(n.visible !== false && n.opacity !== 0 && !(n.w === 0 && n.h === 0 && n.layoutSizingH === 'fixed' && n.layoutSizingV === 'fixed' && !n.vars?.w), `${n.name} with ${JSON.stringify(props)}`);
    }
});

test('a limit recolours the arrow with a colour token, and disabled recolours both', () => {
    assert.deepEqual(number.persistentStates.atMax.tokens, { 'step-up-fg': 'step-fg-disabled' });
    assert.deepEqual(number.persistentStates.atMin.tokens, { 'step-down-fg': 'step-fg-disabled' });
    assert.equal(number.persistentStates.disabled.tokens['step-up-fg'], 'step-fg-disabled');
    assert.equal(number.persistentStates.disabled.tokens['step-down-fg'], 'step-fg-disabled');
    assert.deepEqual(number.statePseudo.atMin, '[data-at-min]');
    assert.deepEqual(number.statePseudo.atMax, '[data-at-max]');
    assert.equal(number.display.stepUp.fill, 'step-up-fg');
    assert.equal(number.display.stepDown.fill, 'step-down-fg');
    assert.equal(number.tokenKinds['step-up-fg'], 'color');
});

test('Play: the input carries the limits, the arrows say which way they step, the root says a limit is reached', () => {
    const r = playRoot({ value: '10', min: 0, max: 10, step: 2, precision: 1 });
    assert.deepEqual(r.problems, []);
    const input = find(r.root, e => e.tag === 'input');
    assert.deepEqual([input.attrs['data-num-min'], input.attrs['data-num-max'], input.attrs['data-num-step'], input.attrs['data-num-precision']], ['0', '10', '2', '1']);
    assert.equal(find(r.root, e => e.attrs?.class === 'inputnumber-stepUp').attrs['data-press-step'], '1');
    assert.equal(find(r.root, e => e.attrs?.class === 'inputnumber-stepDown').attrs['data-press-step'], '-1');
    assert.ok('data-press-root' in r.root.attrs);
    assert.equal(r.root.attrs['data-at-max'], true);
    assert.equal(r.root.attrs['data-at-min'], undefined);
    assert.equal(find(playRoot({ controls: false }).root, e => e.attrs?.class === 'inputnumber-stepper'), undefined, 'no stepper element without controls');
    assert.equal(find(playRoot({ disabled: true }).root, e => e.tag === 'input').attrs.disabled, true);
});

test('the export computes the limits from the props, reports a press, and recolours an arrow at its limit', () => {
    const out = exported();
    assert.deepEqual(out.problems, []);
    const jsx = out.files['InputNumber.jsx'], css = out.files['InputNumber.css'];
    assert.match(jsx, /const atMax = max != null && Number\(value\) >= max/);
    assert.match(jsx, /const atMin = min != null && Number\(value\) <= min/);
    assert.match(jsx, /onStep/);
    assert.match(jsx, /data-at-max=\{atMax \|\| undefined\}/);
    assert.match(jsx, /onClick=\{\(\) => \{ if \(!\(disabled \|\| readOnly\)\) onStep\?\.\(1\); \}\}/);
    assert.match(jsx, /\{\(\(controls === true\) && \(controlsPosition === "right"\)\) && <div className="inputnumber-stepper">/);
    assert.match(css, /\[data-at-max\]:not\(:has\(:disabled\)\) \{\s*--inputnumber-step-up-fg: #/, 'a limit swaps the arrow colour token on the root');
    assert.match(css, /\.inputnumber-stepUp \{[^}]*cursor: pointer/);
});
