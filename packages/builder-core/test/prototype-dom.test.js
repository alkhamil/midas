import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { TEMPLATES, BEHAVIOR_DATA_VERSION } from '../src/index.js';

const button = TEMPLATES.get('button');

/** A variable collection and items for every token of Button, so the codegen stylesheet resolves without problems. */
function buttonVariables() {
    const modes = { variant: ['primary', 'danger'], size: ['sm', 'lg'] };
    const collections = [
        { id: 'c-variant', name: 'Variant', modes: modes.variant.map(id => ({ id, name: id })) },
        { id: 'c-size', name: 'Size', modes: modes.size.map(id => ({ id, name: id })) },
    ];
    const items = [];
    for (const [group, names] of Object.entries(button.tokens)) {
        const dim = group.includes('Size') || group === 'fromSize' ? 'size' : 'variant';
        for (const token of names) {
            const isColor = !['fontSize', 'lineHeight', 'paddingX', 'paddingY', 'gap', 'radius', 'iconSize'].includes(token);
            const values = Object.fromEntries(modes[dim].map(m => [m, isColor ? '#4338ca' : token === 'lineHeight' ? 20 : 12]));
            items.push({ id: `i-${token}`, name: `button/${token}`, type: isColor ? 'color' : 'number', collectionId: dim === 'variant' ? 'c-variant' : 'c-size', values });
        }
    }
    return { collections, items };
}

const variables = buttonVariables();
const buttonMaster = { id: 'btn', name: 'Button', type: 'frame', parentId: null, component: true, layout: 'horizontal', gap: 6, padding: 12, fill: '#0058CA', radius: 8, behavior: { version: BEHAVIOR_DATA_VERSION, templateId: 'button', variables: { variant: 'c-variant', size: 'c-size' } } };
const doc = nodes => ({ pages: [{ id: 'p', name: 'Screens', nodes }], variables });
const frame = (id, extra = {}) => ({ id, name: id, type: 'frame', parentId: null, x: 0, y: 0, w: 200, h: 100, fill: '#ffffff', ...extra });
const child = (id, parentId, extra = {}) => ({ id, name: id, type: 'rect', parentId, x: 0, y: 0, w: 40, h: 20, fill: '#ff0000', ...extra });

test('an auto layout frame is a flex container with its direction, gap and padding; its children are flow items', () => {
    const d = doc([frame('A', { layout: 'horizontal', gap: 8, padding: 4 }), child('a', 'A')]);
    const { root } = toDomTree(d, 'A');
    assert.equal(root.style.display, 'flex');
    assert.equal(root.style.flexDirection, 'row');
    assert.equal(root.style.gap, '8px');
    assert.equal(root.style.padding, '4px');
    assert.equal(root.children[0].style.position, undefined);
    assert.equal(root.children[0].style.left, undefined);
});

test('a vertical auto layout frame stacks its children in a column', () => {
    const { root } = toDomTree(doc([frame('A', { layout: 'vertical' }), child('a', 'A')]), 'A');
    assert.equal(root.style.flexDirection, 'column');
});

test('an absolutely positioned child of an auto layout frame keeps its place', () => {
    const { root } = toDomTree(doc([frame('A', { layout: 'horizontal' }), child('badge', 'A', { layoutPositioning: 'absolute', x: 150, y: 4, w: 16, h: 16 })]), 'A');
    assert.deepEqual([root.children[0].style.position, root.children[0].style.left, root.children[0].style.top], ['absolute', '150px', '4px']);
    assert.equal(root.children[0].style.width, '16px');
    assert.equal(root.children[0].style.height, '16px');
});

test('a child of a frame that is not auto layout is placed absolutely at its x and y', () => {
    const { root } = toDomTree(doc([frame('A'), child('a', 'A', { x: 10, y: 20, w: 30, h: 40 })]), 'A');
    assert.equal(root.style.position, 'relative');
    assert.deepEqual([root.children[0].style.position, root.children[0].style.left, root.children[0].style.top], ['absolute', '10px', '20px']);
});

test('a rectangle draws its fill, radius, opacity, and a border from its stroke', () => {
    const { root } = toDomTree(doc([frame('A'), child('r', 'A', { fill: '#112233', radius: 6, opacity: 0.5, stroke: '#000000', strokeWidth: 2, strokeAlign: 'inside' })]), 'A');
    const style = root.children[0].style;
    assert.equal(style.background, '#112233');
    assert.equal(style.borderRadius, '6px');
    assert.equal(style.opacity, '0.5');
    assert.equal(style.border, '2px solid #000000');
});

test('no stroke width or a hidden stroke draws no border', () => {
    const none = toDomTree(doc([frame('A'), child('r', 'A', { stroke: '#000000', strokeWidth: 0 })]), 'A').root.children[0];
    const hidden = toDomTree(doc([frame('A'), child('r', 'A', { stroke: '#000000', strokeWidth: 2, strokeVisible: false })]), 'A').root.children[0];
    assert.equal(none.style.border, undefined);
    assert.equal(hidden.style.border, undefined);
});

test('an ellipse is a rectangle with a fully round radius', () => {
    const { root } = toDomTree(doc([frame('A'), child('e', 'A', { type: 'ellipse', radius: 0 })]), 'A');
    assert.equal(root.children[0].style.borderRadius, '50%');
});

test('a text layer is a span with its characters, font, colour and line height as a ratio of the font size', () => {
    const text = { id: 't', name: 'Title', type: 'text', parentId: 'A', x: 0, y: 0, w: 120, h: 30, text: 'Hello', fontFamily: 'Inter', fontSize: 16, fontWeight: 700, lineHeight: 1.5, fill: '#20202a', textAlign: 'center' };
    const { root } = toDomTree(doc([frame('A'), text]), 'A');
    const span = root.children[0];
    assert.equal(span.tag, 'span');
    assert.equal(span.text, 'Hello');
    assert.equal(span.style.fontSize, '16px');
    assert.equal(span.style.fontWeight, '700');
    assert.equal(span.style.fontFamily, 'Inter');
    assert.equal(span.style.color, '#20202a');
    assert.equal(span.style.lineHeight, '1.5');
    assert.equal(span.style.textAlign, 'center');
});

test('the root frame is reported with its node id, and unknown types are listed rather than drawn silently', () => {
    const result = toDomTree(doc([frame('A'), child('p', 'A', { type: 'path' })]), 'A');
    assert.equal(result.root.nodeId, 'A');
    assert.deepEqual(result.unsupported, [{ nodeId: 'p', type: 'path' }]);
});

test('a frame id that is not a top-level frame is refused', () => {
    assert.throws(() => toDomTree(doc([frame('A'), child('a', 'A')]), 'a'), /not a top-level frame/);
    assert.throws(() => toDomTree(doc([frame('A')]), 'Z'), /not a top-level frame/);
});

test('a Button instance is a real button with the codegen classes, mode attributes and its label', () => {
    const instance = { id: 'i1', name: 'Save', type: 'frame', parentId: null, x: 0, y: 0, w: 120, h: 40, isInstance: true, sourceId: 'btn', behavior: { version: BEHAVIOR_DATA_VERSION, props: { label: 'Save', disabled: false, hasIcon: false, iconPlacement: 'start' } }, varModes: { 'c-variant': 'danger', 'c-size': 'lg' } };
    const d = { pages: [{ id: 'p', name: 'Screens', nodes: [buttonMaster, instance] }], variables };
    const { root, styles } = toDomTree(d, 'i1');
    assert.equal(root.tag, 'button');
    assert.equal(root.attrs.class, 'button');
    assert.equal(root.attrs['data-variant'], 'danger');
    assert.equal(root.attrs['data-size'], 'lg');
    assert.equal(root.attrs.disabled, undefined);
    assert.equal(root.attrs['aria-disabled'], undefined);
    assert.deepEqual(root.children.map(c => [c.tag, c.attrs.class, c.text]), [['span', 'button-label', 'Save']]);
    assert.match(styles, /\.button\[data-variant="danger"\]\[data-size="lg"\]/);
});

test('a disabled Button instance is disabled, and the icon is shown only for its placement', () => {
    const instance = { id: 'i2', name: 'Next', type: 'frame', parentId: null, x: 0, y: 0, w: 120, h: 40, isInstance: true, sourceId: 'btn', behavior: { version: BEHAVIOR_DATA_VERSION, props: { label: 'Next', disabled: true, hasIcon: true, iconPlacement: 'end', icon: '' } }, varModes: { 'c-variant': 'primary', 'c-size': 'sm' } };
    const d = { pages: [{ id: 'p', name: 'Screens', nodes: [buttonMaster, instance] }], variables };
    const { root } = toDomTree(d, 'i2');
    assert.equal(root.attrs.disabled, true);
    assert.equal(root.attrs['aria-disabled'], 'true');
    assert.deepEqual(root.children.map(c => c.attrs.class), ['button-label', 'button-iconEnd']);
});

test('a Button instance whose master has no variable binding is refused with its problems, not drawn', () => {
    const unbound = { ...buttonMaster, behavior: { version: BEHAVIOR_DATA_VERSION, templateId: 'button', variables: {} } };
    const instance = { id: 'i3', name: 'Broken', type: 'frame', parentId: null, x: 0, y: 0, w: 120, h: 40, isInstance: true, sourceId: 'btn', behavior: { version: BEHAVIOR_DATA_VERSION, props: { label: 'Broken', disabled: false, hasIcon: false, iconPlacement: 'start' } } };
    const result = toDomTree({ pages: [{ id: 'p', name: 'Screens', nodes: [unbound, instance] }], variables }, 'i3');
    assert.equal(result.root, null);
    assert.ok(result.problems.length > 0);
});

test('a hugging child of an auto layout column is not stretched across the column (align-self flex-start)', () => {
    const { root } = toDomTree(doc([frame('A', { layout: 'vertical' }), child('hug', 'A', { layoutSizingH: 'hug', layoutSizingV: 'hug' }), child('fill', 'A', { layoutSizingH: 'fill' })]), 'A');
    assert.equal(root.children[0].style.alignSelf, 'flex-start');
    assert.equal(root.children[1].style.alignSelf, 'stretch', 'a fill child stretches across the column');
});

test('a Button instance inside an auto layout frame keeps its place in the flow, and is not stretched', () => {
    const instance = { id: 'i4', name: 'Save', type: 'frame', parentId: 'A', x: 0, y: 0, w: 120, h: 40, layoutSizingH: 'hug', layoutSizingV: 'hug', isInstance: true, sourceId: 'btn', behavior: { version: BEHAVIOR_DATA_VERSION, props: { label: 'Save', disabled: false, hasIcon: false } }, varModes: { 'c-variant': 'primary', 'c-size': 'sm' } };
    const d = { pages: [{ id: 'p', name: 'Screens', nodes: [frame('A', { layout: 'vertical' }), buttonMaster, instance] }], variables };
    const { root } = toDomTree(d, 'A');
    assert.equal(root.children[0].tag, 'button');
    assert.equal(root.children[0].style.alignSelf, 'flex-start');
    assert.equal(root.children[0].style.position, undefined);
});

test('without the responsive flag the output is the same as before', () => {
    const d = doc([frame('A', { layout: 'vertical' }), child('a', 'A', { layoutSizingH: 'fill' })]);
    assert.deepEqual(toDomTree(d, 'A', { responsive: false }), toDomTree(d, 'A'));
});

test('responsive: the top-level frame takes the viewport width and height, whatever its sizing', () => {
    const { root } = toDomTree(doc([frame('A', { layout: 'vertical', layoutSizingV: 'hug' })]), 'A', { responsive: true });
    assert.equal(root.style.width, '100%');
    assert.equal(root.style.height, '100%');
});

test('responsive: a child filling the column stretches across it, and a hugging or fixed child keeps its size rules', () => {
    const d = doc([frame('A', { layout: 'vertical' }), child('fill', 'A', { layoutSizingH: 'fill', layoutSizingV: 'fixed', w: 40, h: 20 }), child('hug', 'A', { layoutSizingH: 'hug', layoutSizingV: 'hug' }), child('fixed', 'A', { layoutSizingH: 'fixed', w: 60, h: 20 })]);
    const { root } = toDomTree(d, 'A', { responsive: true });
    assert.equal(root.children[0].style.width, undefined);
    assert.equal(root.children[0].style.alignSelf, 'stretch');
    assert.equal(root.children[0].style.height, '20px');
    assert.equal(root.children[1].style.width, undefined);
    assert.equal(root.children[1].style.alignSelf, 'flex-start');
    assert.equal(root.children[2].style.width, '60px');
});

test('responsive: an absolutely positioned child keeps its x and y and fixed size (no constraints are modelled yet)', () => {
    const d = doc([frame('A', { layout: 'vertical' }), child('badge', 'A', { layoutPositioning: 'absolute', x: 150, y: 4, w: 16, h: 16 })]);
    const badge = toDomTree(d, 'A', { responsive: true }).root.children[0];
    assert.deepEqual([badge.style.position, badge.style.left, badge.style.top, badge.style.width], ['absolute', '150px', '4px', '16px']);
});

test('a text layer takes its fill as its text colour and never as a background', () => {
    const { root } = toDomTree(doc([frame('A'), child('t', 'A', { type: 'text', text: 'Hi', fill: '#112233', w: 80, h: 20 })]), 'A');
    const span = root.children[0];
    assert.equal(span.style.color, '#112233');
    assert.equal(span.style.background, undefined);
});

test('a text layer gets no radius, border or shadow box, even when the node carries them', () => {
    const text = child('t', 'A', { type: 'text', text: 'Hi', fill: '#112233', radius: 8, stroke: '#000000', strokeWidth: 2, shadow: true, shadowX: 0, shadowY: 4 });
    const style = toDomTree(doc([frame('A'), text]), 'A').root.children[0].style;
    assert.deepEqual([style.borderRadius, style.border, style.boxShadow], [undefined, undefined, undefined]);
});

test('a text fill opacity is the alpha of the text colour', () => {
    const { root } = toDomTree(doc([frame('A'), child('t', 'A', { type: 'text', text: 'Hi', fill: '#112233', fillOpacity: 0.5 })]), 'A');
    assert.equal(root.children[0].style.color, '#11223380');
});

test('a text layer with no fill draws no colour, as the canvas does', () => {
    const { root } = toDomTree(doc([frame('A'), child('t', 'A', { type: 'text', text: 'Hi', fill: 'none' })]), 'A');
    assert.equal(root.children[0].style.color, 'transparent');
});

test('a text layer that hugs its width has no fixed width', () => {
    const { root } = toDomTree(doc([frame('A'), child('t', 'A', { type: 'text', text: 'Hi', layoutSizingH: 'hug', w: 80, h: 20 })]), 'A');
    assert.equal(root.children[0].style.width, undefined);
});

test('a text layer with several styles draws one span per style, each with its own font and colour', () => {
    const spans = [
        { text: 'Bold ', fontWeight: 700, fill: '#ff0000', fillOpacity: 1 },
        { text: 'plain', fill: '#112233', fillOpacity: 0.5, textDecoration: 'underline', fontStyle: 'italic', fontSize: 20 },
    ];
    const { root } = toDomTree(doc([frame('A'), child('t', 'A', { type: 'text', text: 'Bold plain', spans, fontSize: 14 })]), 'A');
    const [first, second] = root.children[0].children;
    assert.deepEqual([first.text, first.style.fontWeight, first.style.color], ['Bold ', '700', '#ff0000']);
    assert.deepEqual([second.text, second.style.color, second.style.textDecoration, second.style.fontStyle, second.style.fontSize], ['plain', '#11223380', 'underline', 'italic', '20px']);
    assert.equal(root.children[0].text, undefined);
});

test('Play ignores a scroll behaviour on a template instance: it clips on both axes', () => {
    const master = { id: 'M', name: 'Card', type: 'frame', parentId: null };
    const instance = { id: 'I', name: 'Card copy', type: 'frame', parentId: null, isInstance: true, sourceId: 'M', w: 200, h: 100, prototype: { version: 1, interactions: [], overflow: 'both' } };
    const { root } = toDomTree(doc([frame('A'), master, instance]), 'I');
    assert.deepEqual([root.style.overflowX, root.style.overflowY], ['hidden', 'hidden']);
});
