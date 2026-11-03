// FormItem: a label above a control. The control is a content slot that accepts the Input template (by template id, so a copy, a rename and a library
// Input all qualify). Schema only: there is no validation in it. This file covers the template as data, the master the generator builds from it, an
// instance with an Input in its slot, what the Diagnostics say about the wrong content, and the export.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { applyTemplateToFrame, instanceOf, layerSpecsOf } from '../src/behavior-engine/template-master.js';
import { diagnoseDocument } from '../src/behavior-engine/diagnostics.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { instancePanel } from '../src/behavior-engine/panel.js';
import { formItemModel } from '../../../scripts/form-item-model.mjs';
import { inputModel } from '../../../scripts/input-model.mjs';

const formItem = TEMPLATES.get('formitem');
const model = formItemModel();
const variables = { collections: model.collections, items: model.items };
let seq = 0;
const idOf = key => `f-${key}-${++seq}`;
const frame = () => ({ id: 'master', name: 'FormItem', type: 'frame', parentId: null, fills: [] });
const build = f => applyTemplateToFrame(formItem, { frame: f, children: [], binding: model.binding, variables, idOf });

test('FormItem is a registered template, valid on its own: a label, no icon slot, one control slot that takes Input', () => {
    assert.ok(formItem, 'registered');
    assert.deepEqual(validateTemplateSchema(formItem, { templateIds: new Set(TEMPLATES.keys()) }), []);
    assert.deepEqual(formItem.slots.map(s => [s.id, s.accepts, s.onlyAccepts, s.layout]), [['control', ['input'], true, 'vertical']]);
    assert.deepEqual(layerSpecsOf(formItem).map(s => [s.key, s.role]), [['root', 'root'], ['label', 'text'], ['control', 'content']]);
});

test('the generator builds the master: a vertical root, the label bound to its tokens, and the control slot with its property', () => {
    const f = frame();
    const out = build(f);
    assert.equal(f.layout, 'vertical');
    assert.deepEqual(out.problems, []);
    assert.deepEqual(out.created.map(n => n.name), ['label', 'Control']);
    const label = out.created.find(n => n.name === 'label');
    assert.ok(label.vars.typography, 'the label follows labelTypography');
    const control = out.created.find(n => n.propBind?.slot === 'control');
    assert.equal(control.layout, 'vertical');
    assert.deepEqual(f.cprops.map(p => [p.id, p.type, p.accepts, p.onlyAccepts, p.min, p.max, p.showEmpty, p.fillCounter]), [['control', 'slot', ['input'], true, 1, 1, true, true]]);
    assert.deepEqual(applyTemplateToFrame(formItem, { frame: f, children: out.created, binding: model.binding, variables, idOf }).created, [], 'applying again builds nothing');
});

test('an instance of the master copies the slot frame, and the Behavior panel lists label, size and disabled, with no row for the slot', () => {
    const f = frame();
    const nodes = build(f).created;
    const copies = instanceOf(formItem, f, nodes, { label: 'Email' }, { id: src => `i-${src}` });
    assert.equal(copies.find(n => n.propBind?.slot === 'control').sourceId, nodes.find(n => n.propBind?.slot === 'control').id);
    assert.equal(copies.find(n => n.name === 'label').text, 'Email');
    const panel = instancePanel({ ...copies[0], behavior: { version: 2, props: { label: 'Email' } } }, f, model.collections, { size: 'md' });
    assert.deepEqual(panel.rows.map(r => r.prop), ['size', 'label', 'disabled']);
    assert.equal(panel.templateId, 'formitem');
});

/** A document: a FormItem master and an instance of it holding `content` in its control slot; an Input master, and a plain component. */
function documentWith(...content) {
    const f = frame();
    const created = build(f).created;
    const inputMaster = { id: 'inputMain', name: 'Input', type: 'frame', component: true, parentId: null, behavior: { version: 2, templateId: 'input', variables: {} } };
    const plain = { id: 'plain', name: 'Plain', type: 'frame', component: true, parentId: null };
    const [root, ...copies] = instanceOf(formItem, f, created, {}, { id: src => `i-${src}` });
    const slot = copies.find(n => n.propBind?.slot === 'control');
    const held = content.map((of, i) => ({ id: `c${i}`, name: `Item ${i}`, type: 'frame', parentId: slot.id, isInstance: true, sourceId: of }));
    return { variables, pages: [{ name: 'p', nodes: [f, ...created, inputMaster, plain, { ...root, id: 'inst', name: 'Email item' }, ...copies.map(n => (n.parentId === root.id ? { ...n, parentId: 'inst' } : n)), ...held] }] };
}
const findings = doc => diagnoseDocument(doc).filter(x => x.code.startsWith('slot-'));

test('an Input in the control slot is what it accepts: nothing to report', () => {
    assert.deepEqual(findings(documentWith('inputMain')).map(x => x.code), []);
});

test('an empty control slot is below its minimum, and a component that is not an Input is not accepted, each by name', () => {
    assert.deepEqual(findings(documentWith()).map(x => x.code), ['slot-below-min']);
    const wrong = findings(documentWith('plain'));
    assert.deepEqual(wrong.map(x => x.code), ['slot-not-accepted']);
    assert.match(wrong[0].message, /^Email item: "Item 0" is not one of the templates slot "Control" accepts \(input\)\.$/);
    assert.deepEqual(findings(documentWith('inputMain', 'inputMain')).map(x => x.code), ['slot-above-max']);
});

test('the export is FormItem.tsx with the control as children, typed, and the label above it', () => {
    const { files, problems } = generateComponent(formItem, model.binding, variables, 'FormItem', { id: 'm', type: 'frame', layout: 'vertical' }, () => []);
    assert.deepEqual(problems, []);
    assert.deepEqual(Object.keys(files).sort(), ['FormItem.css', 'FormItem.tsx']);
    const tsx = files['FormItem.tsx'];
    assert.match(tsx, /children\?: ReactNode;/);
    assert.match(tsx, /label\?: string;/);
    assert.ok(tsx.indexOf('formitem-label') < tsx.indexOf('formitem-control'));
    assert.match(tsx, /^\s*<div className="formitem-control">\{children\}<\/div>$/m, 'showEmpty: always there');
    assert.match(files['FormItem.css'], /\.formitem \{[^}]*flex-direction: column;/);
});

test('Input is untouched: its model and template are as before, and FormItem shares nothing with it but the Size scale', () => {
    const input = inputModel();
    assert.equal(input.binding.templateId, 'input');
    assert.deepEqual(TEMPLATES.get('input').slots, undefined);
});

test('a template with no icons list (a Custom schema may leave it out) still has a panel', () => {
    const bare = { ...structuredClone(formItem), id: 'bare' };
    delete bare.icons;
    TEMPLATES.set('bare', bare);
    try {
        const f = { ...frame(), behavior: { version: 2, templateId: 'bare', variables: { ...model.binding.variables } } };
        assert.deepEqual(instancePanel({ behavior: { version: 2, props: {} } }, f, model.collections, { size: 'md' }).rows.map(r => r.prop), ['size', 'label', 'disabled']);
    } finally { TEMPLATES.delete('bare'); }
});
