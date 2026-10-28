import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { layoutPads, layoutGap, layoutGapCross, strokeOutside } from '../src/geometry/autolayout.js';

// The DOM renderer's flex mapping of an auto layout frame, against the canvas layout engine's rules (apps/studio midas.js `place`).
const frame = (id, extra = {}) => ({ id, name: id, type: 'frame', parentId: null, x: 0, y: 0, w: 300, h: 200, fills: [], ...extra });
const child = (id, parentId, extra = {}) => ({ id, name: id, type: 'rect', parentId, x: 0, y: 0, w: 40, h: 20, fills: [], ...extra });
const rootOf = (nodes, id = 'A') => toDomTree({ pages: [{ id: 'p', name: 'P', nodes }] }, id).root;
const EDGE = { start: 'flex-start', center: 'center', end: 'flex-end' };

test('the flow direction is the layout, and each primary and counter alignment maps to flex exactly', () => {
    for (const layout of ['horizontal', 'vertical']) {
        for (const primaryAlign of ['start', 'center', 'end']) {
            for (const counterAlign of ['start', 'center', 'end']) {
                const style = rootOf([frame('A', { layout, primaryAlign, counterAlign }), child('a', 'A')]).style;
                assert.equal(style.flexDirection, layout === 'vertical' ? 'column' : 'row', `${layout} direction`);
                assert.equal(style.justifyContent, EDGE[primaryAlign], `${layout} primary ${primaryAlign}`);
                assert.equal(style.alignItems, EDGE[counterAlign], `${layout} counter ${counterAlign}`);
            }
        }
    }
});

test('an unset alignment is start, as on the canvas', () => {
    const style = rootOf([frame('A', { layout: 'horizontal' }), child('a', 'A')]).style;
    assert.equal(style.justifyContent, 'flex-start');
    assert.equal(style.alignItems, 'flex-start');
});

test('the baseline counter alignment of a horizontal frame is the baseline, not a box edge', () => {
    assert.equal(rootOf([frame('A', { layout: 'horizontal', alignBaseline: true }), child('a', 'A')]).style.alignItems, 'baseline');
});

test('a fixed or hugging child takes the frame\'s counter alignment: it is not pinned to the start', () => {
    for (const layoutSizingH of ['fixed', 'hug']) {
        const root = rootOf([frame('A', { layout: 'horizontal', counterAlign: 'center' }), child('a', 'A', { layoutSizingH, layoutSizingV: 'fixed' })]);
        assert.equal(root.children[0].style.alignSelf, undefined, `${layoutSizingH} child is aligned by the frame`);
        assert.equal(root.style.alignItems, 'center');
    }
});

test('a child that fills the cross axis stretches, whatever the frame\'s counter alignment', () => {
    const root = rootOf([frame('A', { layout: 'horizontal', counterAlign: 'center' }), child('a', 'A', { layoutSizingV: 'fill' })]);
    assert.equal(root.children[0].style.alignSelf, 'stretch');
});

test('a Button instance with its icon and label in a horizontal row centred on both axes is centred by the row', () => {
    const master = { id: 'M', name: 'Button', type: 'frame', parentId: null, x: 0, y: 0, w: 120, h: 40, component: true, fills: [], behavior: { version: 2, templateId: 'button', variables: {} } };
    const instance = { id: 'I', name: 'Done', type: 'frame', parentId: 'A', x: 0, y: 0, w: 120, h: 40, layoutSizingH: 'hug', layoutSizingV: 'hug', isInstance: true, sourceId: 'M', fills: [], behavior: { version: 2, props: { label: 'Done' } } };
    const root = rootOf([frame('A', { layout: 'horizontal', primaryAlign: 'center', counterAlign: 'center' }), master, instance], 'A');
    assert.equal(root.style.justifyContent, 'center');
    assert.equal(root.style.alignItems, 'center');
    assert.equal(root.children.length, 0, 'the master is not drawn in the flow');
});

test('an unset padding is 16 and an unset gap is 16, as on the canvas', () => {
    const style = rootOf([frame('A', { layout: 'vertical' }), child('a', 'A')]).style;
    assert.equal(style.padding, '16px 16px 16px 16px');
    assert.equal(style.rowGap, '16px');
    assert.deepEqual(layoutPads({}), { t: 16, r: 16, b: 16, l: 16 });
    assert.equal(layoutGap({}), 16);
});

test('each side takes its own padding, and a padding sets the sides that are not given', () => {
    assert.deepEqual(layoutPads({ padding: 8, padL: 2, padT: 4 }), { t: 4, r: 8, b: 8, l: 2 });
});

test('a cross gap separates the wrapped lines; the flow gap separates the children', () => {
    const row = rootOf([frame('A', { layout: 'horizontal', layoutWrap: true, gap: 8, gapCross: 20 }), child('a', 'A')]).style;
    assert.equal(row.columnGap, '8px');
    assert.equal(row.rowGap, '20px');
    const column = rootOf([frame('A', { layout: 'vertical', layoutWrap: true, gap: 8, gapCross: 20 }), child('a', 'A')]).style;
    assert.equal(column.rowGap, '8px');
    assert.equal(column.columnGap, '20px');
    assert.equal(layoutGapCross({ gapCross: 3 }, 8), 3);
    assert.equal(layoutGapCross({}, 8), 8);
});

test('space between spreads the children and sets no flow gap; one child starts from the primary alignment', () => {
    const between = rootOf([frame('A', { layout: 'horizontal', gap: 8, gapAuto: true, gapMode: 'between' }), child('a', 'A'), child('b', 'A')]).style;
    assert.equal(between.justifyContent, 'space-between');
    assert.equal(between.columnGap, '0px');
    const single = rootOf([frame('A', { layout: 'horizontal', gapAuto: true, gapMode: 'between', primaryAlign: 'center' }), child('a', 'A')]).style;
    assert.equal(single.justifyContent, 'center', 'one child is placed by the primary alignment, as the canvas does');
});

test('evenly and around space the children with their own modes, one child included', () => {
    const evenly = rootOf([frame('A', { layout: 'vertical', gapAuto: true, gapMode: 'evenly' }), child('a', 'A')]).style;
    assert.equal(evenly.justifyContent, 'space-evenly');
    const around = rootOf([frame('A', { layout: 'vertical', gapAuto: true, gapMode: 'around' }), child('a', 'A'), child('b', 'A')]).style;
    assert.equal(around.justifyContent, 'space-around');
});

test('an outside stroke of a child takes room in a frame that includes strokes, and a stroke inside the frame takes its padding', () => {
    const parent = frame('A', { layout: 'vertical', strokesIncluded: true, padding: 10, stroke: '#000', strokeWidth: 4, strokeAlign: 'inside' });
    assert.deepEqual(layoutPads(parent), { t: 14, r: 14, b: 14, l: 14 });
    const outer = child('a', 'A', { stroke: '#000', strokeWidth: 6, strokeAlign: 'outside' });
    assert.equal(strokeOutside(outer, parent), 6);
    assert.equal(strokeOutside(child('c', 'A', { stroke: '#000', strokeWidth: 6, strokeAlign: 'center' }), parent), 3);
    assert.equal(strokeOutside(outer, frame('B', { layout: 'vertical' })), 0, 'no room when strokes are not included');
    const root = rootOf([parent, outer]);
    assert.equal(root.children.find(c => c.nodeId === 'a').style.margin, '6px');
});

test('a centred frame stroke is drawn whole: the frame clips with a margin of half the stroke, and has no CSS outline', () => {
    const style = rootOf([frame('A', { stroke: '#c0392b', strokeWidth: 6, strokeAlign: 'center' })]).style;
    assert.equal(style.overflowX, 'clip');
    assert.equal(style.overflowClipMargin, '3px');
    assert.equal(style.outline, undefined);
});

test('an outside frame stroke is the CSS outline of its full width, with no clip margin', () => {
    const style = rootOf([frame('A', { stroke: '#c0392b', strokeWidth: 2, strokeAlign: 'outside' })]).style;
    assert.equal(style.outline, '2px solid #c0392b');
    assert.equal(style.overflowClipMargin, undefined);
});
