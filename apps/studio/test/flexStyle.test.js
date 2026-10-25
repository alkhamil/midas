// nodeToStyle: auto layout as CSS flexbox. The browser does the layout, so the tests read the style object only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nodeToStyle } from '../src/preview/flexStyle.js';

const row = (extra = {}) => ({ type: 'frame', layout: 'horizontal', gap: 8, padding: 0, w: 300, h: 100, ...extra });
const col = (extra = {}) => row({ layout: 'vertical', ...extra });
const box = (extra = {}) => ({ type: 'frame', x: 0, y: 0, w: 40, h: 20, ...extra });
const text = (extra = {}) => ({ type: 'text', x: 0, y: 0, w: 80, h: 20, text: 'Save', ...extra });

test('a frame with auto layout is a flex container', () => {
    const s = nodeToStyle(row({ gap: 12, padT: 4, padR: 8, padB: 4, padL: 8, primaryAlign: 'center', counterAlign: 'end' }), null);
    assert.equal(s.display, 'flex');
    assert.equal(s.flexDirection, 'row');
    assert.equal(s.gap, '12px');
    assert.equal(s.padding, '4px 8px 4px 8px');
    assert.equal(s.boxSizing, 'border-box');
    assert.equal(s.justifyContent, 'center');
    assert.equal(s.alignItems, 'flex-end');
    assert.equal(nodeToStyle(col(), null).flexDirection, 'column');
    assert.equal(nodeToStyle(col({ layoutFlip: true }), null).flexDirection, 'column-reverse');
});

test('space between replaces the gap on the main axis; wrap wraps', () => {
    const s = nodeToStyle(row({ gapAuto: true, gapMode: 'between' }), null);
    assert.equal(s.justifyContent, 'space-between');
    assert.equal(s.columnGap, '0px');
    assert.equal(nodeToStyle(row({ gapAuto: true, gapMode: 'evenly' }), null).justifyContent, 'space-evenly');
    const w = nodeToStyle(row({ layoutWrap: true, gap: 8, gapCross: 20 }), null);
    assert.equal(w.flexWrap, 'wrap');
    assert.equal(w.columnGap, '8px');
    assert.equal(w.rowGap, '20px');
    assert.equal(nodeToStyle(row(), null).flexWrap, undefined);
});

test('Fixed, Hug and Fill in a row', () => {
    const parent = row();
    const fixed = nodeToStyle(box({ layoutSizingH: 'fixed', layoutSizingV: 'fixed' }), parent);
    assert.deepEqual([fixed.width, fixed.height, fixed.flexShrink], ['40px', '20px', 0]);
    const hug = nodeToStyle(box({ layoutSizingH: 'hug', layoutSizingV: 'hug', layout: 'horizontal' }), parent);
    assert.deepEqual([hug.width, hug.height], ['auto', 'auto']);
    // Fill along the main axis (width in a row) shares the space; across it (height) stretches.
    const fill = nodeToStyle(box({ layoutSizingH: 'fill', layoutSizingV: 'fill' }), parent);
    assert.equal(fill.flex, '1 1 0');
    assert.equal(fill.minWidth, '0');
    assert.equal(fill.width, undefined);
    assert.equal(fill.alignSelf, 'stretch');
    assert.equal(fill.height, undefined);
    assert.equal(fill.minHeight, undefined);
});

test('Fixed, Hug and Fill in a column', () => {
    const parent = col();
    const fill = nodeToStyle(box({ layoutSizingH: 'fill', layoutSizingV: 'fill' }), parent);
    assert.equal(fill.flex, '1 1 0');
    assert.equal(fill.minHeight, '0');
    assert.equal(fill.minWidth, undefined);
    assert.equal(fill.alignSelf, 'stretch');
    assert.equal(fill.width, undefined);
    assert.equal(fill.height, undefined);
    const fixed = nodeToStyle(box({ layoutSizingH: 'fixed', layoutSizingV: 'fixed' }), parent);
    assert.deepEqual([fixed.width, fixed.height], ['40px', '20px']);
    assert.equal(nodeToStyle(box({ layoutSizingV: 'hug', layout: 'vertical' }), parent).height, 'auto');
});

test('Fill needs the parent: the same child differs in a row and a column', () => {
    const child = box({ layoutSizingH: 'fill' });
    assert.equal(nodeToStyle(child, row()).flex, '1 1 0');
    assert.equal(nodeToStyle(child, col()).alignSelf, 'stretch');
    assert.equal(nodeToStyle(child, col()).flex, undefined);
});

test('min and max sizes are kept, and a min on a Fill child wins over 0', () => {
    const s = nodeToStyle(box({ layoutSizingH: 'fill', minW: 120, maxW: 400, maxH: 90 }), row());
    assert.deepEqual([s.minWidth, s.maxWidth, s.maxHeight], ['120px', '400px', '90px']);
});

test('an absolute child of an auto layout frame sits at x / y and is out of the flow', () => {
    const s = nodeToStyle(box({ layoutPositioning: 'absolute', x: 12, y: 7 }), row());
    assert.deepEqual([s.position, s.left, s.top, s.width, s.height], ['absolute', '12px', '7px', '40px', '20px']);
    assert.equal(s.flexShrink, undefined);
    // The parent hosts it: a frame is a positioning context.
    assert.equal(nodeToStyle(row(), null).position, 'relative');
});

test('a frame without auto layout is relative and places its children by x / y', () => {
    const plain = { type: 'frame', w: 200, h: 100, clip: true };
    const s = nodeToStyle(plain, null);
    assert.equal(s.position, 'relative');
    assert.equal(s.display, undefined);
    assert.equal(s.overflow, 'hidden');
    assert.deepEqual([s.width, s.height], ['200px', '100px']);
    const kid = nodeToStyle(box({ x: 30, y: 15 }), plain);
    assert.deepEqual([kid.position, kid.left, kid.top, kid.width, kid.height], ['absolute', '30px', '15px', '40px', '20px']);
    // Hug means nothing without auto layout: it keeps its size.
    assert.equal(nodeToStyle({ ...plain, layoutSizingH: 'hug' }, null).width, '200px');
});

test('the root follows its own sizing mode', () => {
    assert.equal(nodeToStyle(row({ layoutSizingH: 'hug' }), null).width, 'fit-content');
    assert.equal(nodeToStyle(row({ layoutSizingH: 'fixed' }), null).width, '300px');
    assert.equal(nodeToStyle(row({ layoutSizingH: 'fill' }), null).width, '100%');
});

test('text: Hug stays on one line, Fixed and Fill may wrap', () => {
    const parent = row();
    const hug = nodeToStyle(text({ layoutSizingH: 'hug' }), parent);
    assert.equal(hug.whiteSpace, 'nowrap');
    assert.equal(hug.width, 'auto');
    assert.equal(nodeToStyle(text({ autoW: true }), parent).whiteSpace, 'nowrap');
    assert.equal(nodeToStyle(text({ layoutSizingH: 'hug', text: 'a\nb' }), parent).whiteSpace, 'pre');
    const fixed = nodeToStyle(text({ layoutSizingH: 'fixed' }), parent);
    assert.equal(fixed.whiteSpace, 'pre-wrap');
    assert.equal(fixed.width, '80px');
    const fill = nodeToStyle(text({ layoutSizingH: 'fill' }), parent);
    assert.equal(fill.whiteSpace, 'pre-wrap');
    assert.equal(fill.flex, '1 1 0');
    assert.equal(fill.minWidth, '0');
    assert.equal(fill.width, undefined);
    // In an auto layout the height of a text follows its lines.
    assert.equal(nodeToStyle(text(), parent).height, 'auto');
});

test('nested auto layout: a hugging frame inside a hugging frame', () => {
    const outer = row({ layoutSizingH: 'hug', layoutSizingV: 'hug', padding: 12 });
    const inner = col({ layoutSizingH: 'hug', layoutSizingV: 'hug', padding: 4 });
    const o = nodeToStyle(outer, null), i = nodeToStyle(inner, outer);
    assert.deepEqual([o.width, o.height], ['fit-content', 'fit-content']);
    assert.deepEqual([i.width, i.height, i.display, i.flexDirection, i.padding], ['auto', 'auto', 'flex', 'column', '4px 4px 4px 4px']);
    const label = nodeToStyle(text({ layoutSizingH: 'hug' }), inner);
    assert.equal(label.whiteSpace, 'nowrap');
});

test('a Button: hug width with padding', () => {
    const button = row({ layoutSizingH: 'hug', layoutSizingV: 'hug', padT: 8, padB: 8, padL: 16, padR: 16, gap: 8, primaryAlign: 'center', counterAlign: 'center', radius: 8 });
    const s = nodeToStyle(button, row({ padding: 0 }));
    assert.deepEqual([s.display, s.width, s.height, s.padding, s.justifyContent, s.alignItems, s.gap], ['flex', 'auto', 'auto', '8px 16px 8px 16px', 'center', 'center', '8px']);
});

test('layers inside a mask wrapper use x / y plus the wrapper offset', () => {
    const s = nodeToStyle(box({ x: 30, y: 10 }), row(), { x: -10, y: -4 });
    assert.deepEqual([s.position, s.left, s.top], ['absolute', '20px', '6px']);
});
