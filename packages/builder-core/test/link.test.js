// Link (antd Typography.Link): Text that is an anchor. href is a text prop that Play and the export write on the element (the canvas has none); hover, focus and pressed
// recolour the text by tokens; a disabled link has no href and does not hover; the type colours keep their own hover colours.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { previewOf } from '../src/behavior-engine/preview.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { TEXT_TYPES } from '../src/templates/typography-base.js';
import { modelFor, instanceFor } from './helpers/box-template.js';
import { elementsOf } from './helpers/play-compute.js';

const link = TEMPLATES.get('antd-link');
const model = modelFor(link);
const exported = generateComponent(model.template, model.binding, model.variables, 'Link', model.frame, id => model.created.filter(n => n.parentId === id));
const collectionOf = prop => model.variables.collections.find(c => c.id === model.binding.variables[prop]);
const modeId = (prop, name) => collectionOf(prop).modes.find(m => m.name === name).id;

function playOf(props) {
    const nodes = instanceFor(model, props);
    nodes[0].varModes = { [model.binding.variables.type]: modeId('type', 'default'), [model.binding.variables.size]: modeId('size', 'md') };
    nodes[0].parentId = 'top';
    const top = { id: 'top', name: 'Top', type: 'frame', parentId: null, layout: 'vertical', x: 0, y: 0, w: 400, h: 400, fills: [], layoutSizingH: 'hug', layoutSizingV: 'hug' };
    const { root, styles, problems } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [top, model.frame, ...model.created, ...nodes] }], variables: model.variables }, 'top');
    assert.deepEqual(problems, []);
    const found = elementsOf(root);
    return { styles, root: found.find(({ el }) => el.attrs?.class === 'antd-link').el, label: found.find(({ el }) => el.attrs?.class === 'antd-link-label').el };
}

test('Link is registered: the Text props and an href, on an anchor element', () => {
    assert.ok(link);
    assert.deepEqual(validateTemplateSchema(link), []);
    assert.equal(link.element.tag, 'a');
    assert.deepEqual(Object.keys(link.props).filter(p => link.props[p].source === 'literal'), ['label', 'strong', 'italic', 'underline', 'strikethrough', 'code', 'mark', 'disabled', 'href']);
});

test('href has no effect on the canvas: the instance holds the same layers and fields with or without it', () => {
    const strip = nodes => nodes.map(({ id, parentId, ...rest }) => rest);
    assert.deepEqual(strip(instanceFor(model, { href: 'https://example.com' }).map(n => ({ ...n, id: 'x', parentId: 'x' }))).map(n => n.name), ['Link', 'label']);
    assert.equal(instanceFor(model, { href: 'https://example.com' }).find(n => n.name === 'label').text, 'Link');
});

test('Play writes the href on the anchor, and none while the href is empty or the link is disabled', () => {
    assert.equal(playOf({ href: 'https://example.com' }).root.tag, 'a');
    assert.equal(playOf({ href: 'https://example.com' }).root.attrs.href, 'https://example.com');
    assert.equal(playOf({}).root.attrs.href, undefined);
    assert.equal(playOf({ href: 'https://example.com', disabled: true }).root.attrs.href, undefined);
    assert.equal(playOf({ href: 'https://example.com', disabled: true }).root.attrs['aria-disabled'], 'true', 'a disabled link says so, and the stylesheet\'s disabled rule and hover guard read it');
});

test('the export is clean, takes href, and drops it while disabled', () => {
    assert.deepEqual(generateComponent(model.template, model.binding, model.variables, 'Link', model.frame, id => model.created.filter(n => n.parentId === id)).problems, []);
    const jsx = exported.files['Link.jsx'];
    assert.match(jsx, /<a\s/);
    assert.match(jsx, /href=\{disabled \? undefined : href \|\| undefined\}/);
    assert.match(jsx, /aria-disabled=\{disabled \|\| undefined\}/);
});

test('hover, focus and pressed recolour the text by tokens, in the export and Play; a disabled link does not, and the canvas is static', () => {
    const css = exported.files['Link.css'];
    assert.match(css, /\.antd-link\[data-type="[^"]*"\]\[data-size="[^"]*"\]:hover:not\(\[aria-disabled="true"\]\) \{\s*--antd-link-fg: #[0-9a-f]{6,8};/);
    assert.match(css, /:focus-visible:not\(\[aria-disabled="true"\]\) \{\s*--antd-link-fg:/);
    assert.match(css, /:active:not\(\[aria-disabled="true"\]\) \{\s*--antd-link-fg:/);
    const [, label] = instanceFor(model, {});
    assert.equal(Object.values(label.vars ?? {}).includes(model.variables.items.find(i => i.name === 'fg-hover')?.id), false, 'the canvas binds the rest colour only');
    // Play draws the text's colour from the stylesheet, so the hover rule can win over it.
    assert.equal(playOf({}).label.style.color, undefined);
    assert.match(playOf({}).styles, /\.antd-link-label \{[^}]*color: var\(--antd-link-fg\);/);
});

test('the link colour is the default Type; hover and pressed move to their own tokens, for every type', () => {
    const colour = (type, state) => {
        const modes = { type: modeId('type', type), size: modeId('size', 'md') };
        return previewOf(link, model.binding, modes, model.variables, resolveProps(link, {}), state).vars['--antd-link-fg'];
    };
    const resting = TEXT_TYPES.map(type => colour(type, 'default'));
    assert.equal(new Set(resting).size, 5, 'five type colours');
    for (const type of ['default', 'success', 'warning', 'danger']) {
        assert.notEqual(colour(type, 'hover'), colour(type, 'default'), `${type} hovers to another colour`);
    }
    assert.notEqual(colour('default', 'active'), colour('default', 'hover'), 'pressed is not the hover colour');
});

test('the anchor draws no underline of its own: the underline prop draws it on the label', () => {
    const css = exported.files['Link.css'];
    assert.match(css, /\.antd-link \{[^}]*text-decoration: none;/);
    assert.match(css, /\.antd-link\[data-underline\] \.antd-link-label \{\s*text-decoration: underline;/);
});

test('Link adds no layer: the instance holds the root and its label, whatever the styles and the href', () => {
    for (const props of [{}, { href: 'x', underline: true, strong: true, code: true, mark: true, disabled: true }]) assert.deepEqual(instanceFor(model, props).map(n => n.name), ['Link', 'label']);
});
