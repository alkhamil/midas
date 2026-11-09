// A container in the anatomy: a slot of `kind: 'frame'` is a frame of the master that holds the slots that name it as their `parent` (the FormItem's label box: the
// required mark and the label side by side). It is generic: the generator builds it with its children inside it, a second run adds only what is missing,
// part-missing finds the layers inside it, an instance copies it, and Play and the export draw it as one element of the template's class around its children.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { FORM_ITEM } from '../src/templates/form-item.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { applyTemplateToFrame, instanceOf, layerSpecsOf, masterLayersByKey } from '../src/behavior-engine/template-master.js';
import { assertBehaviorShape } from '../src/behavior-engine/data.js';
import { diagnoseDocument } from '../src/behavior-engine/diagnostics.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { formItemModel } from '../../../scripts/form-item-model.mjs';

/** FormItem with its label in a box beside a required mark. */
const BOXED = (() => {
    const t = structuredClone(FORM_ITEM);
    t.id = 'boxitem';
    t.name = 'BoxItem';
    t.anatomy = [
        { id: 'labelBox', kind: 'frame', layout: 'horizontal' },
        { id: 'requiredMark', kind: 'text', optional: true, parent: 'labelBox', typography: 'label', shownWhen: { prop: 'required', is: true } },
        { id: 'label', kind: 'text', parent: 'labelBox', typography: 'label' },
    ];
    t.props.required = { source: 'literal', type: 'boolean', default: false };
    t.props.requiredMark = { source: 'literal', type: 'string', default: '*', node: { key: 'requiredMark', field: 'text' }, visibleIf: { prop: 'required', is: true } };
    t.display.requiredMark = { fill: 'fg', typography: 'labelTypography' };
    return t;
})();
TEMPLATES.set(BOXED.id, BOXED);

const model = formItemModel();
const variables = { collections: model.collections, items: model.items };
const frame = () => ({ id: 'master', name: 'BoxItem', type: 'frame', parentId: null, fills: [] });
let seq = 0;
const build = (f, children = []) => applyTemplateToFrame(BOXED, { frame: f, children, binding: { variables: model.binding.variables }, variables, idOf: key => `b-${key}-${++seq}` });
const withAnatomy = anatomy => ({ ...structuredClone(BOXED), anatomy });
const problems = anatomy => validateTemplateSchema(withAnatomy(anatomy)).join('\n');

test('the validator holds a container to its rules: a layout, children that name it, one level of nesting, and a required text inside or beside it', () => {
    assert.deepEqual(validateTemplateSchema(BOXED), []);
    const [box, mark, label] = BOXED.anatomy;
    assert.match(problems([{ ...box, layout: undefined }, mark, label]), /frame slot "labelBox" layout must be horizontal or vertical/);
    assert.match(problems([box, { ...mark, parent: 'nope' }, label]), /anatomy slot "requiredMark" has the parent "nope", which is not a frame slot/);
    assert.match(problems([box, mark, { ...label, parent: 'label' }]), /anatomy slot "label" has the parent "label", which is not a frame slot/);
    // Containers nest one level (the handler column holds its halves), never two.
    assert.doesNotMatch(problems([box, { id: 'x', kind: 'frame', layout: 'vertical', parent: 'labelBox' }, { ...mark, parent: 'x' }, label]), /sits too deep|cannot sit inside/);
    assert.match(problems([box, { id: 'x', kind: 'frame', layout: 'vertical', parent: 'labelBox' }, { id: 'y', kind: 'frame', layout: 'vertical', parent: 'x' }, { ...mark, parent: 'y' }, label]), /frame slot "y" sits too deep: containers nest one level/);
    assert.match(validateTemplateSchema(withAnatomy([{ ...box }, { ...label, parent: undefined }])).join('\n'), /frame slot "labelBox" holds no slot/);
    assert.match(problems([{ ...box, optional: true }, mark, label]), /frame slot "labelBox" cannot be optional/);
    assert.doesNotMatch(problems([{ ...box, managed: true, shownWhen: { prop: 'label', empty: false } }, { ...mark, parent: 'labelBox' }, label]), /cannot be/, 'a managed conditional container is allowed');
});

test('the layers of the template: the box, then the slots inside it (each naming its parent), then the content slot', () => {
    assert.deepEqual(layerSpecsOf(BOXED).map(s => [s.key, s.role, s.parentKey ?? null]), [['root', 'root', null], ['labelBox', 'group', null], ['requiredMark', 'text', 'labelBox'], ['label', 'text', 'labelBox'], ['control', 'content', null]]);
});

test('the generator builds the box with its children inside it, marked as the group, and builds nothing the second time', () => {
    const f = frame();
    const out = build(f);
    const byName = Object.fromEntries(out.created.map(n => [n.name, n]));
    assert.equal(byName.labelBox.parentId, f.id);
    assert.equal(byName.labelBox.type, 'frame');
    assert.equal(byName.labelBox.layout, 'horizontal');
    assert.deepEqual(byName.labelBox.behavior, { version: 2, group: 'labelBox' });
    assert.equal(byName.label.parentId, byName.labelBox.id);
    assert.equal(byName.requiredMark.parentId, byName.labelBox.id);
    assert.deepEqual(out.created.filter(n => n.parentId === byName.labelBox.id).map(n => n.name), ['requiredMark', 'label'], 'in anatomy order');
    assert.deepEqual(out.problems, []);
    assert.deepEqual(build(f, out.created).created, []);
});

test('a missing layer is added where it belongs: a deleted label returns inside the box, a deleted box returns with its children', () => {
    const f = frame();
    const first = build(f);
    const withoutLabel = first.created.filter(n => n.name !== 'label');
    const again = build(f, withoutLabel);
    assert.deepEqual(again.created.map(n => n.name), ['label']);
    assert.equal(again.created[0].parentId, withoutLabel.find(n => n.name === 'labelBox').id, 'inside the box that is there, not a second box');
    const withoutBox = first.created.filter(n => !['labelBox', 'requiredMark', 'label'].includes(n.name));
    assert.deepEqual(build(f, withoutBox).created.map(n => n.name), ['labelBox', 'requiredMark', 'label']);
});

test('the master layers are found inside the box, and part-missing names the layer that is gone from it', () => {
    const f = frame();
    const created = build(f).created;
    assert.deepEqual(masterLayersByKey(BOXED, f, [f, ...created]).map(l => l.key), ['root', 'labelBox', 'requiredMark', 'label', 'control']);
    const doc = nodes => ({ variables, pages: [{ name: 'p', nodes: [{ ...f, behavior: { version: 2, templateId: 'boxitem', variables: model.binding.variables } }, ...nodes] }] });
    const missing = nodes => diagnoseDocument(doc(nodes)).filter(x => x.code === 'part-missing').map(x => x.layer);
    assert.deepEqual(missing(created), []);
    assert.deepEqual(missing(created.filter(n => n.name !== 'label')), ['label']);
    assert.deepEqual(missing(created.filter(n => !['labelBox', 'requiredMark', 'label'].includes(n.name))), ['labelBox', 'requiredMark', 'label']);
});

test('the group marker is valid on a master layer and refused on an instance', () => {
    const box = { id: 'g', name: 'labelBox', type: 'frame', behavior: { version: 2, group: 'labelBox' } };
    assert.doesNotThrow(() => assertBehaviorShape({ pages: [{ name: 'p', nodes: [box] }] }));
    assert.throws(() => assertBehaviorShape({ pages: [{ name: 'p', nodes: [{ ...box, isInstance: true }] }] }), /a group cannot be an instance/);
    assert.throws(() => assertBehaviorShape({ pages: [{ name: 'p', nodes: [{ ...box, behavior: { version: 2, group: '' } }] }] }), /group must name a group/);
});

test('an instance copies the box and what is in it; the mark follows required and the label its text', () => {
    const f = frame();
    const created = build(f).created;
    const copies = instanceOf(BOXED, f, created, { label: 'Email', required: true }, { id: src => `i-${src}` });
    const byName = Object.fromEntries(copies.map(n => [n.name, n]));
    assert.equal(byName.label.parentId, byName.labelBox.id);
    assert.equal(byName.label.text, 'Email');
    assert.equal(byName.requiredMark.visible, true);
    assert.equal(byName.requiredMark.text, '*');
    assert.equal(instanceOf(BOXED, f, created, { label: 'Email' }, { id: src => `j-${src}` }).find(n => n.name === 'requiredMark').visible, false, 'no mark while required is off');
});

/** A BoxItem master and an instance of it, as Play and the export read them. */
function boxItem(props) {
    const f = frame();
    const created = build(f).created;
    const [root, ...copies] = instanceOf(BOXED, f, created, props, { id: src => `i-${src}`, varModes: { [model.ids.size]: 'md' } });
    const inst = { ...root, id: 'inst', x: 0, y: 0, w: 200, h: 60 };
    const kids = copies.map(n => (n.parentId === root.id ? { ...n, parentId: 'inst' } : n));
    return { master: f, created, doc: { pages: [{ id: 'p', name: 'Screens', nodes: [f, ...created, inst, ...kids] }], variables } };
}

test('Play draws the box as one element of its class around the mark and the label, in order', () => {
    const { doc } = boxItem({ label: 'Email', required: true });
    const { root } = toDomTree(doc, 'inst');
    const box = root.children.find(c => c.attrs?.class === 'boxitem-labelBox');
    assert.ok(box, 'the box element');
    assert.deepEqual(box.children.map(c => c.text), ['*', 'Email'], 'the mark, then the label');
    assert.equal(box.children[1].text, 'Email');
    assert.equal(root.children.filter(c => c.attrs?.class === 'boxitem-label').length, 0, 'the label is not also drawn outside the box');
    const none = toDomTree(boxItem({ label: 'Email' }).doc, 'inst').root.children.find(c => c.attrs?.class === 'boxitem-labelBox');
    assert.deepEqual(none.children.map(c => c.text), ['Email'], 'no mark while required is off');
});

test('the export writes the box as one element around its children, with the box frame\'s own layout as its rule', () => {
    const { master, created } = boxItem({});
    const nodes = [master, ...created];
    const childrenOf = id => nodes.filter(n => n.parentId === id);
    const { files, problems: issues } = generateComponent(BOXED, model.binding, variables, 'BoxItem', master, childrenOf);
    assert.deepEqual(issues, []);
    const tsx = files['BoxItem.tsx'];
    assert.match(tsx, /<div className="boxitem-labelBox">\n\s*\{\(required === true\) && <span className="boxitem-requiredMark">\{requiredMark\}<\/span>\}\n\s*<span className="boxitem-label">\{label\}<\/span>\n\s*<\/div>/);
    assert.match(files['BoxItem.css'], /\.boxitem-labelBox \{\n(?:.*\n)*?\s*flex-direction: row;/);
});

/** A box that only shows while its text prop is not empty: a managed conditional container holding a managed text slot. */
const COND = (() => {
    const t = structuredClone(FORM_ITEM);
    t.id = 'condbox';
    t.name = 'CondBox';
    t.anatomy = [
        { id: 'innerOn', kind: 'frame', layout: 'horizontal', managed: true, shownWhen: { prop: 'innerText', empty: false } },
        { id: 'innerText', kind: 'text', managed: true, parent: 'innerOn', typography: 'label', shownWhen: { prop: 'innerText', empty: false } },
    ];
    t.props.innerText = { source: 'literal', type: 'string', default: '', node: { key: 'innerText', field: 'text' } };
    for (const key of Object.keys(t.props)) { if (t.props[key].source !== 'variable' && key !== 'innerText') delete t.props[key]; }
    t.slots = [];
    t.control = undefined;
    t.display = { innerText: { fill: 'fg', typography: 'labelTypography' } };
    t.persistentStates = {};
    t.previewStates = {};
    return t;
})();
TEMPLATES.set(COND.id, COND);

/** A CondBox instance, as Play reads it. */
function condItem(props) {
    const f = frame();
    let k = 0;
    const created = applyTemplateToFrame(COND, { frame: f, children: [], binding: { variables: model.binding.variables }, variables, idOf: key => 'c-' + key + '-' + (++seq) }).created;
    const [root, ...copies] = instanceOf(COND, f, created, props, { id: () => 'i-' + (++k) });
    const inst = { ...root, id: 'inst', x: 0, y: 0, w: 200, h: 60 };
    const kids = copies.map(n => (n.parentId === root.id ? { ...n, parentId: 'inst' } : n));
    return { pages: [{ id: 'p', name: 'Screens', nodes: [f, ...created, inst, ...kids] }], variables };
}

test('Play draws a conditional container only while its condition holds', () => {
    const withText = toDomTree(condItem({ innerText: 'Hi' }), 'inst').root;
    assert.ok(withText.children.some(c => c.attrs?.class === 'condbox-innerOn'), 'the box element');
    const without = toDomTree(condItem({}), 'inst').root;
    assert.ok(!without.children.some(c => c.attrs?.class === 'condbox-innerOn'), 'no box while the text is empty');
});


test('the export draws a conditional container only while its condition holds, around its text', () => {
    const f = frame();
    const created = applyTemplateToFrame(COND, { frame: f, children: [], binding: { variables: model.binding.variables }, variables, idOf: key => 'c-' + key + '-' + (++seq) }).created;
    const nodes = [f, ...created];
    const childrenOf = id => nodes.filter(n => n.parentId === id);
    const { files, problems: issues } = generateComponent(COND, model.binding, variables, 'CondBox', f, childrenOf);
    assert.deepEqual(issues, []);
    assert.match(files['CondBox.jsx'], /\{\(String\(innerText \?\? ""\) !== ""\) && <div className="condbox-innerOn">/);
});

test('part-missing does not ask for a conditional container that is off at the sample props', () => {
    const f = frame();
    const created = applyTemplateToFrame(COND, { frame: f, children: [], binding: { variables: model.binding.variables }, variables, idOf: key => 'c-' + key + '-' + (++seq) }).created;
    const doc = nodes => ({ variables, pages: [{ name: 'p', nodes: [{ ...f, behavior: { version: 2, templateId: 'condbox', variables: model.binding.variables } }, ...nodes] }] });
    assert.deepEqual(diagnoseDocument(doc(created)).filter(x => x.code === 'part-missing').map(x => x.layer), []);
});
