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
import { valueProblem } from '../src/behavior-engine/instance-props.js';
import { instancePanel } from '../src/behavior-engine/panel.js';
import { nodeFieldPatch } from '../src/behavior-engine/display.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { COLOR_PRESETS } from '../src/templates/color-presets.js';

const avatar = TEMPLATES.get('antd-avatar');
const model = modelFor(avatar);
const layers = props => instanceFor(model, props).slice(1).map(n => n.name);

test('Avatar is registered with Shape, Size and content props', () => {
    assert.ok(avatar, 'Avatar is in the registry');
    assert.equal(avatar.primarySlot, 'label');
    assert.deepEqual(avatar.props.shape.modes, ['circle', 'square']);
    assert.deepEqual(avatar.props.size.modes, SIZE_MODES);
    assert.deepEqual(avatar.props.content.options, ['text', 'icon', 'image']);
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

// Stage 2: the image content. The `src` prop (an uploaded asset on the canvas and in Play, a URL in the export) is a fill on the root, over the colour.
// The studio gives a bound master root its colour fill before any instance is made; the helper's frame has none yet.
const coloured = modelFor(avatar);
coloured.frame.fills = [{ type: 'solid', color: '#808080', opacity: 1, visible: true }];
const imageFillsOf = (props) => instanceFor(coloured, props)[0].fills.filter(f => f.type === 'image');
const solidOf = (props) => instanceFor(coloured, props)[0].fills.find(f => f.type === 'solid');

test('content image: no text or icon layer, the root holds the asset as an image fill after its colour fill, which no fill hides', () => {
    assert.deepEqual(avatar.props.content.options, ['text', 'icon', 'image']);
    assert.equal(avatar.props.src.type, 'image');
    assert.deepEqual(layers({ content: 'image', src: 'asset-1', label: 'AB' }), []);
    const fills = imageFillsOf({ content: 'image', src: 'asset-1' });
    assert.equal(fills.length, 1);
    assert.deepEqual([fills[0].image, fills[0].mode, fills[0].visible], ['asset-1', 'fill', true]);
    assert.notEqual(solidOf({ content: 'image', src: 'asset-1' }).visible, false, 'no fill is hidden: the colour fill is the fallback under the picture');
});

test('no image fill without a src or when the content is not image; the colour fill shows again', () => {
    for (const props of [{ content: 'image', src: null }, { content: 'text', label: 'A', src: 'asset-1' }, { content: 'icon', src: 'asset-1' }]) {
        assert.equal(imageFillsOf(props).length, 0, JSON.stringify(props));
        assert.notEqual(solidOf(props).visible, false, JSON.stringify(props));
    }
});

test('an image prop stores an asset id or nothing, nothing else', () => {
    assert.equal(valueProblem(avatar.props.src, null), null);
    assert.equal(valueProblem(avatar.props.src, 'asset-1'), null);
    assert.match(valueProblem(avatar.props.src, 3), /asset/);
});

test('Play draws the image through the root: a data attribute and the asset as its background image, whatever the size', () => {
    const nodes = instanceFor(model, { content: 'image', src: 'asset-1' });
    const assets = { 'asset-1': 'data:image/png;base64,AAAA' };
    const { root, problems } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, ...nodes] }], variables: model.variables, assets }, nodes[0].id);
    assert.deepEqual(problems, []);
    assert.ok('data-src' in root.attrs);
    assert.equal(root.style.backgroundImage, 'url("data:image/png;base64,AAAA")', 'a custom property would be dropped above about 2 MB');
    assert.equal(root.style['--antd-avatar-src'], undefined);
    const none = instanceFor(model, { content: 'text', label: 'A' });
    const plain = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, ...none] }], variables: model.variables, assets }, none[0].id).root;
    assert.ok(!('data-src' in plain.attrs));
    assert.equal(plain.style.backgroundImage, undefined);
});

test('the export takes src as a URL string, writes it as the root custom property and the stylesheet draws it over the colour of the box', () => {
    const out = generateComponent(avatar, model.binding, model.variables, 'Avatar', model.frame, id => model.created.filter(n => n.parentId === id));
    assert.deepEqual(out.problems, []);
    assert.match(out.files['Avatar.jsx'], /'--antd-avatar-src': src \? `url\("\$\{src\}"\)` : undefined/);
    assert.match(out.files['Avatar.jsx'], /data-src=\{src \? "" : undefined\}/);
    assert.match(out.files['Avatar.css'], /\.antd-avatar\[data-src\] \{[^}]*background-image: var\(--antd-avatar-src\);[^}]*background-size: cover;[^}]*background-position: center;/);
    assert.doesNotMatch(out.files['Avatar.css'], /\.antd-avatar\[data-src\] \{[^}]*background-color: transparent/, 'the colour of the box stays under the picture');
});

test('the Behavior panel offers an image row for src while the content is image, with the chosen asset', () => {
    const rows = panelRows(avatar, { content: 'image', src: 'asset-1' });
    const row = rows.find(r => r.prop === 'src');
    assert.deepEqual([row.kind, row.value], ['image', 'asset-1']);
    assert.equal(panelRows(avatar, { content: 'text' }).some(r => r.prop === 'src'), false, 'hidden for the other contents');
});

/** The rows of the instance panel under these props. */
function panelRows(template, props) {
    return instancePanel({ behavior: { props } }, model.frame, model.variables.collections, {}).rows;
}

test('a picture the node already has keeps its own settings: a new asset changes the asset only', () => {
    const base = coloured.frame;
    const own = { type: 'image', image: 'asset-1', mode: 'fit', scale: 2, opacity: 0.5, visible: false };
    const patch = nodeFieldPatch('imageFill', 'asset-2', 'frame', { fills: [...base.fills, own] });
    assert.deepEqual(patch.fills.filter(f => f.type === 'image'), [{ ...own, image: 'asset-2' }]);
    assert.deepEqual(nodeFieldPatch('imageFill', 'asset-2', 'frame', { fills: [...base.fills, own] }), patch, 'the same write twice is the same fills');
    assert.equal(nodeFieldPatch('imageFill', null, 'frame', { fills: [...base.fills, own] }).fills.some(f => f.type === 'image'), false, 'no asset removes it');
});
