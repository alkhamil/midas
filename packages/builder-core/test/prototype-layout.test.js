import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDomTree } from '../src/prototype/dom-tree.js';

const frame = (id, parentId, extra = {}) => ({ id, name: id, type: 'frame', parentId, x: 0, y: 0, w: 375, h: 667, ...extra });
const rect = (id, parentId, extra = {}) => ({ id, name: id, type: 'rect', parentId, x: 0, y: 0, w: 100, h: 50, ...extra });
const docOf = nodes => ({ pages: [{ id: 'p', name: 'Page', nodes }] });

/** The style of one child of a frame, drawn as a top-level frame. */
function childStyle(parentExtra, childExtra, { responsive = false, type = 'rect' } = {}) {
    const child = type === 'frame' ? frame('c', 'root', childExtra) : rect('c', 'root', childExtra);
    const { root } = toDomTree(docOf([frame('root', null, parentExtra), child]), 'root', { responsive });
    return root.children[0].style;
}

test('in a column, a fill height child takes the free space with flex and may shrink to zero', () => {
    const s = childStyle({ layout: 'vertical' }, { layoutSizingH: 'fixed', layoutSizingV: 'fill' });
    assert.equal(s.flex, '1 1 0');
    assert.equal(s.minHeight, '0px');
    assert.equal(s.height, undefined);
});

test('in a column, a fill width child stretches across the column', () => {
    const s = childStyle({ layout: 'vertical' }, { layoutSizingH: 'fill', layoutSizingV: 'fixed' });
    assert.equal(s.alignSelf, 'stretch');
    assert.equal(s.width, undefined);
    assert.equal(s.flex, undefined);
});

test('in a column, a fixed width child keeps its width, does not stretch, and does not shrink', () => {
    const s = childStyle({ layout: 'vertical' }, { layoutSizingH: 'fixed', layoutSizingV: 'hug' });
    assert.equal(s.alignSelf, 'flex-start');
    assert.equal(s.width, '100px');
    assert.equal(s.flexShrink, '0');
});

test('in a column, a hugging height child keeps its content height and does not shrink', () => {
    const s = childStyle({ layout: 'vertical' }, { layoutSizingH: 'hug', layoutSizingV: 'hug' });
    assert.equal(s.height, undefined);
    assert.equal(s.flexShrink, '0');
    assert.equal(s.alignSelf, 'flex-start');
});

test('in a row, the axes swap: a fill width child takes the free space, a fill height child stretches', () => {
    const grow = childStyle({ layout: 'horizontal' }, { layoutSizingH: 'fill', layoutSizingV: 'fixed' });
    assert.equal(grow.flex, '1 1 0');
    assert.equal(grow.minWidth, '0px');
    assert.equal(grow.width, undefined);
    const stretch = childStyle({ layout: 'horizontal' }, { layoutSizingH: 'fixed', layoutSizingV: 'fill' });
    assert.equal(stretch.alignSelf, 'stretch');
    assert.equal(stretch.height, undefined);
});

test('in a row, a fixed width child keeps its width and does not shrink, so a wide one is clipped by its frame', () => {
    const s = childStyle({ layout: 'horizontal' }, { layoutSizingH: 'fixed', layoutSizingV: 'fixed', w: 600 });
    assert.equal(s.width, '600px');
    assert.equal(s.flexShrink, '0');
});

test('a child of a plain frame is placed absolutely: a hugging size is left to the content, the others keep their size', () => {
    const hug = childStyle({}, { layoutSizingH: 'hug', layoutSizingV: 'hug', x: 10, y: 20 });
    assert.equal(hug.position, 'absolute');
    assert.equal(hug.left, '10px');
    assert.equal(hug.top, '20px');
    assert.equal(hug.width, undefined);
    assert.equal(hug.height, undefined);
    const fixed = childStyle({}, { layoutSizingH: 'fixed', layoutSizingV: 'fixed' });
    assert.equal(fixed.width, '100px');
    assert.equal(fixed.height, '50px');
});

test('responsive: the top-level frame takes the window in both directions; without the flag it keeps its size', () => {
    const doc = docOf([frame('root', null, { layout: 'vertical' })]);
    const responsive = toDomTree(doc, 'root', { responsive: true }).root.style;
    assert.equal(responsive.width, '100%');
    assert.equal(responsive.height, '100%');
    const fixed = toDomTree(doc, 'root').root.style;
    assert.equal(fixed.width, '375px');
    assert.equal(fixed.height, '667px');
});

test('responsive: the sizing of a child does not depend on the flag, only the top-level frame does', () => {
    const extra = { layout: 'vertical' };
    const child = { layoutSizingH: 'fill', layoutSizingV: 'fill' };
    assert.deepEqual(childStyle(extra, child, { responsive: true }), childStyle(extra, child));
});

test('nested auto layout: a hugging frame inside a column is a flex row whose fill child takes the free width', () => {
    const doc = docOf([
        frame('root', null, { layout: 'vertical' }),
        frame('row', 'root', { layout: 'horizontal', layoutSizingH: 'fill', layoutSizingV: 'hug' }),
        rect('cell', 'row', { layoutSizingH: 'fill', layoutSizingV: 'fixed', h: 40 }),
        rect('tag', 'row', { layoutSizingH: 'hug', layoutSizingV: 'hug' }),
    ]);
    const { root } = toDomTree(doc, 'root', { responsive: true });
    const row = root.children[0];
    assert.equal(row.style.display, 'flex');
    assert.equal(row.style.flexDirection, 'row');
    assert.equal(row.style.alignSelf, 'stretch');
    assert.equal(row.children[0].style.flex, '1 1 0');
    assert.equal(row.children[0].style.height, '40px');
    assert.equal(row.children[1].style.width, undefined);
    assert.equal(row.children[1].style.flexShrink, '0');
});

test('a frame clips its content by default, on both axes', () => {
    const doc = docOf([frame('root', null, { layout: 'vertical' }), frame('box', 'root', { layoutSizingH: 'fixed', layoutSizingV: 'fixed' })]);
    const { root } = toDomTree(doc, 'root', { responsive: true });
    assert.equal(root.style.overflowX, 'hidden');
    assert.equal(root.style.overflowY, 'hidden');
    assert.equal(root.children[0].style.overflowX, 'hidden');
    assert.equal(root.children[0].style.overflowY, 'hidden');
});

test('a frame scroll behaviour opens the axes it names and keeps the others clipped', () => {
    const axes = overflow => {
        const doc = docOf([frame('root', null, { prototype: { version: 1, interactions: [], overflow } })]);
        const { root } = toDomTree(doc, 'root');
        return [root.style.overflowX, root.style.overflowY];
    };
    assert.deepEqual(axes('none'), ['hidden', 'hidden']);
    assert.deepEqual(axes('horizontal'), ['auto', 'hidden']);
    assert.deepEqual(axes('vertical'), ['hidden', 'auto']);
    assert.deepEqual(axes('both'), ['auto', 'auto']);
});

test('the clip flag no longer decides the clipping: every frame clips unless its scroll behaviour opens an axis', () => {
    const doc = docOf([frame('root', null, { clip: false })]);
    assert.equal(toDomTree(doc, 'root').root.style.overflowX, 'hidden');
});
