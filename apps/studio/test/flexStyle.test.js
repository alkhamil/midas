// nodeToStyle: auto layout as CSS flexbox. The browser does the layout, so the tests read the style object only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nodeToStyle, layoutOrder, paintOrder, zIndexMap } from '../src/preview/flexStyle.js';

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
    assert.equal(nodeToStyle(col({ layoutFlip: true }), null).flexDirection, 'column');   // a flipped frame is reordered, never `-reverse`
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

// ---- Preview must lay children out like the canvas (regression: every frame imported from Figma was mirrored) ----
// A Figma import stores children back to front: layoutFlip (laid out in reverse list order) + layoutReverseZ (painted reversed).
// The canvas rule, written out on its own: the flow visits the list reversed when the frame is flipped.
const canvasFlow = (parent, kids) => parent.layoutFlip && parent.layout && parent.layout !== 'none' ? [...kids].reverse() : [...kids];
// What the browser shows for Preview's output: the DOM follows layoutOrder, flex-direction may reverse it, justify-content packs it.
function previewFlow(parent, kids) {
    const st = nodeToStyle(parent, null), dom = layoutOrder(parent, kids);
    return { order: st.flexDirection.endsWith('reverse') ? [...dom].reverse() : dom, axis: st.flexDirection.replace('-reverse', ''), justify: st.justifyContent, align: st.alignItems };
}
const flipped = (id, layout, extra = {}) => ({ id, type: 'frame', layout, gap: 8, padding: 0, w: 300, h: 100, layoutFlip: true, layoutReverseZ: true, ...extra });
// login > field group > label row / input instance > placeholder + eye, every level flipped, children stored back to front
const tree = (() => {
    const L = (id, extra) => ({ id, type: 'text', text: id, ...extra });
    const input = flipped('input', 'horizontal', { isInstance: true, gapAuto: true, gapMode: 'between', counterAlign: 'center', kids: [{ id: 'eye', type: 'frame' }, L('placeholder')] });          // visual: placeholder, eye
    const label = flipped('label', 'horizontal', { kids: [L('star'), L('labelText')] });                                                                                              // visual: Email *
    const group = flipped('group', 'vertical', { kids: [input, label] });                                                                                                             // visual: label, input
    const forgot = flipped('forgot', 'horizontal', { primaryAlign: 'end', kids: [L('link')] });
    return flipped('login', 'vertical', { counterAlign: 'start', kids: [{ id: 'cta', type: 'frame' }, forgot, group, L('title'), { id: 'logo', type: 'frame' }] });                    // visual: logo, title, group, forgot, cta
})();
const walk = (n, fn) => { if (n.kids) { fn(n); n.kids.forEach(k => walk(k, fn)); } };

test('Preview child order, direction and alignment match the canvas at every nesting level', () => {
    let levels = 0;
    walk(tree, n => {
        levels++;
        const canvas = canvasFlow(n, n.kids), p = previewFlow(n, n.kids);
        assert.deepEqual(p.order.map(k => k.id), canvas.map(k => k.id), n.id + ': children order');
        assert.equal(p.axis, n.layout === 'horizontal' ? 'row' : 'column', n.id + ': direction');
        assert.equal(p.justify, n.gapAuto ? 'space-between' : n.primaryAlign === 'end' ? 'flex-end' : 'flex-start', n.id + ': primary alignment is not mirrored');
        assert.equal(p.align, n.counterAlign === 'center' ? 'center' : 'flex-start', n.id + ': counter alignment');
    });
    assert.equal(levels, 5);
    const visual = n => canvasFlow(n, n.kids).map(k => k.id);
    assert.deepEqual(visual(tree), ['logo', 'title', 'group', 'forgot', 'cta']);
    const group = tree.kids[2], input = group.kids[0], label = group.kids[1];
    assert.deepEqual(visual(group), ['label', 'input']);
    assert.deepEqual(visual(label), ['labelText', 'star']);          // "Email *", not "* Email"
    assert.deepEqual(visual(input), ['placeholder', 'eye']);         // placeholder left, eye right
});

test('"first on top" is a z-index; it never moves a child in the flow', () => {
    const kids = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const both = flipped('f', 'vertical'), onlyZ = flipped('g', 'vertical', { layoutFlip: false }), onlyFlip = flipped('h', 'vertical', { layoutReverseZ: false });
    assert.deepEqual(layoutOrder(both, kids).map(k => k.id), ['c', 'b', 'a']);
    assert.deepEqual(paintOrder(both, kids).map(k => k.id), ['c', 'b', 'a']);
    assert.equal(zIndexMap(both, kids).size, 0);                      // flow and paint agree: nothing to set
    assert.deepEqual(layoutOrder(onlyZ, kids).map(k => k.id), ['a', 'b', 'c']);
    assert.deepEqual([...zIndexMap(onlyZ, kids)], [['c', 1], ['b', 2], ['a', 3]]);   // a stays first in the flow but is on top
    assert.deepEqual(layoutOrder(onlyFlip, kids).map(k => k.id), ['c', 'b', 'a']);
    assert.deepEqual([...zIndexMap(onlyFlip, kids)], [['a', 1], ['b', 2], ['c', 3]]);   // c comes first in the flow, a is painted first
    const free = { id: 'x', type: 'frame', layout: 'none', layoutFlip: true, layoutReverseZ: true };
    assert.deepEqual(layoutOrder(free, kids), kids);                  // only auto layout frames reorder
    assert.equal(zIndexMap(free, kids).size, 0);
});
