import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AtlasPacker } from '../src/engine/atlasPacker.js';

// Pengemas lama (satu baris aktif per halaman), dipertahankan di sini sebagai pembanding.
function legacyFill(items, size, layers) {
    const shelves = [{ x: 1, y: 1, h: 0 }];
    let packed = 0;
    for (const [w, h] of items) {
        let page = shelves.length - 1, shelf = shelves[page];
        if (shelf.x + w + 2 > size) {
            shelf.x = 1;
            shelf.y += shelf.h + 2;
            shelf.h = 0;
        }
        if (shelf.y + h + 2 > size) {
            if (shelves.length >= layers) return packed;
            shelf = { x: 1, y: 1, h: 0 };
            shelves.push(shelf);
        }
        shelf.x += w + 2;
        shelf.h = Math.max(shelf.h, h);
        packed++;
    }
    return packed;
}

// Campuran mirip page "Chart": ratusan teks/path kecil + beberapa garis tinggi tipis (garis sejenis berukuran serupa).
function chartLikeItems(n = 900) {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const heights = [4, 6, 8, 10, 12, 14, 16, 20, 24, 32, 48];
    return Array.from({ length: n }, (_, i) => (i % 40 === 0 ? [3, 400 + Math.floor(rnd() * 250)] : [6 + Math.floor(rnd() * 110), heights[Math.floor(rnd() * heights.length)]]));
}

test('chart-like working set (900 small layers) uses at most half of the atlas', () => {
    const items = chartLikeItems();
    const packer = new AtlasPacker(2048, 4);
    const used = items.map(([w, h]) => packer.alloc(w, h));
    assert.ok(used.every(Boolean), 'semua item mendapat tempat');
    assert.ok(packer.pages.length <= 2, `memakai ${packer.pages.length} dari 4 halaman`);
});

test('legacy single-row packer runs out of space on the same working set', () => {
    assert.ok(legacyFill(chartLikeItems(), 2048, 4) < 900);
});

test('allocations never overlap and stay inside the page', () => {
    const items = chartLikeItems(600);
    const packer = new AtlasPacker(2048, 4);
    const placed = [];
    for (const [w, h] of items) {
        const s = packer.alloc(w, h);
        assert.ok(s);
        assert.ok(s.x >= 0 && s.y >= 0 && s.x + w <= 2048 && s.y + h <= 2048, 'di dalam halaman');
        placed.push({ ...s, w, h });
    }
    for (let i = 0; i < placed.length; i++)
        for (let j = i + 1; j < placed.length; j++) {
            const a = placed[i], b = placed[j];
            if (a.page !== b.page) continue;
            assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `item ${i} dan ${j} bertumpukan`);
        }
});

test('returns null when full or when an item is larger than a page, and reset starts over', () => {
    const packer = new AtlasPacker(64, 2);
    assert.equal(packer.alloc(100, 10), null);
    let n = 0;
    while (packer.alloc(30, 30)) n++;
    assert.equal(n, 2, 'dua halaman 64 × 64 masing-masing memuat satu item 30 × 30 beserta jarak');
    packer.reset();
    assert.ok(packer.alloc(30, 30));
});
