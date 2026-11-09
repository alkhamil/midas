// Switch: a track (the root: fill, radius, fixed height, padding, hugging with the token width as minimum) and a handle (a group frame) that moves to
// the end while checked. Props checked, loading, disabled, size (default | small) and per-state Text|Icon children. Every visual value is a token.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { diagnoseDocument } from '../src/behavior-engine/diagnostics.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const sw = TEMPLATES.get('switch');
const model = modelFor(sw);

test('Switch is a registered form control with managed text and icon slots: checked, loading, disabled, per-state Text|Icon children, Color and Size', () => {
    assert.ok(sw);
    assert.equal(sw.isControl, true);
    assert.equal(sw.primarySlot, 'checkedChildren');
    assert.deepEqual(Object.keys(sw.props), ['color', 'size', 'checked', 'loading', 'disabled', 'checkedKind', 'checkedChildren', 'checkedIcon', 'uncheckedKind', 'uncheckedChildren', 'uncheckedIcon']);
    assert.deepEqual(sw.props.size.modes, ['small', 'default']);
    assert.equal(sw.props.size.defaultMode, 'default');
    assert.ok(sw.anatomy.some(s => s.kind === 'text'), 'managed text slots');
    assert.ok(sw.anatomy.some(s => s.kind === 'icon'), 'managed icon slots');
});

test('the master is the track and the handle; a fresh instance shows no text node and no spinner', () => {
    assert.deepEqual(model.created.map(n => n.name), ['handle']);
    assert.equal(instanceFor(model, {}).filter(n => n.type === 'text').length, 0);
    const doc = { variables: model.variables, pages: [{ name: 'p', nodes: [model.frame, ...model.created] }] };
    assert.deepEqual(diagnoseDocument(doc).filter(f => f.severity === 'error' || f.code === 'part-missing'), []);
});

test('the track hugs with the token minimum and the handle is fixed; both are bound to tokens', () => {
    assert.deepEqual(Object.keys(model.frame.vars).sort(), ['fills.0', 'h', 'minW', 'padH', 'padV', 'radius']);
    assert.deepEqual([model.frame.layoutSizingH, model.frame.layoutSizingV], ['hug', 'fixed']);
    const handle = model.created[0];
    assert.deepEqual(Object.keys(handle.vars).sort(), ['effects', 'fills.0', 'h', 'radius', 'w']);
    assert.deepEqual([handle.layoutSizingH, handle.layoutSizingV], ['fixed', 'fixed']);
    assert.equal(handle.vars.stroke, undefined, 'no border at all');
    assert.equal(model.frame.vars.stroke, undefined);
});

test('the handle moves with checked: the root aligns its content to the end, and back to the start', () => {
    assert.equal(instanceFor(model, { checked: true })[0].primaryAlign, 'end');
    assert.equal(instanceFor(model, {})[0].primaryAlign, 'start');
    assert.equal(model.frame.counterAlign, 'center');
});

test('the export draws the track, the handle and the alignment rules; the track colour follows the states', () => {
    const out = generateComponent(sw, model.binding, model.variables, 'Switch', model.frame, id => model.created.filter(n => n.parentId === id));
    assert.deepEqual(out.problems, []);
    const jsx = out.files['Switch.jsx'], css = out.files['Switch.css'];
    assert.match(jsx, /<button/);
    assert.match(jsx, /data-checked=\{checked \|\| undefined\}/);
    assert.match(jsx, /data-checked-align=\{checked \? "end" : "start"\}/);
    assert.match(jsx, /<div className="switch-handle">/);
    assert.match(css, /\.switch \{[^}]*min-width: var\(--switch-track-width\)/);
    assert.match(css, /\.switch \{[^}]*height: var\(--switch-track-height\)/);
    assert.match(css, /\.switch-handle \{[^}]*width: var\(--switch-handle-size\)/);
    assert.match(css, /\[data-checked-align="end"\] \{\s*justify-content: flex-end/);
    assert.match(css, /\[data-checked\]:not\(:disabled\)/);
    assert.doesNotMatch(css, /border-width/, 'the Switch draws no border');
});

test('Play draws the checked attribute, the alignment and the handle', () => {
    const nodes = instanceFor(model, { checked: true });
    const { root, problems } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, ...nodes] }], variables: model.variables }, nodes[0].id);
    assert.deepEqual(problems, []);
    assert.equal(root.attrs['data-checked'], true);
    assert.equal(root.attrs['data-checked-align'], 'end');
    assert.equal(root.style.justifyContent, 'flex-end');
    assert.ok(root.children.some(c => c.attrs?.class === 'switch-handle'));
});

test('the handle shadow is a variable: antd handleShadow as a Primitive, a Semantic alias, and a Size cell aliased to it, bound to the handle', () => {
    const find = (collection, name) => model.variables.items.find(i => model.variables.collections.find(c => c.id === i.collectionId).name === collection && i.name === name);
    assert.deepEqual(Object.values(find('Primitives', 'shadow/handle').values)[0], [{ type: 'drop', visible: true, color: '#00230b', opacity: 0.2, x: 0, y: 2, blur: 4, spread: 0 }]);
    assert.equal(find('Semantic', 'boxShadowHandle').type, 'effect');
    const cell = model.variables.items.find(i => i.type === 'effect' && /handle-shadow/.test(i.name));
    assert.ok(cell, 'a component effect variable');
    assert.ok(Object.values(cell.values).every(v => v.alias), 'every mode aliases the Semantic effect, never a literal');
    assert.equal(model.created[0].vars.effects, cell.id);
});
