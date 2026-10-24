// Offset overlay mendukung {x, y} (spesifikasi) dan tetap membaca angka lama
// sebagai jarak sisi (kompatibilitas file lama).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { placeOverlayPos, offsetXY, splitOverlayParts, actionPlacement, normalizeAction, DROPDOWN_SIZES } from '../src/index.js';

const anchor = { x: 100, y: 200, w: 120, h: 40 };

test('angka lama = jarak sisi seperti semula', () => {
    assert.deepEqual(placeOverlayPos(anchor, 60, 20, 'bottom-start', 8), { x: 100, y: 248 });
    assert.deepEqual(placeOverlayPos(anchor, 60, 20, 'top', 8), { x: 130, y: 172 });
});

test('objek {x,y} menggeser hasil tanpa mengubah jarak sisi', () => {
    assert.deepEqual(placeOverlayPos(anchor, 60, 20, 'bottom-start', { x: 4, y: 6 }), { x: 104, y: 246 });
    assert.deepEqual(placeOverlayPos(anchor, 60, 20, undefined, { x: 4, y: 6 }), { x: 134, y: 216 });
});

test('tanpa overlay root tidak ada partisi', () => {
    const nodes = [{ id: 'f', type: 'frame' }, { id: 'c', parentId: 'f' }];
    assert.equal(splitOverlayParts(nodes), null);
});

test('overlay root dan isinya keluar dari main tree', () => {
    const nodes = [
        { id: 'f', type: 'frame' },
        { id: 'ov', type: 'frame', isOverlay: true },
        { id: 'item', parentId: 'ov', type: 'frame' },
        { id: 'label', parentId: 'item', type: 'text' },
    ];
    const parts = splitOverlayParts(nodes);
    assert.deepEqual(parts.main.map(n => n.id), ['f']);
    assert.deepEqual(parts.subs.length, 1);
    assert.deepEqual(parts.subs[0].map(n => n.id), ['ov', 'item', 'label']);
});

test('partisi overlay menjaga urutan kakak-beradik (a di atas b)', () => {
    const nodes = [
        { id: 'f', type: 'frame' },
        { id: 'ov', type: 'frame', isOverlay: true },
        { id: 'a', parentId: 'ov', type: 'frame' },
        { id: 'b', parentId: 'ov', type: 'frame' },
    ];
    const parts = splitOverlayParts(nodes);
    assert.deepEqual(parts.subs[0].map(n => n.id), ['ov', 'a', 'b']);
});

test('offsetXY memigrasi angka lama ke sumbu yang benar', () => {
    assert.deepEqual(offsetXY(8, 'bottom-start', 'open-dropdown'), { x: 0, y: 8 });
    assert.deepEqual(offsetXY(8, 'left', 'open-popover'), { x: 8, y: 0 });
    assert.deepEqual(offsetXY(8, undefined, 'open-dropdown'), { x: 0, y: 8 });
    assert.deepEqual(offsetXY(8, undefined, 'open-overlay'), { x: 0, y: 0 });
    assert.deepEqual(offsetXY({ x: 3, y: 4 }, 'bottom', 'open-dropdown'), { x: 3, y: 4 });
    assert.deepEqual(offsetXY(undefined, 'bottom', 'open-dropdown'), { x: 0, y: 0 });
});

test('actionPlacement memberikan default bottom-start untuk dropdown dan top untuk popover', () => {
    assert.equal(actionPlacement({ type: 'open-dropdown' }), 'bottom-start');
    assert.equal(actionPlacement({ type: 'open-dropdown', position: 'bottom-end' }), 'bottom-end');
    assert.equal(actionPlacement({ type: 'open-popover' }), 'top');
    assert.equal(actionPlacement({ type: 'open-overlay' }), 'center');
    assert.deepEqual(placeOverlayPos(anchor, 60, 20, actionPlacement({ type: 'open-dropdown' })), { x: 100, y: 240 });
});

test('normalizeAction menyimpan width dan height parent khusus open-dropdown', () => {
    assert.equal(DROPDOWN_SIZES.length, 2);
    const d1 = normalizeAction({ type: 'open-dropdown', targetComponentId: 'c1', width: 'parent', height: 'self' });
    assert.equal(d1.width, 'parent');
    assert.equal(d1.height, undefined);
    const d2 = normalizeAction({ type: 'open-dropdown', targetComponentId: 'c1', width: 'parent', height: 'parent' });
    assert.equal(d2.width, 'parent');
    assert.equal(d2.height, 'parent');
});
