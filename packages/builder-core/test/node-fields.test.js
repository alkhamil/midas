// A prop may write more than `visible` and `text`: `layout` (an enum: horizontal or vertical), `gap` (a number) and `width` (a number, or null for hug) of a frame, and
// `width` of a text. Generic: the schema says which prop writes which field of which layer, and every surface reads the same writes. The canvas gets the node
// fields (nodeFieldPatch; the instance owns them once a prop writes them), Play and the export get the same values as data attributes and custom properties that
// the stylesheet's rules read, so no second source of the value exists (the gap is the prop, not a token).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { FORM_ITEM } from '../src/templates/form-item.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { literalFields, literalFieldNames, nodeFieldPatch } from '../src/behavior-engine/display.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { applyTemplateToFrame, instanceOf } from '../src/behavior-engine/template-master.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { formItemModel } from '../../../scripts/form-item-model.mjs';

/** A template with a label box whose layout, gap and label width are props. */
const T = (() => {
    const t = structuredClone(FORM_ITEM);
    t.id = 'fieldy';
    t.name = 'Fieldy';
    t.anatomy = [
        { id: 'labelBox', kind: 'frame', layout: 'horizontal' },
        { id: 'label', kind: 'text', parent: 'labelBox', typography: 'label' },
    ];
    t.props.layout = { source: 'literal', type: 'enum', options: ['vertical', 'horizontal'], default: 'vertical', node: { key: 'root', field: 'layout' } };
    t.props.labelGap = { source: 'literal', type: 'number', default: 8, node: { key: 'root', field: 'gap' } };
    t.props.labelWidth = { source: 'literal', type: 'number', default: null, node: { key: 'label', field: 'width' }, visibleIf: { prop: 'layout', is: 'horizontal' } };
    delete t.tokens.fromSize;
    t.tokens = { fromSize: ['labelTypography', 'fg', 'fg-disabled'] };
    t.tokenKinds = { labelTypography: 'typography', fg: 'color', 'fg-disabled': 'color' };
    delete t.tokenRoles.gap;
    t.display = { root: {}, label: { fill: 'fg', typography: 'labelTypography' } };
    return t;
})();
TEMPLATES.set(T.id, T);
const model = formItemModel();
const variables = { collections: model.collections, items: model.items };

test('the schema may name layout, gap and width as node fields, and the validator holds each to its kind', () => {
    assert.deepEqual(validateTemplateSchema(T), []);
    const with_ = props => validateTemplateSchema({ ...structuredClone(T), props: { ...structuredClone(T.props), ...props } }).join('\n');
    assert.match(with_({ layout: { ...T.props.layout, options: ['vertical', 'diagonal'] } }), /prop "layout" offers "diagonal", which "layout" does not take/);
    assert.match(with_({ labelGap: { ...T.props.labelGap, type: 'boolean', default: false } }), /prop "labelGap" is boolean but writes "gap", which takes number/);
    assert.match(with_({ labelWidth: { ...T.props.labelWidth, node: { key: 'labelBox', field: 'text' } } }), /prop "labelWidth" writes "text", which a frame does not take/);
});

test('the writes: layout is its option, gap a number, width a number or null for hug', () => {
    const writes = props => Object.fromEntries(literalFields(T, resolveProps(T, props)).filter(w => ['layout', 'gap', 'width'].includes(w.field)).map(w => [`${w.key}.${w.field}`, w.value]));
    assert.deepEqual(writes({}), { 'root.layout': 'vertical', 'root.gap': 8, 'label.width': null });
    assert.deepEqual(writes({ layout: 'horizontal', labelGap: 12, labelWidth: 90 }), { 'root.layout': 'horizontal', 'root.gap': 12, 'label.width': 90 });
    assert.equal(writes({ layout: 'vertical', labelWidth: 90 })['label.width'], null, 'hidden while the layout is vertical: the default (hug), not the stored 90');
});

test('a width is a fixed width on the node, or hug; a gap is the node\'s gap; a layout its own', () => {
    assert.deepEqual(nodeFieldPatch('width', 90, 'frame'), { w: 90, layoutSizingH: 'fixed' });
    assert.deepEqual(nodeFieldPatch('width', 90, 'text'), { w: 90, layoutSizingH: 'fixed', autoW: false });
    assert.deepEqual(nodeFieldPatch('width', null, 'text'), { layoutSizingH: 'hug', autoW: true });
    assert.deepEqual(nodeFieldPatch('width', null, 'frame'), { layoutSizingH: 'hug' });
    assert.deepEqual(nodeFieldPatch('gap', 12, 'frame'), { gap: 12 });
    assert.deepEqual(nodeFieldPatch('gap', null, 'frame'), { gap: 0 });
    assert.deepEqual(nodeFieldPatch('layout', 'horizontal', 'frame'), { layout: 'horizontal' });
    assert.deepEqual(nodeFieldPatch('text', 'Hi', 'text'), { text: 'Hi' });
});

test('the node fields a prop owns on the instance are the ones it writes, so a sync never copies them back from the master', () => {
    const owned = literalFieldNames(T).map(f => `${f.key}.${f.field}`);
    for (const name of ['root.layout', 'root.gap', 'label.w', 'label.layoutSizingH', 'label.autoW']) assert.ok(owned.includes(name), name);
    assert.ok(!owned.includes('label.width'), 'the pseudo field is not a node field');
});

test('an instance made from the master has the props written: its layout, its gap and its label width', () => {
    const f = { id: 'master', name: 'Fieldy', type: 'frame', parentId: null, fills: [] };
    const created = applyTemplateToFrame(T, { frame: f, children: [], binding: { variables: model.binding.variables }, variables, idOf: key => `f-${key}` }).created;
    const [root, ...copies] = instanceOf(T, f, created, { layout: 'horizontal', labelGap: 14, labelWidth: 96 }, { id: src => `i-${src}` });
    assert.equal(root.layout, 'horizontal');
    assert.equal(root.gap, 14);
    const label = copies.find(n => n.name === 'label');
    assert.deepEqual([label.w, label.layoutSizingH, label.autoW], [96, 'fixed', false]);
    const vertical = instanceOf(T, f, created, {}, { id: src => `j-${src}` });
    assert.equal(vertical[0].layout, 'vertical');
    assert.deepEqual([vertical.find(n => n.name === 'label').layoutSizingH, vertical.find(n => n.name === 'label').autoW], ['hug', true]);
});

const master = () => {
    const f = { id: 'master', name: 'Fieldy', type: 'frame', parentId: null, fills: [], layout: 'vertical', gap: 0 };
    const created = applyTemplateToFrame(T, { frame: f, children: [], binding: { variables: model.binding.variables }, variables, idOf: key => `f-${key}` }).created;
    return { f, created, childrenOf: id => [f, ...created].filter(n => n.parentId === id) };
};

test('the export carries them: typed props, a data attribute for the layout, custom properties for the gap and the width, and the rules that read them', () => {
    const { f, childrenOf } = master();
    const { files, problems } = generateComponent(T, model.binding, variables, 'Fieldy', f, childrenOf);
    assert.deepEqual(problems, []);
    const tsx = files['Fieldy.tsx'];
    assert.match(tsx, /layout\?: 'vertical' \| 'horizontal';/);
    assert.match(tsx, /labelGap\?: number;/);
    assert.match(tsx, /labelWidth\?: number \| null;/);
    assert.match(tsx, /layout = "vertical"/);
    assert.match(tsx, /labelGap = 8/);
    assert.match(tsx, /data-layout=\{layout\}/);
    assert.match(tsx, /style=\{\{ \.\.\.\{ '--fieldy-labelGap': `\$\{labelGap\}px`, '--fieldy-labelWidth': labelWidth == null \? undefined : `\$\{labelWidth\}px` \}, \.\.\.style \} as CSSProperties\}/);
    const css = files['Fieldy.css'];
    assert.match(css, /\.fieldy\[data-layout="horizontal"\] \{\n  flex-direction: row;\n\}/);
    assert.match(css, /\.fieldy\[data-layout="vertical"\] \{\n  flex-direction: column;\n\}/);
    assert.match(css, /\.fieldy \{\n(?:.*\n)*?\s*gap: var\(--fieldy-labelGap\);/);
    assert.match(css, /\.fieldy-label \{\n(?:.*\n)*?\s*width: var\(--fieldy-labelWidth, auto\);/);
});

test('Play carries the same: the layout attribute and the two custom properties on the root, so the same rules draw it', () => {
    const { f, created } = master();
    const [root, ...copies] = instanceOf(T, f, created, { layout: 'horizontal', labelGap: 12, labelWidth: 90 }, { id: src => `i-${src}`, varModes: { [model.ids.size]: 'md' } });
    const inst = { ...root, id: 'inst', x: 0, y: 0, w: 300, h: 40 };
    const kids = copies.map(n => (n.parentId === root.id ? { ...n, parentId: 'inst' } : n));
    const { root: el } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [f, ...created, inst, ...kids] }], variables }, 'inst');
    assert.equal(el.attrs['data-layout'], 'horizontal');
    assert.equal(el.style['--fieldy-labelGap'], '12px');
    assert.equal(el.style['--fieldy-labelWidth'], '90px');
    const plain = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [f, ...created, { ...inst, behavior: { version: 2, props: {} } }, ...kids] }], variables }, 'inst').root;
    assert.equal(plain.attrs['data-layout'], 'vertical');
    assert.equal(plain.style['--fieldy-labelGap'], '8px');
    assert.equal('--fieldy-labelWidth' in plain.style, false, 'no width: the rule falls back to auto');
});
