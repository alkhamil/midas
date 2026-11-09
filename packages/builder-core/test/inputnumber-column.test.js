// InputNumber's handler column (antd): attached to the right edge at the full control height, split by a divider, revealed on hover and focus in Play and the export only,
// and the blur that commits a typed number or restores the last committed value.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { blurNumber, commitNumber } from '../src/prototype/press.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const number = TEMPLATES.get('inputnumber');
const model = modelFor(number);
const base = { placeholder: 'Enter number' };
const exported = () => generateComponent(number, model.binding, model.variables, 'InputNumber', model.frame, id => model.created.filter(n => n.parentId === id));
const playOf = props => {
    const nodes = instanceFor(model, { ...base, ...props });
    return toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, ...nodes] }], variables: model.variables }, nodes[0].id);
};
const find = (el, pred) => pred(el) ? el : (el.children ?? []).map(c => find(c, pred)).find(Boolean);

test('the handler column is attached: full control height, a small control wide, split by a divider a border thick, rounded at the outer corners only', () => {
    const nodes = instanceFor(model, { ...base });
    const stepper = nodes.find(n => n.name === 'stepper');
    assert.deepEqual([stepper.layoutSizingH, stepper.layoutSizingV], ['fixed', 'fill'], 'it fills the height of the control and is as wide as its width token');
    assert.equal(stepper.layout, 'vertical');
    assert.deepEqual([stepper.primaryAlign, stepper.counterAlign], ['center', 'center']);
    assert.deepEqual(number.display.stepper, { fill: 'step-bg', radiusEnd: 'radius', width: 'stepWidth', gap: 'stepGap' }, 'colour, end corners, width and the gap that keeps the chevrons off the divider are tokens');
    assert.deepEqual(number.display.stepDivider, { fill: 'step-border', width: 'stepWidth', height: 'borderWidth' }, 'the divider is a border thick and a column wide, in the border colour');
    assert.equal(nodes.find(n => n.name === 'stepDivider').type, 'path');
    assert.equal(number.tokenRoles.stepWidth, 'height-sm');
    assert.equal(number.tokenRoles['step-border'], 'border');
    assert.equal(number.anatomy.find(s => s.id === 'stepUp').glyph, 'chevronUp');
    assert.equal(number.anatomy.find(s => s.id === 'stepDown').glyph, 'chevronDown');
    const css = exported().files['InputNumber.css'];
    assert.match(css, /\.inputnumber-stepper \{[^}]*border-top-right-radius: var\(--inputnumber-radius\);[^}]*border-bottom-right-radius: var\(--inputnumber-radius\)/);
    assert.match(css, /\.inputnumber-stepDivider \{[^}]*width: var\(--inputnumber-step-width\);[^}]*height: var\(--inputnumber-border-width\)/);
});

test('while the column is attached the root keeps no padding on its end side: the token is none and a state gives it back without the column', () => {
    assert.equal(number.display.root.paddingEnd, 'paddingEnd');
    assert.equal(number.display.root.paddingStart, 'paddingX');
    assert.ok(!('paddingX' in number.display.root));
    assert.deepEqual(number.persistentStates.noStepper.tokens, { paddingEnd: 'paddingEndSide' });
    assert.equal(number.tokenRoles.paddingEnd, 'button-padding-y-md', 'the zero length of the base data');
    assert.equal(number.props.noStepper.derived.when.any.length, 2, 'no stepper: controls off, or position none');
    const css = exported().files['InputNumber.css'];
    assert.match(css, /\.inputnumber \{[^}]*padding-inline-start: max\(0px, calc\(var\(--inputnumber-padding-x\) - /);
    assert.match(css, /\.inputnumber \{[^}]*padding-inline-end: max\(0px, calc\(var\(--inputnumber-padding-end\) - /);
    assert.match(css, /\[data-no-stepper\][^{]*\{[^}]*--inputnumber-padding-end: /, 'without the column the end padding is the side one');
});

test('Play and the export reveal the column on hover and focus over the antd time, never when disabled; the canvas draws it always', () => {
    assert.deepEqual(number.reveal, { slot: 'stepper', duration: '0.2s' });
    const css = exported().files['InputNumber.css'];
    assert.match(css, /\.inputnumber-stepper \{\s*opacity: 0;\s*pointer-events: none;\s*transition: opacity 0\.2s;/);
    assert.match(css, /\.inputnumber:hover:not\(:has\(:disabled\)\) \.inputnumber-stepper,\n\.inputnumber:focus-within:not\(:has\(:disabled\)\) \.inputnumber-stepper \{\s*opacity: 1;/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.inputnumber-stepper \{\s*transition: none;/);
    for (const n of instanceFor(model, { ...base })) assert.ok(n.opacity !== 0 && n.visible !== false, 'the canvas node tree always holds the column, drawn');
    assert.match(String(playOf({}).styles), /\.inputnumber-stepper \{\s*opacity: 0;/, 'Play carries the same rule');
});

// An element-like object, enough for blurNumber.
const el = (attrs, extra = {}) => ({ attrs: { ...attrs }, getAttribute(n) { return n in this.attrs ? String(this.attrs[n]) : null; }, setAttribute(n, v) { this.attrs[n] = String(v); }, removeAttribute(n) { delete this.attrs[n]; }, hasAttribute(n) { return n in this.attrs; }, ...extra });

test('blur in Play: empty -> letters -> blur = empty, 3 -> letters -> blur = 3, 3 -> 5 -> blur = 5, and the commit is the next fallback', () => {
    const input = find(playOf({ value: '3', min: 0, max: 10 }).root, e => e.tag === 'input');
    assert.equal(input.attrs['data-committed'], '3', 'Play starts from the committed value');
    const root = el({ 'data-press-root': '' });
    const field = el({ 'data-num-min': '0', 'data-num-max': '10', 'data-committed': '3' }, { value: 'abc', closest: () => root });
    assert.equal(blurNumber(field), '3');
    assert.equal(field.value, '3');
    field.value = '5';
    assert.equal(blurNumber(field), '5');
    assert.equal(field.attrs['data-committed'], '5');
    field.value = 'zz';
    assert.equal(blurNumber(field), '5');
    const empty = el({ 'data-num-min': '0', 'data-num-max': '10', 'data-committed': '' }, { value: 'abc', closest: () => root });
    assert.equal(blurNumber(empty), '', 'nothing committed before: back to empty');
    field.value = '99';
    blurNumber(field);
    assert.equal(field.value, '10', 'clamped');
    assert.ok(root.hasAttribute('data-at-max'), 'and the limit is marked');
});

test('blur in the export: an uncontrolled input that remembers the committed value and embeds the same function Play runs', () => {
    const jsx = exported().files['InputNumber.jsx'];
    assert.match(jsx, /defaultValue=\{value\} key=\{value\} data-committed=\{value\}/);
    assert.match(jsx, /onBlur=\{\(e\) => \{ const next = commitNumber\(e\.target\.value, e\.target\.dataset\.committed \?\? "", \{ min: min \?\? null, max: max \?\? null, precision: precision \?\? null \}\);/);
    assert.match(jsx, /onCommit\?\.\(next\)/);
    // The embedded source is the real function, so it behaves as the tested one does.
    const source = /const commitNumber = (function commitNumber[\s\S]*?\n\});/.exec(jsx)?.[1];
    assert.ok(source, 'the function is in the file');
    const embedded = new Function(`return (${source});`)();
    for (const [typed, committed, limits] of [['abc', '', { min: 0, max: 10, precision: null }], ['x', '3', { min: 0, max: 10, precision: null }], ['5', '3', { min: 0, max: 10, precision: null }], ['15', '3', { min: 0, max: 10, precision: 1 }]]) {
        assert.equal(embedded(typed, committed, limits), commitNumber(typed, committed, limits));
    }
});
