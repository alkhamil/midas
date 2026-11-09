// InputNumber's handler column (antd): attached to the right edge at the full control height, split by a divider, revealed on hover and focus in Play and the export only (see inputnumber-reveal.test.js),
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
