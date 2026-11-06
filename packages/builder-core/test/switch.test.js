// Switch: a track (the root: fill, radius, fixed height and width, padding) and a handle (a group frame) that moves to the end while checked. Props checked,
// disabled, size (default | small). No text. Every visual value is a token.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { diagnoseDocument } from '../src/behavior-engine/diagnostics.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const sw = TEMPLATES.get('switch');
const model = modelFor(sw);

test('Switch is a registered form control with no text: checked, disabled, and the Color and Size dimensions only', () => {
    assert.ok(sw);
    assert.equal(sw.isControl, true);
    assert.equal(sw.primarySlot, undefined);
    assert.deepEqual(Object.keys(sw.props), ['color', 'size', 'checked', 'disabled']);
    assert.deepEqual(sw.props.size.modes, ['small', 'default']);
    assert.equal(sw.props.size.defaultMode, 'default');
    assert.ok(!sw.anatomy.some(s => s.kind === 'text' || s.kind === 'control'), 'no label text');
});

test('the master is the track and the handle, and the instance shows no text node at all', () => {
    assert.deepEqual(model.created.map(n => n.name), ['handle']);
    assert.equal(instanceFor(model, {}).filter(n => n.type === 'text').length, 0);
    const doc = { variables: model.variables, pages: [{ name: 'p', nodes: [model.frame, ...model.created] }] };
    assert.deepEqual(diagnoseDocument(doc).filter(f => f.severity === 'error' || f.code === 'part-missing'), []);
});

test('the track and the handle are bound to tokens and fixed in both axes', () => {
    assert.deepEqual(Object.keys(model.frame.vars).sort(), ['fills.0', 'h', 'padH', 'padV', 'radius', 'w']);
    assert.deepEqual([model.frame.layoutSizingH, model.frame.layoutSizingV], ['fixed', 'fixed']);
    const handle = model.created[0];
    assert.deepEqual(Object.keys(handle.vars).sort(), ['fills.0', 'h', 'radius', 'w']);
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
    assert.match(css, /\.switch \{[^}]*width: var\(--switch-track-width\)/);
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
