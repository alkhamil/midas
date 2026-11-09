// TextArea: the Input as a box of wrapped text. Its height comes from rows x line height + padding (tokens, read from the layers once they are bound), the
// count sits bottom right, and Play and the export draw a <textarea> that wraps and grows like the canvas layer does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { INPUT } from '../src/templates/input.js';
import { rowsBounds } from '../src/behavior-engine/display.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const textarea = TEMPLATES.get('textarea');
const model = modelFor(textarea);
const names = props => instanceFor(model, { placeholder: 'Enter text', ...props }).slice(1).map(n => n.name);
const exported = () => generateComponent(textarea, model.binding, model.variables, 'TextArea', model.frame, id => model.created.filter(n => n.parentId === id));
const playRoot = props => {
    const nodes = instanceFor(model, { placeholder: 'Enter text', ...props });
    return toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, ...nodes] }], variables: model.variables }, nodes[0].id);
};
const find = (el, pred) => pred(el) ? el : (el.children ?? []).map(c => find(c, pred)).find(Boolean);

test('TextArea is a registered form control built on the Input: its sizes, variants, statuses, states and managed text; no clear, no sides, no fixed height', () => {
    assert.ok(textarea);
    assert.equal(textarea.isControl, true);
    assert.deepEqual(validateTemplateSchema(textarea), []);
    for (const prop of ['variant', 'status', 'size', 'value', 'placeholder', 'showCount', 'maxLength', 'minLength', 'disabled', 'readOnly']) assert.deepEqual(textarea.props[prop], INPUT.props[prop], prop);
    for (const prop of ['allowClear', 'clearIcon', 'hasPrefix', 'hasSuffix', 'prefixText', 'suffixIcon']) assert.ok(!(prop in textarea.props), `${prop} is not a TextArea prop`);
    assert.deepEqual(textarea.anatomy.map(s => s.id), ['value', 'count']);
    assert.ok(!textarea.tokens.fromSize.includes('height') && !textarea.display.root.height, 'the height is the rows, not a token');
    assert.deepEqual(textarea.sampleProps, { placeholder: 'Enter text' });
});

test('rows is 3 by default, autoSize carries a min and a max, resize is none or vertical', () => {
    assert.equal(textarea.props.rows.default, 3);
    assert.equal(textarea.props.autoSize.default, false);
    assert.deepEqual(textarea.props.minRows.visibleIf, { prop: 'autoSize', is: true });
    assert.deepEqual(textarea.props.maxRows.visibleIf, { prop: 'autoSize', is: true });
    assert.deepEqual(textarea.props.resize.options, ['none', 'vertical']);
    assert.equal(textarea.props.resize.default, 'none');
    assert.deepEqual(textarea.control.multiline, { rows: 'rows', autoSize: 'autoSize', minRows: 'minRows', maxRows: 'maxRows', resize: 'resize' });
});

test('the master is a vertical box that hugs its height, fixed at 343 wide, and holds the placeholder only', () => {
    assert.equal(model.frame.layout, 'vertical');
    assert.equal(model.frame.layoutSizingV, 'hug');
    assert.equal(model.frame.vars?.h, undefined, 'no height variable');
    assert.deepEqual(model.created.map(n => n.name), ['placeholder']);
    const placeholder = model.created[0];
    assert.equal(placeholder.layoutSizingH, 'fill', 'the text wraps in the width the box leaves');
    assert.equal(placeholder.layoutSizingV, 'hug');
});

test('rowsBounds: rows x line height + the padding on both sides; autoSize swaps in its own min and max', () => {
    const m = { lineHeight: 20, paddingY: 4 };
    assert.deepEqual(rowsBounds(textarea, { rows: 3, autoSize: false }, m), { minH: 68, maxH: null });
    assert.deepEqual(rowsBounds(textarea, { rows: 3, autoSize: true, minRows: 2, maxRows: 6 }, m), { minH: 48, maxH: 128 });
    assert.deepEqual(rowsBounds(textarea, { rows: 3, autoSize: true, minRows: null, maxRows: null }, m), { minH: 68, maxH: null }, 'no min falls back to rows; no max is unbounded');
    assert.equal(rowsBounds(INPUT, { rows: 3 }, m), null, 'a template without a multiline control has none');
});

test('a fresh instance holds the placeholder only; a value, the count and the limits add exactly their layers and take them away again', () => {
    assert.deepEqual(names({}), ['placeholder']);
    assert.deepEqual(names({ value: 'hello' }), ['value'], 'a value takes the placeholder place: no hidden layer');
    assert.deepEqual(names({ showCount: true }), ['placeholder', 'count']);
    assert.deepEqual(names({ value: 'hello', showCount: true }), ['value', 'count']);
    assert.ok(instanceFor(model, { placeholder: 'x', showCount: true }).every(n => n.visible !== false));
});

test('the count is bottom right: after the text, filling the width, right aligned', () => {
    const count = instanceFor(model, { placeholder: 'x', showCount: true, value: 'abc', maxLength: 10 }).find(n => n.name === 'count');
    assert.equal(count.textAlign, 'right');
    assert.equal(count.layoutSizingH, 'fill');
    assert.equal(count.text, '3 / 10');
});

test('Play draws a textarea: rows, resize and autoSize as attributes, the rows as custom properties on the root', () => {
    const plain = playRoot({ value: 'a\nb' });
    assert.deepEqual(plain.problems, []);
    const area = find(plain.root, e => e.tag === 'textarea');
    assert.ok(area, 'a textarea element, not an input');
    assert.equal(area.attrs.rows, '3');
    assert.equal(area.attrs.value ?? area.text, 'a\nb');
    assert.equal(plain.root.attrs['data-resize'], 'none');
    assert.equal(plain.root.style['--textarea-rows'], '3');
    const auto = playRoot({ autoSize: true, minRows: 2, maxRows: 5, resize: 'vertical' });
    assert.equal(auto.root.attrs['data-auto-size'], true);
    assert.equal(auto.root.style['--textarea-min-rows'], '2');
    assert.equal(auto.root.style['--textarea-max-rows'], '5');
    assert.equal(find(playRoot({ disabled: true }).root, e => e.tag === 'textarea').attrs.disabled, true);
});

test('the export writes a textarea and derives the height from the rows with the tokens, never a pixel number', () => {
    const out = exported();
    assert.deepEqual(out.problems, []);
    const jsx = out.files['TextArea.jsx'], css = out.files['TextArea.css'];
    assert.match(jsx, /<textarea className="textarea-value"/);
    assert.match(jsx, /rows=\{rows\}/);
    assert.match(jsx, /'--textarea-rows': rows/);
    assert.match(jsx, /data-resize=\{resize\}/);
    assert.match(css, /\.textarea \{[^}]*min-height: calc\(var\(--textarea-rows\) \* var\(--textarea-value-typography-line-height\) \+ 2 \* var\(--textarea-padding-y\)\)/);
    assert.match(css, /\.textarea\[data-auto-size\] \{[^}]*min-height: calc\(var\(--textarea-min-rows, var\(--textarea-rows\)\)/);
    assert.match(css, /\[data-auto-size\][^{]*\{[^}]*max-height: calc\(var\(--textarea-max-rows\)/);
    assert.match(css, /\.textarea\[data-resize="vertical"\] \.textarea-value \{[^}]*resize: vertical/);
    assert.match(css, /\.textarea-value \{[^}]*resize: none/);
    assert.match(css, /\.textarea-count \{[^}]*text-align: right/);
});
