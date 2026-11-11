// Title (antd Typography.Title): Level picks the heading style and the element (h1 to h5, by the Level mode's name), Type the colour; italic, the decoration lines, code, mark
// and disabled are the Typography base's. Play and the export draw the element of the level the instance is in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { planManagedTextBindings } from '../src/behavior-engine/bind-tokens.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { typographyOf } from '../src/behavior-engine/typography.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { elementTagOf } from '../src/behavior-engine/display.js';
import { TITLE_LEVELS } from '../src/templates/typography-base.js';
import { modelFor, instanceFor } from './helpers/box-template.js';
import { elementsOf } from './helpers/play-compute.js';

const title = TEMPLATES.get('antd-title');
const model = modelFor(title);
const collectionOf = prop => model.variables.collections.find(c => c.id === model.binding.variables[prop]);
const modeId = (prop, name) => collectionOf(prop).modes.find(m => m.name === name).id;
const exported = generateComponent(model.template, model.binding, model.variables, 'Title', model.frame, id => model.created.filter(n => n.parentId === id));

function playOf(level, props = {}) {
    const nodes = instanceFor(model, props);
    nodes[0].varModes = { [model.binding.variables.level]: modeId('level', level), [model.binding.variables.type]: modeId('type', 'default') };
    nodes[0].parentId = 'top';
    const top = { id: 'top', name: 'Top', type: 'frame', parentId: null, layout: 'vertical', x: 0, y: 0, w: 400, h: 400, fills: [], layoutSizingH: 'hug', layoutSizingV: 'hug' };
    const { root, problems } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [top, model.frame, ...model.created, ...nodes] }], variables: model.variables }, 'top');
    assert.deepEqual(problems, []);
    return elementsOf(root).find(({ el }) => el.attrs?.class === 'antd-title').el;
}

test('Title is registered with Level (h1 to h5) and Type, no strong, and the shared text style props', () => {
    assert.ok(title);
    assert.deepEqual(validateTemplateSchema(title), []);
    assert.deepEqual(title.props.level.modes, TITLE_LEVELS);
    assert.deepEqual(Object.keys(title.props).filter(p => title.props[p].source === 'literal'), ['label', 'italic', 'underline', 'strikethrough', 'code', 'mark', 'disabled']);
});

test('the schema refuses a tag that follows a prop that is not a variable, and a level with no tag', () => {
    const bad = structuredClone(title);
    bad.element.tagBy = { prop: 'label', tags: {} };
    assert.ok(validateTemplateSchema(bad).some(p => /tagBy must name a variable prop/.test(p)));
    const missing = structuredClone(title);
    delete missing.element.tagBy.tags.h3;
    assert.ok(validateTemplateSchema(missing).some(p => /no tag for the mode "h3"/.test(p)));
});

test('the label is a managed layer, and every style prop adds none', () => {
    assert.deepEqual(instanceFor(model, {}).map(n => n.name), ['Title', 'label']);
    assert.deepEqual(instanceFor(model, { code: true, mark: true, italic: true, underline: true, strikethrough: true }).map(n => n.name), ['Title', 'label']);
    assert.deepEqual(instanceFor(model, { label: '' }).map(n => n.name), ['Title']);
});

test('Level swaps the heading style: five levels, five decreasing font sizes', () => {
    const label = instanceFor(model, {}).find(n => n.name === 'label');
    const resolved = resolveProps(title, {});
    for (const op of planManagedTextBindings({ template: title, binding: model.binding, props: resolved, layers: [{ key: 'label', node: label }], variables: model.variables }).ops) label.vars = { ...label.vars, [op.varKey]: op.itemId };
    const item = model.variables.items.find(i => i.id === label.vars.typography);
    const size = level => typographyOf(model.variables, item, c => (c.id === model.binding.variables.level ? modeId('level', level) : c.modes[0].id)).style.fontSize;
    const sizes = TITLE_LEVELS.map(size);
    assert.deepEqual(sizes, [...sizes].sort((a, b) => b - a), 'h1 is the largest');
    assert.ok(new Set(sizes).size >= 4);
});

test('Play draws the heading element of the level: h1 to h5, by the mode name', () => {
    for (const level of TITLE_LEVELS) assert.equal(playOf(level).tag, level, level);
});

test('the element tag is matched by name, case-insensitively, and falls back to the fixed tag', () => {
    assert.equal(elementTagOf(title, 'H3'), 'h3');
    assert.equal(elementTagOf(title, undefined), 'h1');
    assert.equal(elementTagOf(title, 'unknown'), 'h1');
});

test('the export is clean, and picks its element from the level it is given (a tag per mode id)', () => {
    assert.deepEqual(generateComponent(model.template, model.binding, model.variables, 'Title', model.frame, id => model.created.filter(n => n.parentId === id)).problems, []);
    const jsx = exported.files['Title.jsx'];
    const map = JSON.parse(/const TAGS = (\{.*\});/.exec(jsx)[1]);
    for (const level of TITLE_LEVELS) assert.equal(map[modeId('level', level)], level);
    assert.match(jsx, /const Tag = TAGS\[level\] \?\? "h1";/);
    assert.match(jsx, /<Tag\s/);
    assert.match(jsx, /<\/Tag>/);
});

test('the export draws the type colours, the code box and the text styles like Text does', () => {
    const css = exported.files['Title.css'];
    assert.match(css, /\.antd-title\[data-italic\] \.antd-title-label \{\s*font-style: italic;/);
    assert.match(css, /\.antd-title\[data-underline\]\[data-strikethrough\] \.antd-title-label \{\s*text-decoration: underline line-through;/);
    assert.match(css, /\[data-code\] \{[^}]*--antd-title-border-width: 1px;/);
    assert.match(css, /\[data-mark\] \{[^}]*--antd-title-bg:/);
});

test('Play carries the italic and decoration of the label from the same node fields', () => {
    const el = playOf('h2', { italic: true, underline: true });
    assert.equal(el.attrs['data-italic'], '');
    const label = elementsOf(el).find(({ el: e }) => e.attrs?.class === 'antd-title-label').el;
    assert.equal(label.style.fontStyle, 'italic');
    assert.equal(label.style.textDecoration, 'underline');
});
