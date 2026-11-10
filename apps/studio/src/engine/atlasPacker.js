// Pengemas texture atlas raster (WebGPU). Fungsi murni tanpa DOM/GPU supaya bisa diuji.
//
// Atlas = `layers` halaman bujur sangkar `size` × `size`. Tiap halaman berisi baris-baris; item masuk ke baris yang
// paling rendah yang masih cukup tinggi (best-fit), baris baru dibuka bila tidak ada. Pengemas lama hanya punya satu
// baris aktif per halaman, setinggi item tertinggi di dalamnya, sehingga ±80% atlas terbuang dan atlas sudah "penuh"
// dengan ±600 teks/path kecil — lalu seluruh isinya dibuang dan diraster ulang di setiap frame.
export class AtlasPacker {
    constructor(size, layers) {
        this.size = size;
        this.layers = layers;
        this.reset();
    }
    reset() {
        this.pages = [{ y: 1, rows: [] }];
    }
    /** Cari tempat untuk item w × h (piksel). Mengembalikan { x, y, page } atau null bila atlas penuh. */
    alloc(w, h) {
        const size = this.size;
        // The item and its 2-texel gutter (right and below) must fit, and the gutter starts at texel 1: the copy covers both.
        if (w + 3 > size || h + 3 > size)
            return null;
        for (let pi = 0; pi < this.pages.length; pi++) {
            const pg = this.pages[pi];
            let best = null;
            // Baris yang terlalu tinggi (> 2× + 8) tidak dipakai supaya item pendek tidak memboroskan baris tinggi.
            for (const row of pg.rows)
                if (row.h >= h && row.h <= h * 2 + 8 && row.x + w + 2 <= size && (!best || row.h < best.h))
                    best = row;
            if (best) {
                const x = best.x;
                best.x += w + 2;
                return { x, y: best.y, page: pi };
            }
            if (pg.y + h + 2 <= size) {
                const row = { y: pg.y, h, x: 1 + w + 2 };
                pg.rows.push(row);
                pg.y += h + 2;
                return { x: 1, y: row.y, page: pi };
            }
        }
        if (this.pages.length < this.layers) {
            this.pages.push({ y: 1, rows: [] });
            return this.alloc(w, h);
        }
        return null;
    }
}

/** The most texels a tile's entry takes along a side (its margin included): small entries fill the atlas evenly, so four fit across a page (with their gutters) and the tiles in view fit the atlas at any zoom. */
export const MAX_TILE_TEXELS = 480;

/** The transparent margin of an entry in world units: two texels at the raster scale, whatever the zoom (the sampler never reads a neighbour). */
export function edgePadding(res) {
    return res >= 1 ? 2 / res : Math.ceil(2 / Math.max(.05, res));
}

/** The margin around the view, in world units, within which layers are rastered ahead: 100 screen pixels from 100% zoom up, 100 units below it. */
export function rasterMargin(zoom) {
    return 100 / Math.max(1, zoom);
}

/**
 * Where a quad lands, relative to the camera origin: the node's matrix applied to the offset (ox, oy) in its own space. Shapes (offset 0), the tiles of a
 * raster layer and raster roots are all placed by this one function, so they share one scale and one origin; the camera-relative numbers stay small.
 * @param {number[]} m the node's matrix [a, b, c, d, e, f]
 * @returns {{ x: number, y: number }}
 */
export function placeQuad(m, originX, originY, ox = 0, oy = 0) {
    return { x: m[4] - originX + m[0] * ox + m[2] * oy, y: m[5] - originY + m[1] * ox + m[3] * oy };
}

/**
 * The tiles a layer of `width` x `height` world units is rastered in, so that each tile's entry (its size plus `padding` on each side)
 * fits the atlas side `size` and `maxTexels` at `res` texels per unit. A layer that fits is one tile. Tiles cover the layer in a grid.
 * @returns {{ x: number, y: number, w: number, h: number }[]}
 */
export function tileGrid(width, height, res, size, padding, maxTexels = MAX_TILE_TEXELS) {
    // Whole world units while a unit is smaller than a tile; past that (a unit is more than a tile of texels) a fraction of one.
    const fit = Math.min(size - 4, maxTexels) / Math.max(res, 1e-9) - 2 * padding;
    // A margin wider than the budget itself (a stroke's, in world units) leaves no room: one unit, and the entry is rastered down to the atlas (entryScaleFor).
    const room = fit >= 1 ? Math.floor(fit) : fit > 0 ? Math.max(fit, 1 / Math.max(res, 1)) : 1;
    if (width <= room && height <= room)
        return [{ x: 0, y: 0, w: width, h: height }];
    const out = [];
    for (let y = 0; y < height; y += room)
        for (let x = 0; x < width; x += room)
            out.push({ x, y, w: Math.min(room, width - x), h: Math.min(room, height - y) });
    return out;
}
