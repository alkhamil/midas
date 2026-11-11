// Avatar (antd-avatar): a square or round box holding initials or an icon. Shape and Size are variable dimensions; the content (text | icon) adds and
// removes the matching managed layer, none hidden. Sizes and colours are tokens. The image content is a later stage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { diagnoseDocument } from '../src/behavior-engine/diagnostics.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { modelFor, instanceFor } from './helpers/box-template.js';
import { variableValue } from '../src/behavior-engine/variable-value.js';
import { SIZE_MODES } from '../src/templates/size-modes.js';
import { COLOR_PRESETS } from '../src/templates/color-presets.js';

const avatar = TEMPLATES.get('antd-avatar');
const model = modelFor(avatar);
const layers = props => instanceFor(model, props).slice(1).map(n => n.name);

test('Avatar is registered with Shape, Size and content props', () => {
    assert.ok(avatar, 'Avatar is in the registry');
    assert.equal(avatar.primarySlot, 'label');
    assert.deepEqual(avatar.props.shape.modes, ['circle', 'square']);
    assert.deepEqual(avatar.props.size.modes, SIZE_MODES);
    assert.deepEqual(avatar.props.content.options, ['text', 'icon']);
    assert.equal(avatar.props.shape.defaultMode, 'circle');
});

test('text content shows the initials, icon content shows the icon, never both', () => {
    assert.deepEqual(layers({ content: 'text', label: 'AB' }), ['label']);
    assert.deepEqual(layers({ content: 'icon' }), ['icon']);
    assert.deepEqual(layers({ content: 'text', label: '' }), [], 'an empty label asks for no layer');
});

test('the initials hold the label text', () => {
    const initials = instanceFor(model, { content: 'text', label: 'AB' }).find(n => n.name === 'label');
    assert.equal(initials.text, 'AB');
});

test('the root is a square box of the Size token on both axes, the radius is the Shape token', () => {
    const root = instanceFor(model, { content: 'text', label: 'A' })[0];
    const value = (id) => variableValue(model.variables, model.variables.items.find(i => i.id === id), c => c.modes[0].id);
    assert.equal(root.layoutSizingH, 'fixed');
    assert.equal(root.layoutSizingV, 'fixed');
    assert.equal(value(root.vars.w), value(root.vars.h), 'width and height read the same token');
    assert.ok(value(root.vars.radius) >= value(root.vars.w) / 2, 'circle by default: radius at least half the box');
});

test('antd sizes: 24 / 32 / 40 across the Size modes, the middle one is 32', () => {
    const sizeCollection = model.variables.collections.find(c => c.name === 'Avatar Size');
    const item = model.variables.items.find(i => i.collectionId === sizeCollection.id && i.name === 'avatarSize');
    const byMode = Object.fromEntries(sizeCollection.modes.map(m => [m.name, variableValue(model.variables, item, c => (c.id === sizeCollection.id ? m.id : c.modes[0].id))]));
    assert.equal(byMode.md, 32);
    assert.deepEqual([byMode.xs, byMode.lg], [24, 40]);
    assert.ok(byMode.xs <= byMode.sm && byMode.sm <= byMode.md && byMode.md <= byMode.lg && byMode.lg <= byMode.xl);
});

test('the export has the initials and no problems; the document has no part missing or error', () => {
    const out = generateComponent(avatar, model.binding, model.variables, 'Avatar', model.frame, id => model.created.filter(n => n.parentId === id));
    assert.deepEqual(out.problems, []);
    assert.match(out.files['Avatar.jsx'], /label/);
    const doc = { variables: model.variables, pages: [{ name: 'p', nodes: [model.frame, ...model.created] }] };
    assert.deepEqual(diagnoseDocument(doc).filter(f => f.severity === 'error' || f.code === 'part-missing'), []);
});

test('Color is the eight presets like Tag: its modes are the presets and the preset tokens live in the Color collection', () => {
    assert.deepEqual(avatar.props.color.modes, COLOR_PRESETS);
    const colors = model.variables.collections.find(c => c.name === 'Avatar Color');
    assert.ok(colors, 'Avatar Color collection');
    assert.deepEqual(colors.modes.map(m => m.name), COLOR_PRESETS);
    for (const name of ['color-bg', 'color-solid', 'color-text', 'color-solid-text']) assert.ok(model.variables.items.some(i => i.collectionId === colors.id && i.name === name), name);
});
test('Variant is filled | solid like Tag: filled reads the preset subtle fill and text colour, solid its solid fill and solid text', () => {
    assert.deepEqual(avatar.props.variant.modes, ['filled', 'solid']);
    const variants = model.variables.collections.find(c => c.name === 'Avatar Variant');
    assert.ok(variants, 'Avatar Variant collection');
    assert.deepEqual(variants.modes.map(m => m.name), ['filled', 'solid']);
    const root = instanceFor(model, { content: 'text', label: 'A' })[0];
    const bg = model.variables.items.find(i => i.id === root.vars['fills.0']);
    assert.equal(bg?.name, 'bg');
    assert.equal(bg.collectionId, variants.id);
});
