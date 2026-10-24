// Preview harus membuka isi yang sama persis dengan yang ada di kanvas:
// instance overlay yang ditaruh editor untuk sebuah action open-* (yang bisa
// diedit langsung) menang atas komponen masternya; yang sudah dihapus fallback.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOpenTarget, swapBase, previewChrome, previewScale, previewUrl, scaleIconChild, overlayRootBase, previewOverflow, fillRootBox, sceneOrigins, scrollPosStyle } from '../src/preview/live.js';

// Kanvas: master "Menu" (teks lama), dan instance overlay yang ditaruh dari
// master itu lalu teksnya diedit menjadi "Harga baru".
const master = { id: 'comp-menu', name: 'Menu', component: true, type: 'frame', w: 200, h: 100 };
const placed = { id: 'ov-1', name: 'Menu', isInstance: true, sourceId: 'comp-menu', isOverlay: true, overlayTrigger: 'btn-1', type: 'frame', w: 200, h: 100, text: 'Harga baru' };
const gone = { id: 'ov-gone', name: 'Menu', isInstance: true, sourceId: 'comp-menu', softDeleted: true };
const byId = new Map([['comp-menu', master], ['ov-1', placed], ['ov-gone', gone], ['frame-home', { id: 'frame-home', type: 'frame' }]]);
const ctx = {
    node: id => byId.get(id) || null,
    componentTarget: (id, like) => (id === 'comp-menu' ? master : null),
};

test('open memakai instance overlay yang ditaruh di kanvas, bukan masternya', () => {
    const action = { type: 'open-dropdown', targetComponentId: 'comp-menu', overlayInstanceId: 'ov-1' };
    assert.equal(resolveOpenTarget(ctx, action), placed);
});

test('instance yang sudah dihapus fallback ke komponen yang dipilih', () => {
    const action = { type: 'open-overlay', targetComponentId: 'comp-menu', overlayInstanceId: 'ov-gone' };
    assert.equal(resolveOpenTarget(ctx, action), master);
});

test('tanpa instance, target komponen/varian lama tetap dipakai', () => {
    assert.equal(resolveOpenTarget(ctx, { type: 'open-popover', targetComponentId: 'comp-menu' }), master);
    assert.equal(resolveOpenTarget(ctx, { type: 'open-overlay', targetFrameId: 'frame-home' }).id, 'frame-home');
    assert.equal(resolveOpenTarget(ctx, { type: 'open-dropdown', targetComponentId: 'comp-menu', overlayInstanceId: 'tidak-ada' }), master);
});

test('swap: child hug tidak dipaksa w/h host, layout dihitung engine', () => {
    const host = { id: 'h', name: 'Item', x: 10, y: 20, w: 300, h: 40, layoutSizingH: 'fill', layoutSizingV: 'hug' };
    const variant = { id: 'v', name: 'Item', x: 0, y: 0, w: 200, h: 64, layoutSizingH: 'fill', layoutSizingV: 'hug', layoutPositioning: 'absolute' };
    const out = swapBase(host, variant);
    assert.equal(out.w, 200, 'lebar ikut varian, bukan host');
    assert.equal(out.h, 64, 'tinggi ikut varian, bukan host');
    assert.equal(out.x, 10);
    assert.equal(out.layoutSizingV, 'hug', 'sizing host dipertahankan');
});

test('swap: child fixed mempertahankan ukuran host', () => {
    const host = { id: 'h', name: 'Btn', x: 5, y: 5, w: 180, h: 48, layoutSizingH: 'fixed', layoutSizingV: 'fixed' };
    const variant = { id: 'v', name: 'Btn', x: 0, y: 0, w: 120, h: 40 };
    const out = swapBase(host, variant);
    assert.equal(out.w, 180);
    assert.equal(out.h, 48);
});

test('swap: undefined host tidak menimpa layout varian', () => {
    const host = { id: 'h', name: 'Badge', x: 0, y: 0, w: 100, h: 30 };
    const variant = { id: 'v', name: 'Badge', x: 0, y: 0, w: 90, h: 28, layoutPositioning: 'absolute' };
    const out = swapBase(host, variant);
    assert.equal(out.layoutPositioning, 'absolute', 'positioning varian dipertahankan');
    assert.equal(out.w, 100, 'host tanpa sizing dianggap fixed seperti kanvas');
});

test('root preview full website: putih, flex, selebar viewport (spec Phase 1)', () => {
    assert.deepEqual(previewChrome(), { position: 'fixed', inset: '0', zIndex: 350, background: '#fff', overflowX: 'hidden', overflowY: 'hidden', display: 'flex', width: '100%', minHeight: '100%' });
    assert.equal(previewChrome('none').overflowX, 'hidden');
    assert.equal(previewChrome('none').overflowY, 'hidden');
    assert.equal(previewChrome('horizontal').overflowY, 'hidden');
});

test('skala preview Figma-style: fill / actual / fit', () => {
    assert.equal(previewScale('fill', 1512, 982, 1440, 900), 1512 / 1440);
    assert.equal(previewScale('actual', 1512, 982, 1440, 900), 1);
    assert.equal(previewScale('fit', 1512, 982, 1440, 1800), Math.min(1512 / 1440, 982 / 1800));
    assert.equal(previewScale('fit', 1512, 982, 390, 844), Math.min(1512 / 390, 982 / 844));
});

test('URL preview tab membawa file, page, frame, dan skala', () => {
    assert.equal(previewUrl('f1', 'p1', 'fr1', 'fill'), '/preview/f1?page=p1&preview=fr1');
    assert.equal(previewUrl('f1', 'p1', 'fr1', 'actual'), '/preview/f1?page=p1&preview=fr1&scale=actual');
    assert.equal(previewUrl('f 1', undefined, undefined, 'fill'), '/preview/f%201');
});

test('root overlay dipatok ke px kanvas (hug/fill tidak dihitung ulang)', () => {
    const out = overlayRootBase({ id: 'ov', type: 'frame', isOverlay: true, w: 200, h: 236, layoutSizingH: 'fill', layoutSizingV: 'hug' });
    assert.equal(out.w, 200);
    assert.equal(out.h, 236);
    assert.equal(out.layoutSizingH, 'fill');
    assert.equal(out.layoutSizingV, 'fixed');
    assert.equal(out.x, 0);
});

test('frame utama tidak dipatok', () => {
    const out = overlayRootBase({ id: 'f', type: 'frame', w: 800, h: 600, layoutSizingV: 'hug' });
    assert.equal(out.layoutSizingV, 'hug');
});

test('konten overlay dari master komponen ikut dipatok (force)', () => {
    const out = overlayRootBase({ id: 'm', type: 'frame', w: 200, h: 236, layoutSizingV: 'hug' }, true);
    assert.equal(out.h, 236);
    assert.equal(out.layoutSizingV, 'fixed');
});

test('dropdown match parent (matchBox) mematok lebar/tinggi sesuai trigger', () => {
    const outW = overlayRootBase({ id: 'm', type: 'frame', w: 200, h: 236, layoutSizingH: 'hug', layoutSizingV: 'hug' }, true, { w: 320, h: null });
    assert.equal(outW.w, 320);
    assert.equal(outW.h, 236);
    assert.equal(outW.layoutSizingH, 'fixed');
    const outWH = overlayRootBase({ id: 'm', type: 'frame', w: 200, h: 236 }, true, { w: 320, h: 180 });
    assert.equal(outWH.w, 320);
    assert.equal(outWH.h, 180);
});

test('overflow frame memetakan sumbu scroll preview', () => {
    assert.deepEqual(previewOverflow(undefined), { x: 'hidden', y: 'hidden' });
    assert.deepEqual(previewOverflow('both'), { x: 'auto', y: 'auto' });
    assert.deepEqual(previewOverflow('horizontal'), { x: 'auto', y: 'hidden' });
    assert.deepEqual(previewOverflow('vertical'), { x: 'hidden', y: 'auto' });
    assert.deepEqual(previewOverflow('none'), { x: 'hidden', y: 'hidden' });
});

test('ikon swap mengikuti wrapper: isi group selalu di-scale', () => {
    const c = { x: 4, y: 5, w: 12, h: 10 };
    scaleIconChild(c, {}, { type: 'group' }, { fx: 2, fy: 0.5, dx: 12, dy: -5 });
    assert.deepEqual([c.x, c.y, c.w, c.h], [8, 2.5, 24, 5]);
});

test('ikon swap: constraint scale di-scale, left/top dibiarkan', () => {
    const c = { x: 4, y: 5, w: 12, h: 10, constraintH: 'scale', constraintV: undefined };
    scaleIconChild(c, { constraintH: 'scale' }, { type: 'frame' }, { fx: 2, fy: 2, dx: 12, dy: 12 });
    assert.deepEqual([c.x, c.y, c.w, c.h], [8, 5, 24, 10]);
});

test('ikon swap: constraint right/center digeser delta', () => {
    const c = { x: 4, y: 5, w: 12, h: 10 };
    scaleIconChild(c, { constraintH: 'right', constraintV: 'center' }, { type: 'frame' }, { fx: 2, fy: 2, dx: 10, dy: 8 });
    assert.deepEqual([c.x, c.y], [14, 9]);
});

test('ikon swap: isi flow auto-layout dibiarkan untuk engine', () => {
    const c = { x: 4, y: 5, w: 12, h: 10 };
    scaleIconChild(c, { constraintH: 'scale', constraintV: 'scale' }, { type: 'frame', layout: 'horizontal' }, { fx: 2, fy: 2, dx: 10, dy: 8 });
    assert.deepEqual([c.x, c.y, c.w, c.h], [4, 5, 12, 10]);
});

test('fill mode: root dilayout ulang seukuran viewport tanpa transform', () => {
    const out = fillRootBox({ id: 'f', w: 1440, h: 900, layoutSizingH: 'hug', layoutSizingV: 'fixed' }, { w: 1512, h: 982 });
    assert.deepEqual([out.w, out.h, out.layoutSizingH, out.layoutSizingV], [1512, 982, 'fixed', 'fixed']);
    const same = { id: 'f', w: 100, h: 100 };
    assert.equal(fillRootBox(same, null), same);
    assert.equal(fillRootBox(same, { w: 0, h: 982 }), same);
});

test('sceneOrigins mengakumulasi posisi sampai root', () => {
    const o = sceneOrigins([
        { id: 'root', x: 0, y: 0 },
        { id: 'head', parentId: 'root', x: 0, y: 10 },
        { id: 't', parentId: 'head', x: 8, y: 4 },
        { id: 'orphan', parentId: 'gone', x: 3, y: 5 },
    ]);
    assert.deepEqual(o.get('t'), { x: 8, y: 14 });
    assert.deepEqual(o.get('root'), { x: 0, y: 0 });
    assert.deepEqual(o.get('orphan'), { x: 3, y: 5 });
});

test('scrollPosStyle: fixed diam di viewport, sticky di tepi atas', () => {
    assert.deepEqual(scrollPosStyle({ scroll: 'fixed', x: 8, y: 700 }, { x: 8, y: 714 }, false), { position: 'fixed', left: '8px', top: '714px' });
    assert.deepEqual(scrollPosStyle({ scroll: 'fixed', x: 1, y: 2 }, null, true), { position: 'fixed' });
    assert.deepEqual(scrollPosStyle({ scroll: 'sticky', x: 0, y: 40 }, null, false), { position: 'sticky', top: '0', left: '0px', marginTop: '40px' });
    assert.equal(scrollPosStyle({ x: 1 }, null, false), null);
    assert.equal(scrollPosStyle(null, null, false), null);
});
