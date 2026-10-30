import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { TEMPLATES, BEHAVIOR_DATA_VERSION } from '../src/index.js';
import { buttonModel } from '../../../scripts/button-model.mjs';

const button = TEMPLATES.get('button');
const model = buttonModel({
    colors: ['primary'],
    variantModes: ['solid'],
    sizeModes: [{ id: 'sm', name: 'Small' }],
});
const variables = { collections: model.collections, items: model.items };
const bindingVars = model.binding.variables;

const master = (over = {}) => ({
    id: 'm', name: 'Button', type: 'frame', parentId: null, component: true,
    layout: 'horizontal', gap: 6, padding: 12, fills: [],
    behavior: { version: BEHAVIOR_DATA_VERSION, templateId: 'button', variables: bindingVars },
    ...over,
});
const labelLayer = (parentId, over = {}) => ({
    id: `${parentId}-label`, name: 'label', type: 'text', parentId,
    text: 'Save', x: 0, y: 0, w: 80, h: 20, fills: [],
    ...over,
});
const instance = (over = {}) => ({
    id: 'i', name: 'Save', type: 'frame', parentId: null, x: 0, y: 0, w: 140, h: 40,
    isInstance: true, sourceId: 'm',
    behavior: { version: BEHAVIOR_DATA_VERSION, props: { label: 'Save' } },
    ...over,
});
const doc = nodes => ({ pages: [{ id: 'p', name: 'Screens', nodes }], variables });
const kids = nodes => id => nodes.filter(n => n.parentId === id);
const labelOf = root => root.children.find(c => c.attrs?.class === 'button-label');

test('Play draws a centered Button as a flex row with a fill label and centered text', () => {
    const m = master({ primaryAlign: 'center', counterAlign: 'center' });
    const { root } = toDomTree(doc([m, labelLayer('m', { layoutSizingH: 'fill', textAlign: 'center' }), labelLayer('i', { layoutSizingH: 'fill', textAlign: 'center' }), instance()]), 'i');
    assert.deepEqual([root.style.display, root.style.flexDirection, root.style.justifyContent, root.style.alignItems], ['flex', 'row', 'center', 'center']);
    const label = labelOf(root);
    assert.ok(label, 'expected a label element');
    assert.deepEqual([label.style.flex, label.style.textAlign], ['1 1 0', 'center']);
});

test('Play draws a left-aligned Button with the label at the row start', () => {
    const m = master({ primaryAlign: 'start', counterAlign: 'center' });
    const { root } = toDomTree(doc([m, labelLayer('m', { layoutSizingH: 'fill', textAlign: 'left' }), labelLayer('i', { layoutSizingH: 'fill', textAlign: 'left' }), instance()]), 'i');
    assert.equal(root.style.justifyContent, 'flex-start');
    assert.equal(labelOf(root).style.textAlign, 'left');
});

test('Play justifies the root from the master, including end and column', () => {
    const end = toDomTree(doc([master({ primaryAlign: 'end', counterAlign: 'center' }), labelLayer('m', { layoutSizingH: 'hug' }), labelLayer('i', { layoutSizingH: 'hug' }), instance()]), 'i').root;
    assert.equal(end.style.justifyContent, 'flex-end');
    const column = toDomTree(doc([master({ layout: 'vertical', primaryAlign: 'center', counterAlign: 'end' }), labelLayer('m', { layoutSizingH: 'hug' }), instance()]), 'i').root;
    assert.deepEqual([column.style.flexDirection, column.style.justifyContent, column.style.alignItems], ['column', 'center', 'flex-end']);
});

test('a hug or fixed label keeps its size and never squeezes, in Play', () => {
    const hug = toDomTree(doc([master({}), labelLayer('m', { layoutSizingH: 'hug', w: 60, textAlign: 'left' }), labelLayer('i', { layoutSizingH: 'hug', w: 60, textAlign: 'left' }), instance()]), 'i').root;
    assert.deepEqual([labelOf(hug).style.flex, labelOf(hug).style.flexShrink], [undefined, '0']);
    const fixed = toDomTree(doc([master({}), labelLayer('m', { layoutSizingH: 'fixed', w: 80, textAlign: 'right' }), labelLayer('i', { layoutSizingH: 'fixed', w: 80, textAlign: 'right' }), instance()]), 'i').root;
    assert.deepEqual([labelOf(fixed).style.flex, labelOf(fixed).style.flexShrink, labelOf(fixed).style.textAlign], [undefined, '0', 'right']);
});

test('Play draws the icon beside the label, and both icons with placement both', () => {
    const icon = { id: 'ic', name: 'Icon/check', type: 'frame', parentId: null, x: 0, y: 0, w: 24, h: 24, component: true, fills: [] };
    const iconPath = { id: 'ic-p', name: 'check', type: 'path', parentId: 'ic', x: 0, y: 0, w: 24, h: 24, pathW: 24, pathH: 24, closed: true, points: [{ x: 4, y: 4 }, { x: 20, y: 12 }, { x: 4, y: 20 }], fills: [], stroke: '#000000', strokeWidth: 0 };
    const slot = { id: 'i-icon', name: 'iconStart', type: 'frame', parentId: 'i', x: 0, y: 0, w: 16, h: 16, fills: [], clip: true, layout: 'horizontal', behavior: { version: BEHAVIOR_DATA_VERSION, slot: 'iconStart' } };
    const nested = { id: 'nested', name: 'Icon/check', type: 'frame', parentId: 'i-icon', x: 0, y: 0, w: 16, h: 16, fills: [], isInstance: true, sourceId: 'ic', layoutSizingH: 'fill', layoutSizingV: 'fill' };
    const withIcon = instance({ behavior: { version: BEHAVIOR_DATA_VERSION, props: { label: 'Save', hasIcon: true, iconPlacement: 'start', icon: 'ic' } } });
    const seen = toDomTree(doc([master({}), labelLayer('m', { layoutSizingH: 'fill', textAlign: 'center' }), icon, iconPath, withIcon, slot, labelLayer('i', { layoutSizingH: 'fill', textAlign: 'center' }), nested]), 'i').root;
    assert.deepEqual(seen.children.map(c => c.attrs.class), ['button-iconStart', 'button-label']);
    assert.equal(labelOf(seen).style.textAlign, 'center');
    const slotEnd = { id: 'i-icon-end', name: 'iconEnd', type: 'frame', parentId: 'i', x: 0, y: 0, w: 16, h: 16, fills: [], clip: false, layout: 'horizontal', behavior: { version: BEHAVIOR_DATA_VERSION, slot: 'iconEnd' } };
    const both = toDomTree(doc([master({}), labelLayer('m', { layoutSizingH: 'fill', textAlign: 'center' }), labelLayer('i', { layoutSizingH: 'fill', textAlign: 'center' }), instance({ behavior: { version: BEHAVIOR_DATA_VERSION, props: { label: 'Save', hasIcon: true, iconPlacement: 'both', icon: 'ic' } } }), icon, iconPath, slot, slotEnd, nested]), 'i').root;
    assert.deepEqual(both.children.map(c => c.attrs.class), ['button-iconStart', 'button-label', 'button-iconEnd']);
});

test('a fill-sized icon instance stretches to its slot in Play, whatever the icon component sizes', () => {
    const icon = { id: 'ic', name: 'Icon/check', type: 'frame', parentId: null, x: 0, y: 0, w: 24, h: 24, component: true, fills: [] };
    const iconPath = { id: 'ic-p', name: 'check', type: 'path', parentId: 'ic', x: 0, y: 0, w: 24, h: 24, pathW: 24, pathH: 24, closed: true, points: [{ x: 4, y: 4 }, { x: 20, y: 12 }, { x: 4, y: 20 }], fills: [], stroke: '#000000', strokeWidth: 0 };
    const slot = { id: 'i-icon', name: 'iconStart', type: 'frame', parentId: 'i', x: 0, y: 0, w: 16, h: 16, fills: [], clip: true, layout: 'horizontal', behavior: { version: BEHAVIOR_DATA_VERSION, slot: 'iconStart' } };
    const nested = { id: 'nested', name: 'Icon/check', type: 'frame', parentId: 'i-icon', x: 0, y: 0, w: 24, h: 24, fills: [], isInstance: true, sourceId: 'ic', layoutSizingH: 'fill', layoutSizingV: 'fill' };
    const withIcon = instance({ behavior: { version: BEHAVIOR_DATA_VERSION, props: { label: 'Save', hasIcon: true, iconPlacement: 'start', icon: 'ic' } } });
    const seen = toDomTree(doc([master({}), labelLayer('m', { layoutSizingH: 'fill', textAlign: 'center' }), icon, iconPath, withIcon, slot, labelLayer('i', { layoutSizingH: 'fill', textAlign: 'center' }), nested]), 'i').root;
    const box = seen.children.find(c => c.attrs.class === 'button-iconStart');
    assert.deepEqual([box.children[0].style.flex, box.children[0].style.alignSelf], ['1 1 0', 'stretch']);
});
test('a managed icon slot adds no gap of its own in Play: the icon-label spacing is the token gap', () => {
    const path = new URL('../../../scripts/fixtures/behavior-fixture.midas', import.meta.url);
    const fixture = JSON.parse(readFileSync(path, 'utf8'));
    const { root, styles } = toDomTree(fixture, 'inst-start', {});
    const slot = root.children.find(c => c.attrs?.class === 'button-iconStart');
    assert.equal(slot.style.columnGap, '0px');
    assert.match(styles, /\.button\s*\{[^}]*gap:\s*var\(--button-gap\)/);
});
test('a hug Button keeps its own size in Play and never stretches', () => {
    const parent = { id: 'A', name: 'Row', type: 'frame', parentId: null, x: 0, y: 0, w: 400, h: 100, fills: [], layout: 'horizontal' };
    const hug = instance({ parentId: 'A', layoutSizingH: 'hug', layoutSizingV: 'hug' });
    const { root } = toDomTree(doc([parent, master({}), labelLayer('m', { layoutSizingH: 'fill', textAlign: 'center' }), hug]), 'A');
    const btn = root.children.find(c => c.nodeId === 'i');
    assert.deepEqual([btn.style.flex, btn.style.alignSelf, btn.style.width, btn.style.flexShrink], [undefined, undefined, undefined, '0']);
});

test('the export lays the root out like the canvas frame, as inline-flex', () => {
    const nodes = [master({ primaryAlign: 'center', counterAlign: 'center' }), labelLayer('m', { layoutSizingH: 'fill', textAlign: 'center' })];
    const css = generateComponent(button, model.binding, variables, 'Button', nodes[0], kids(nodes)).files['Button.css'];
    assert.match(css, /\.button \{\n  display: inline-flex;\n  flex-direction: row;\n(?:.*\n)*?\s*justify-content: center;\n(?:.*\n)*?\s*align-items: center;\n/);
    assert.doesNotMatch(css, /display: flex;/);
    assert.match(css, /\.button-label \{\n(?:.*\n)*?\s*flex: 1 1 0;\n(?:.*\n)*?\s*text-align: center;\n/);
});

test('absent master alignments export as the start, and a hug label keeps its size', () => {
    const nodes = [master({}), labelLayer('m', { layoutSizingH: 'hug', w: 60, textAlign: 'left' })];
    const css = generateComponent(button, model.binding, variables, 'Button', nodes[0], kids(nodes)).files['Button.css'];
    assert.match(css, /\.button \{\n(?:.*\n)*?\s*justify-content: flex-start;\n(?:.*\n)*?\s*align-items: flex-start;\n/);
    assert.match(css, /\.button \{\n(?:.*\n)*?\s*gap: var\(--button-gap\);\n/);
    assert.doesNotMatch(css, /^ {2}gap: \d+px;/m);
    assert.doesNotMatch(css, /^ {2}padding: \d+px/m);
    const labelBlock = /\.button-label \{(.*?)\}/s.exec(css)[1];
    assert.match(labelBlock, /flex-shrink: 0;/);
    assert.match(labelBlock, /text-align: left;/);
    assert.doesNotMatch(labelBlock, /flex: 1 1 0;/);
});

test('a hug Button exports no width of its own: inline-flex keeps it natural', () => {
    const nodes = [master({ primaryAlign: 'center', counterAlign: 'center' }), labelLayer('m', { layoutSizingH: 'hug', textAlign: 'center' })];
    const css = generateComponent(button, model.binding, variables, 'Button', nodes[0], kids(nodes)).files['Button.css'];
    const rootBlock = /\.button \{(.*?)\}/s.exec(css)[1];
    assert.doesNotMatch(rootBlock, /^ {2}width:/m);
});

test('Play on a flipped root draws the icon at the visual start', () => {
    const icon = { id: 'ic', name: 'Icon/check', type: 'frame', parentId: null, x: 0, y: 0, w: 24, h: 24, component: true, fills: [] };
    const iconPath = { id: 'ic-p', name: 'check', type: 'path', parentId: 'ic', x: 0, y: 0, w: 24, h: 24, pathW: 24, pathH: 24, closed: true, points: [{ x: 4, y: 4 }, { x: 20, y: 12 }, { x: 4, y: 20 }], fills: [], stroke: '#000000', strokeWidth: 0 };
    const slot = { id: 'i-icon', name: 'iconStart', type: 'frame', parentId: 'i', x: 0, y: 0, w: 16, h: 16, fills: [], clip: true, layout: 'horizontal', behavior: { version: BEHAVIOR_DATA_VERSION, slot: 'iconStart' } };
    const nested = { id: 'nested', name: 'Icon/check', type: 'frame', parentId: 'i-icon', x: 0, y: 0, w: 16, h: 16, fills: [], isInstance: true, sourceId: 'ic', layoutSizingH: 'fill', layoutSizingV: 'fill' };
    const flipped = instance({ layout: 'horizontal', layoutFlip: true, behavior: { version: BEHAVIOR_DATA_VERSION, props: { label: 'Save', hasIcon: true, iconPlacement: 'start', icon: 'ic' } } });
    const seen = toDomTree(doc([master({}), labelLayer('m', { layoutSizingH: 'fill', textAlign: 'center' }), labelLayer('i', { layoutSizingH: 'fill', textAlign: 'center' }), icon, iconPath, flipped, slot, nested]), 'i').root;
    assert.deepEqual(seen.children.map(c => c.attrs.class), ['button-iconStart', 'button-label']);
});

test('Play keeps the schema order when the stored order drifts from it, like the codegen output', () => {
    const drifted = instance({ behavior: { version: BEHAVIOR_DATA_VERSION, props: { label: 'Save', hasIcon: true, iconPlacement: 'start' } } });
    const slot = { id: 'i-icon', name: 'iconStart', type: 'frame', parentId: 'i', x: 0, y: 0, w: 16, h: 16, fills: [], clip: true, layout: 'horizontal', behavior: { version: BEHAVIOR_DATA_VERSION, slot: 'iconStart' } };
    const seen = toDomTree(doc([master({}), labelLayer('m', { layoutSizingH: 'fill' }), labelLayer('i', { layoutSizingH: 'fill' }), drifted, slot]), 'i').root;
    assert.deepEqual(seen.children.map(c => c.attrs.class), ['button-iconStart', 'button-label']);
});

test('the export reads the label from the visual-first text of a flipped master', () => {
    const flipped = master({ layout: 'horizontal', layoutFlip: true, primaryAlign: 'start', counterAlign: 'center' });
    const t1 = { id: 'm-t1', name: 'first', type: 'text', parentId: 'm', text: 'A', x: 0, y: 0, w: 40, h: 20, fills: [], textAlign: 'left' };
    const t2 = { id: 'm-t2', name: 'second', type: 'text', parentId: 'm', text: 'B', x: 40, y: 0, w: 40, h: 20, fills: [], textAlign: 'right' };
    const css = generateComponent(button, model.binding, variables, 'Button', flipped, id => [flipped, t1, t2].filter(n => n.parentId === id)).files['Button.css'];
    const labelBlock = /\.button-label \{(.*?)\}/s.exec(css)[1];
    assert.match(labelBlock, /text-align: right;/);
});

test('Play on a flipped vertical root draws the icon at the visual start of the column', () => {
    const slot = { id: 'i-icon', name: 'iconStart', type: 'frame', parentId: 'i', x: 0, y: 0, w: 16, h: 16, fills: [], clip: true, layout: 'horizontal', behavior: { version: BEHAVIOR_DATA_VERSION, slot: 'iconStart' } };
    const flipped = instance({ layout: 'vertical', layoutFlip: true, behavior: { version: BEHAVIOR_DATA_VERSION, props: { label: 'Save', hasIcon: true, iconPlacement: 'start' } } });
    const seen = toDomTree(doc([master({ layout: 'vertical' }), labelLayer('m', {}), labelLayer('i', {}), flipped, slot]), 'i').root;
    assert.equal(seen.style.flexDirection, 'column');
    assert.deepEqual(seen.children.map(c => c.attrs.class), ['button-iconStart', 'button-label']);
});
