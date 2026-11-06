// FormItem: `required` shows a mark beside the label (a red asterisk, in the label box with the label), `layout` is Vertical (the label above the control, the
// default) or Horizontal (the label to its left), `labelWidth` is the label box's width (Horizontal only; hidden and hug in Vertical) and `labelGap` the space
// between the label and the control in both. The gap is the prop, not a token: no second gap exists. The control slot fills the width it is given (what is left
// of the row in Horizontal), and keeps the slot rules (min, max, accepts, showEmpty, fillCounter) in both layouts. Canvas, Play and the export say the same.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { applyTemplateToFrame, instanceOf, layerSpecsOf } from '../src/behavior-engine/template-master.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { instancePanel } from '../src/behavior-engine/panel.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { planManagedTextBindings, applyBindTokens } from '../src/behavior-engine/bind-tokens.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { diagnoseDocument } from '../src/behavior-engine/diagnostics.js';
import { formItemModel } from '../../../scripts/form-item-model.mjs';

const fi = TEMPLATES.get('formitem');
const model = formItemModel();
const variables = { collections: model.collections, items: model.items };
const frame = () => ({ id: 'master', name: 'FormItem', type: 'frame', parentId: null, fills: [] });
const build = f => applyTemplateToFrame(fi, { frame: f, children: [], binding: { variables: model.binding.variables }, variables, idOf: key => `f-${key}` });

test('the schema: a label box with the mark and the label, props for required, layout, labelWidth and labelGap, and no gap token', () => {
    assert.deepEqual(validateTemplateSchema(fi, { templateIds: new Set(TEMPLATES.keys()) }), []);
    assert.deepEqual(layerSpecsOf(fi).map(s => [s.key, s.parentKey ?? null]), [['root', null], ['labelBox', null], ['requiredMark', 'labelBox'], ['label', 'labelBox'], ['control', null]]);
    assert.equal(fi.props.required.default, false);
    assert.deepEqual([fi.props.layout.options, fi.props.layout.default], [['vertical', 'horizontal'], 'vertical']);
    assert.equal(fi.props.labelWidth.default, null);
    assert.deepEqual(fi.props.labelWidth.visibleIf, { prop: 'layout', is: 'horizontal' });
    assert.equal(fi.props.labelGap.default, 8);
    assert.equal(fi.tokens.fromSize.includes('gap'), false, 'the gap is the labelGap prop alone');
    assert.equal('gap' in fi.display.root, false);
    assert.equal(fi.tokenRoles.gap, undefined);
    assert.equal(fi.slots[0].fill, true, 'the control fills the width it is given');
});

test('the generator builds a vertical master: the label box (mark and label in it) above the control slot, which fills the width', () => {
    const f = frame();
    const out = build(f);
    assert.equal(f.layout, 'vertical');
    assert.deepEqual(out.problems, []);
    const by = Object.fromEntries(out.created.map(n => [n.name, n]));
    assert.deepEqual(out.created.map(n => n.name), ['labelBox', 'label', 'Control']);
    assert.equal(by.label.parentId, by.labelBox.id);
    assert.equal(('requiredMark' in by), false, 'no mark layer while required is off: it is added, not hidden');
    assert.equal(by.Control.layoutSizingH, 'fill');
    assert.ok(by.label.vars.typography, 'the label follows its typography');
    assert.ok(boundMark().vars['fills.0'], 'the mark has its own colour variable');
});

test('Behavior lists required, layout and labelGap, and labelWidth only in Horizontal', () => {
    const f = { ...frame(), behavior: { version: 2, templateId: 'formitem', variables: { ...model.binding.variables } } };
    const rows = props => instancePanel({ behavior: { version: 2, props } }, f, model.collections, { size: 'md' }).rows.map(r => r.prop);
    assert.deepEqual(rows({}), ['size', 'label', 'required', 'layout', 'labelGap', 'disabled']);
    assert.deepEqual(rows({ layout: 'horizontal' }), ['size', 'label', 'required', 'layout', 'labelWidth', 'labelGap', 'disabled']);
    assert.deepEqual(rows({ required: true }), ['size', 'label', 'required', 'requiredMark', 'layout', 'labelGap', 'disabled']);
    assert.equal(resolveProps(fi, { layout: 'vertical', labelWidth: 90 }).labelWidth, null, 'hidden: the stored width is not used');
});

function instance(props) {
    const f = frame();
    const created = build(f).created;
    const [root, ...copies] = instanceOf(fi, f, created, props, { id: src => `i-${src}`, varModes: { [model.ids.size]: 'md' } });
    return { f, created, root, copies };
}

function boundMark() {
    const mark = instance({ required: true }).copies.find(n => n.name === 'requiredMark');
    const layers = [{ key: 'requiredMark', node: mark }];
    const props = resolveProps(fi, { required: true });
    applyBindTokens(layers, planManagedTextBindings({ template: fi, binding: model.binding, props, layers, variables }).ops);
    return mark;
}

test('the canvas: an instance has the layout and the gap the props say, the label box its width, the mark shown while required', () => {
    const v = instance({});
    assert.deepEqual([v.root.layout, v.root.gap], ['vertical', 8]);
    const box = v.copies.find(n => n.name === 'labelBox');
    assert.equal(box.layoutSizingH, 'hug', 'Vertical: the box hugs the label');
    const h = instance({ layout: 'horizontal', labelWidth: 96, labelGap: 16, required: true, label: 'Email' });
    assert.deepEqual([h.root.layout, h.root.gap], ['horizontal', 16]);
    const hb = h.copies.find(n => n.name === 'labelBox');
    assert.deepEqual([hb.w, hb.layoutSizingH], [96, 'fixed']);
    assert.equal(h.copies.find(n => n.name === 'requiredMark').visible, true);
    assert.equal(h.copies.find(n => n.name === 'label').text, 'Email');
});

test('the export: typed props, the label box, the mark, the layout rules, and the control that fills what is left in Horizontal', () => {
    const { f, created } = instance({});
    const nodes = [f, ...created];
    const { files, problems } = generateComponent(fi, model.binding, variables, 'FormItem', f, id => nodes.filter(n => n.parentId === id));
    assert.deepEqual(problems, []);
    const tsx = files['FormItem.tsx'];
    for (const line of ['required?: boolean;', "layout?: 'vertical' | 'horizontal';", 'labelWidth?: number | null;', 'labelGap?: number;', 'requiredMark?: string;', 'children?: ReactNode;']) assert.ok(tsx.includes(line), line);
    assert.match(tsx, /<div className="formitem-labelBox">\n\s*\{\(required === true\) && <span className="formitem-requiredMark">\{requiredMark\}<\/span>\}\n\s*<span className="formitem-label">\{label\}<\/span>\n\s*<\/div>/);
    assert.ok(tsx.indexOf('formitem-labelBox') < tsx.indexOf('formitem-control'), 'the label before the control');
    const css = files['FormItem.css'];
    assert.match(css, /\.formitem\[data-layout="horizontal"\] \{\n  flex-direction: row;\n\}/);
    assert.match(css, /\.formitem\[data-layout="vertical"\] \{\n  flex-direction: column;\n\}/);
    assert.match(css, /\.formitem \{\n(?:.*\n)*?\s*gap: var\(--formitem-labelGap\);/);
    assert.match(css, /\.formitem-labelBox \{\n(?:.*\n)*?\s*width: var\(--formitem-labelWidth, auto\);/);
    assert.match(css, /\.formitem\[data-layout="horizontal"\] \.formitem-control \{\n  flex: 1 1 0;\n  min-width: 0px;\n  align-self: auto;\n\}/);
    assert.match(css, /\.formitem\[data-layout="vertical"\] \.formitem-control \{\n  flex: none;\n  align-self: stretch;\n\}/);
    assert.doesNotMatch(css, /--formitem-gap\b/, 'no gap token');
});

test('Play: the box with the mark and the label, the layout attribute, the gap and the label width on the root', () => {
    const { f, created, root, copies } = instance({ layout: 'horizontal', labelWidth: 96, labelGap: 16, required: true, label: 'Email' });
    const inst = { ...root, id: 'inst', x: 0, y: 0, w: 300, h: 60 };
    const kids = copies.map(n => (n.parentId === root.id ? { ...n, parentId: 'inst' } : n));
    const { root: el } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [f, ...created, inst, ...kids] }], variables }, 'inst');
    assert.equal(el.attrs['data-layout'], 'horizontal');
    assert.equal(el.style['--formitem-labelGap'], '16px');
    assert.equal(el.style['--formitem-labelWidth'], '96px');
    const box = el.children.find(c => c.attrs?.class === 'formitem-labelBox');
    assert.deepEqual(box.children.map(c => c.text), ['*', 'Email']);
});

test('the control slot keeps its rules in both layouts: the property is the same and the diagnostics do not look at the layout', () => {
    const f = frame();
    build(f);
    assert.deepEqual(f.cprops.map(p => [p.id, p.min, p.max, p.accepts, p.onlyAccepts, p.showEmpty, p.fillCounter]), [['control', 1, 1, ['input'], true, true, true]]);
    for (const layout of ['vertical', 'horizontal']) {
        const { f: m, created, root, copies } = instance({ layout });
        const inst = { ...root, id: 'inst', name: 'Item' };
        const doc = { variables, pages: [{ name: 'p', nodes: [{ ...m, behavior: { version: 2, templateId: 'formitem', variables: model.binding.variables } }, ...created, inst, ...copies.map(n => (n.parentId === root.id ? { ...n, parentId: 'inst' } : n))] }] };
        assert.deepEqual(diagnoseDocument(doc).filter(x => x.code.startsWith('slot-')).map(x => x.code), ['slot-below-min'], layout);
    }
});
