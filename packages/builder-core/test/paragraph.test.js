// Paragraph (antd Typography.Paragraph): Text, plus ellipsis (the text clamped to its rows) with an optional expand control, and copyable (a copy icon slot). The expand
// control and the copy icon are layers made while their prop is on and removed while it is off; each has a hover colour; the click of each is a press (expand, copy).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { iconDefsOf, createdIconDefaults } from '../src/behavior-engine/anatomy.js';
import { pressAttrsOf, literalFields } from '../src/behavior-engine/display.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { applyPress } from '../src/prototype/press.js';
import { modelFor, instanceFor } from './helpers/box-template.js';
import { elementsOf } from './helpers/play-compute.js';

const paragraph = TEMPLATES.get('antd-paragraph');
const model = modelFor(paragraph);
const exported = generateComponent(model.template, model.binding, model.variables, 'Paragraph', model.frame, id => model.created.filter(n => n.parentId === id));
const layers = props => instanceFor(model, props).slice(1).map(n => n.name);
const label = props => instanceFor(model, props).find(n => n.name === 'label');

test('Paragraph is registered: Text props, ellipsis with rows and an expand control, copyable with an icon', () => {
    assert.ok(paragraph);
    assert.deepEqual(validateTemplateSchema(paragraph), []);
    assert.deepEqual(Object.keys(paragraph.props).filter(p => paragraph.props[p].source === 'literal'), ['label', 'strong', 'italic', 'underline', 'strikethrough', 'code', 'mark', 'disabled', 'ellipsis', 'rows', 'expandable', 'expandText', 'copyable', 'copyIcon']);
});

test('ellipsis clamps the label to its rows on the canvas, and off removes the clamp; rows only shows while it is on', () => {
    assert.equal(label({}).textTruncate, false);
    assert.equal(label({ ellipsis: true, rows: 3 }).textTruncate, true);
    assert.equal(label({ ellipsis: true, rows: 3 }).maxLines, 3);
    assert.equal(label({ ellipsis: true }).maxLines, 2, 'two rows until the designer says otherwise');
    const fields = literalFields(paragraph, resolveProps(paragraph, { ellipsis: false, rows: 5 }));
    assert.equal(fields.find(f => f.field === 'textTruncate').value, false);
});

test('expandable adds the expand control (its box and its text) while ellipsis and expandable are on, and removes it otherwise', () => {
    assert.deepEqual(layers({}), ['label']);
    assert.deepEqual(layers({ ellipsis: true }), ['label']);
    assert.deepEqual(layers({ ellipsis: true, expandable: true }), ['label', 'expander', 'expandText']);
    assert.deepEqual(layers({ ellipsis: false, expandable: true }), ['label'], 'no ellipsis, no control');
    assert.equal(instanceFor(model, { ellipsis: true, expandable: true }).find(n => n.name === 'expandText').text, 'Expand');
    assert.equal(instanceFor(model, { ellipsis: true, expandable: true, expandText: 'More' }).find(n => n.name === 'expandText').text, 'More');
});

test('copyable adds the copy icon (in its box) while on and removes it while off; the icon is a slot the designer picks', () => {
    assert.deepEqual(layers({}), ['label']);
    assert.deepEqual(layers({ copyable: true }), ['label', 'copier', 'copy']);
    const def = iconDefsOf(paragraph).find(d => d.slot === 'copy');
    assert.equal(def.component, 'copyIcon', 'a picker prop');
    assert.equal(def.role, 'copy');
    assert.equal(createdIconDefaults(paragraph, { copyable: true }, 'def-circle', { copy: 'icon-copy' }).copyIcon, 'icon-copy');
    assert.equal(createdIconDefaults(paragraph, { copyable: true }, 'def-circle', {}).copyIcon, 'def-circle');
});

test('both controls together: one layer each, nothing hidden, nothing duplicated', () => {
    const names = layers({ ellipsis: true, expandable: true, copyable: true });
    assert.deepEqual(names, ['label', 'expander', 'copier', 'expandText', 'copy']);
    for (const n of instanceFor(model, { ellipsis: true, expandable: true, copyable: true })) assert.notEqual(n.visible, false, n.name);
});

test('the copy icon and the expand control have a hover colour, bound to tokens, in the export and Play (the canvas is static)', () => {
    const css = exported.files['Paragraph.css'];
    assert.match(css, /\.antd-paragraph-copy:hover \{\s*color: var\(--antd-paragraph-copy-hover\);\s*\}/);
    assert.match(css, /\.antd-paragraph-expander:hover \.antd-paragraph-expandText \{\s*color: var\(--antd-paragraph-link-hover\);\s*\}/);
    assert.match(css, /\.antd-paragraph-expander \{\s*cursor: pointer;/);
    assert.doesNotMatch(css, /:hover[^}]*#[0-9a-f]{3,8}/i, 'no colour literal in a hover rule');
    const hoverToken = model.variables.items.find(i => i.name === 'copyHover');
    assert.ok(hoverToken && !Object.values(label({}).vars ?? {}).includes(hoverToken.id));
});

test('the export is clean (no unsupported slot), takes onCopy, and keeps the expanded state locally', () => {
    assert.deepEqual(generateComponent(model.template, model.binding, model.variables, 'Paragraph', model.frame, id => model.created.filter(n => n.parentId === id)).problems, []);
    const jsx = exported.files['Paragraph.jsx'];
    assert.match(jsx, /export function Paragraph\(\{[^}]*onCopy[^}]*\}\)/);
    assert.match(jsx, /const \[expanded, setExpanded\] = useState\(false\);/);
    assert.match(jsx, /data-expanded=\{expanded \|\| undefined\}/);
    assert.match(jsx, /data-ellipsis=\{ellipsis \|\| undefined\}/);
    assert.match(jsx, /navigator\.clipboard\?\.writeText\(String\(label \?\? ""\)\); onCopy\?\.\(label\);/);
    assert.match(jsx, /onClick=\{\(\) => \{ if \(!\(disabled\)\) set/);
});

test('the export clamps the label to the rows while ellipsis is on, and an expanded root lifts the clamp', () => {
    const css = exported.files['Paragraph.css'];
    assert.match(css, /\.antd-paragraph\[data-ellipsis\] \.antd-paragraph-label \{\s*display: -webkit-box;\s*-webkit-box-orient: vertical;\s*-webkit-line-clamp: var\(--antd-paragraph-rows\);\s*overflow: hidden;/);
    assert.match(css, /\.antd-paragraph\[data-expanded\] \.antd-paragraph-label \{\s*display: block !important;\s*-webkit-line-clamp: unset !important;\s*overflow: visible !important;/);
    assert.match(exported.files['Paragraph.jsx'], /'--antd-paragraph-rows': rows \?\? undefined/);
});

test('the presses say what they do: expand toggles the local expanded state, copy names the text it copies', () => {
    assert.deepEqual(pressAttrsOf(paragraph, 'expander'), { 'data-press': 'toggle', 'data-press-attr': 'data-expanded' });
    assert.deepEqual(pressAttrsOf(paragraph, 'copier'), { 'data-press': 'copy', 'data-press-copy': 'antd-paragraph-label' });
});

const fakeRoot = (attrs, text) => ({ attrs, hasAttribute(n) { return n in this.attrs; }, setAttribute(n, v) { this.attrs[n] = v; }, removeAttribute(n) { delete this.attrs[n]; }, querySelector: sel => (sel === '.antd-paragraph-label' ? { textContent: text } : null), querySelectorAll: () => [] });
const click = (root, press, extra = {}) => applyPress({ closest: sel => (sel === '[data-press]' ? { getAttribute: n => ({ 'data-press': press, ...extra })[n] ?? null, closest: s => (s === '[data-press-root]' ? root : null) } : null) });

test('Play: a click on the expand control turns the expanded state on and off; a disabled paragraph ignores it', () => {
    const root = fakeRoot({ 'data-press-root': '' }, 'x');
    assert.equal(click(root, 'toggle', { 'data-press-attr': 'data-expanded' }), true);
    assert.ok('data-expanded' in root.attrs);
    click(root, 'toggle', { 'data-press-attr': 'data-expanded' });
    assert.ok(!('data-expanded' in root.attrs));
    const off = fakeRoot({ 'data-press-root': '', 'aria-disabled': 'true' }, 'x');
    assert.equal(click(off, 'toggle', { 'data-press-attr': 'data-expanded' }), false);
});

test('Play: a click on the copy icon puts the text on the clipboard; a disabled paragraph copies nothing', () => {
    const written = [];
    globalThis.navigator ?? Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
    const clipboard = Object.getOwnPropertyDescriptor(globalThis.navigator, 'clipboard');
    Object.defineProperty(globalThis.navigator, 'clipboard', { value: { writeText: t => written.push(t) }, configurable: true });
    try {
        assert.equal(click(fakeRoot({ 'data-press-root': '' }, 'Hello'), 'copy', { 'data-press-copy': 'antd-paragraph-label' }), true);
        assert.deepEqual(written, ['Hello']);
        assert.equal(click(fakeRoot({ 'data-press-root': '', 'aria-disabled': 'true' }, 'No'), 'copy', { 'data-press-copy': 'antd-paragraph-label' }), false);
        assert.deepEqual(written, ['Hello']);
    } finally {
        if (clipboard) Object.defineProperty(globalThis.navigator, 'clipboard', clipboard); else delete globalThis.navigator.clipboard;
    }
});

test('Play draws the clamp, the expand control and the copy icon from the same nodes', () => {
    const nodes = instanceFor(model, { ellipsis: true, rows: 3, expandable: true, copyable: true });
    nodes[0].varModes = Object.fromEntries(Object.entries(model.binding.variables).map(([prop, cid]) => [cid, model.variables.collections.find(c => c.id === cid).modes.find(m => m.name === (paragraph.props[prop].defaultMode)).id]));
    nodes[0].parentId = 'top';
    const top = { id: 'top', name: 'Top', type: 'frame', parentId: null, layout: 'vertical', x: 0, y: 0, w: 400, h: 400, fills: [], layoutSizingH: 'hug', layoutSizingV: 'hug' };
    const { root, problems } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [top, model.frame, ...model.created, ...nodes] }], variables: model.variables }, 'top');
    assert.deepEqual(problems, []);
    const found = elementsOf(root);
    const rootEl = found.find(({ el }) => el.attrs?.class === 'antd-paragraph').el;
    assert.equal(rootEl.attrs['data-ellipsis'], '');
    assert.equal(rootEl.style['--antd-paragraph-rows'], '3');
    assert.equal(rootEl.attrs['data-press-root'], '');
    const classes = found.map(({ el }) => el.attrs?.class);
    for (const c of ['antd-paragraph-label', 'antd-paragraph-expander', 'antd-paragraph-expandText', 'antd-paragraph-copier']) assert.ok(classes.includes(c), c);
    const labelEl = found.find(({ el }) => el.attrs?.class === 'antd-paragraph-label').el;
    assert.equal(labelEl.style.WebkitLineClamp, '3');
});
