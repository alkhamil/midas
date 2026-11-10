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
    /** Empty one page (its entries are gone): the rest of the atlas stays. */
    resetPage(page) {
        this.pages[page] = { y: 1, rows: [] };
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

/** The most tiles of one layer in view at once: well below the 64 entries an atlas holds, so a few layers share it. */
export const MAX_LAYER_TILES = 16;

/** The most texels of margin an entry carries around its tile: a stroke's margin in world units grows with the zoom and must not eat the tile. */
export const MAX_MARGIN_TEXELS = 64;

/** The lowest raster scale a layer is lowered to when it cannot fit its budget. */
const MIN_PLAN_RES = 1 / 16;

/** The margin of an entry in world units: what the layer needs (`basePad`), at most MAX_MARGIN_TEXELS texels, and never under the sampler's two texels. */
export function marginFor(basePad, res) {
    return Math.max(Math.min(basePad, MAX_MARGIN_TEXELS / Math.max(res, 1e-9)), edgePadding(res));
}

/**
 * The tiles of a layer in view at a raster scale, and the scale itself: the requested `res`, lowered in quarter-octave steps until the tiles
 * in `view` (a rect in the layer's units) are at most `maxTiles`. Tiles keep their size (a tile is as large as the entry budget allows);
 * the scale gives way, so a layer never takes more of the atlas than its budget.
 * @returns {{ res: number, padding: number, tiles: { x: number, y: number, w: number, h: number }[], total: number }}
 */
export function planLayer(width, height, res, size, basePad, view, maxTiles = MAX_LAYER_TILES) {
    let r = res, plan;
    for (let step = 0; step < 400; step++) {
        const padding = marginFor(basePad, r), fit = Math.min(size - 4, MAX_TILE_TEXELS) / Math.max(r, 1e-9) - 2 * padding;
        const room = fit >= 1 ? Math.floor(fit) : fit;
        const cols = Math.max(1, Math.ceil(width / room)), rows = Math.max(1, Math.ceil(height / room));
        const single = width <= room && height <= room;
        const tiles = [];
        // A single tile (the whole layer) counts only while it meets the view; tiles of a grid are the ones the view reaches.
        const x0 = single ? 0 : Math.max(0, Math.floor(view.x / room)), x1 = single ? 0 : Math.min(cols - 1, Math.floor((view.x + view.w) / room));
        const y0 = single ? 0 : Math.max(0, Math.floor(view.y / room)), y1 = single ? 0 : Math.min(rows - 1, Math.floor((view.y + view.h) / room));
        const outside = single && (width < view.x || view.x + view.w < 0 || height < view.y || view.y + view.h < 0);
        for (let iy = y0; iy <= y1 && !outside; iy++)
            for (let ix = x0; ix <= x1; ix++) {
                const x = single ? 0 : ix * room, y = single ? 0 : iy * room;
                tiles.push({ x, y, w: single ? width : Math.min(room, width - x), h: single ? height : Math.min(room, height - y) });
            }
        plan = { res: r, padding, tiles, total: single ? 1 : cols * rows };
        if (tiles.length <= maxTiles || r <= MIN_PLAN_RES)
            break;
        r /= 2 ** .25;
    }
    return plan;
}

const boundsOf = rects => rects.reduce((b, r) => b ? { x0: Math.min(b.x0, r.x), y0: Math.min(b.y0, r.y), x1: Math.max(b.x1, r.x + r.w), y1: Math.max(b.y1, r.y + r.h) } : { x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h }, null);

/**
 * What a tiled layer draws this frame. `fresh` are the tiles of the current scale that are ready (`complete`: all those in view are); `needed` are
 * the rects of the tiles in view. While some are missing the last complete set (`previous`, drawn while its entries are alive and its tiles cover the
 * needed ones) stays on screen; only without one is `coarse()` (a function: the stand-in is made on demand) used, and without that nothing is drawn.
 * @param {{ fresh: object[], complete: boolean, previous: { tiles: object[], alive: boolean } | null, needed: {x:number,y:number,w:number,h:number}[], coarse: () => object | null }} p
 */
export function resolveTileSet({ fresh, complete, previous, needed, coarse }) {
    if (complete)
        return fresh;
    if (previous?.alive && previous.tiles.length && needed.length) {
        const have = boundsOf(previous.tiles.map(t => t.rect)), want = boundsOf(needed);
        if (have.x0 <= want.x0 + 1e-9 && have.y0 <= want.y0 + 1e-9 && have.x1 >= want.x1 - 1e-9 && have.y1 >= want.y1 - 1e-9)
            return previous.tiles;
    }
    const stand = coarse();
    return stand ? [stand] : [];
}

/** The page whose entries were all last used before `frame`, least recently used first; -1 when every page holds something the frame uses. */
function leastRecentPage(entries, pageCount, frame) {
    const last = new Array(pageCount).fill(-1);
    for (const e of entries.values())
        if (e.page < pageCount)
            last[e.page] = Math.max(last[e.page], e.used ?? -1);
    let best = -1;
    for (let p = 0; p < pageCount; p++)
        if (last[p] < frame && (best < 0 || last[p] < last[best]))
            best = p;
    return best;
}

/**
 * A slot for an entry of w x h texels. A full atlas frees the least recently used page that holds nothing the current frame uses (its entries are
 * dropped, `atlas.onEvict(page)` lets the owner forget references to them) and tries again; when every page is in use the frame already holds entries,
 * so `full` is set (the atlas is emptied at the next frame, never mid-frame); with nothing held this frame it is emptied at once.
 * @param {{ packer: AtlasPacker, entries: Map<string, {page: number, used?: number}>, frame: number, inFlight: number, full: boolean, deferred?: boolean, clearAll: () => void, onEvict?: (page: number) => void }} atlas
 * @returns {{ x: number, y: number, page: number } | null}
 */
export function placeInAtlas(atlas, w, h) {
    let slot = atlas.packer.alloc(w, h);
    while (!slot) {
        const page = leastRecentPage(atlas.entries, atlas.packer.pages.length, atlas.frame);
        if (page < 0)
            break;
        for (const [key, e] of atlas.entries)
            if (e.page === page)
                atlas.entries.delete(key);
        atlas.packer.resetPage(page);
        atlas.onEvict?.(page);
        slot = atlas.packer.alloc(w, h);
    }
    if (slot)
        return slot;
    if (atlas.inFlight > 0) {
        atlas.full = true;
        atlas.deferred = true;
        return null;
    }
    atlas.clearAll();
    return atlas.packer.alloc(w, h);
}

/**
 * Where a tile's entry is drawn: the tile itself, plus the margin only on the sides that are the layer's edge (a stroke or a glyph may paint there), so
 * neighbouring tiles' quads meet exactly instead of overlapping by their margins. `ox`/`oy`/`w`/`h` are in the layer's units from its origin; `uv` is the
 * matching rect of the entry, the margin giving the sampler its neighbours.
 * @param {{ x: number, y: number, w: number, h: number }} t the tile
 * @param {{ u: number, v: number, du: number, dv: number, w: number, h: number }} entry the tile's entry (w, h in world units, margin included)
 * @returns {{ ox: number, oy: number, w: number, h: number, uv: number[] }}
 */
export function tileQuad(t, padding, layerW, layerH, entry) {
    const x0 = t.x <= 0 ? -padding : t.x, y0 = t.y <= 0 ? -padding : t.y;
    const x1 = t.x + t.w >= layerW - 1e-9 ? layerW + padding : t.x + t.w, y1 = t.y + t.h >= layerH - 1e-9 ? layerH + padding : t.y + t.h;
    const fx = (x0 - (t.x - padding)) / entry.w, fy = (y0 - (t.y - padding)) / entry.h, fw = (x1 - x0) / entry.w, fh = (y1 - y0) / entry.h;
    return { ox: x0, oy: y0, w: x1 - x0, h: y1 - y0, uv: [entry.u + fx * entry.du, entry.v + fy * entry.dv, fw * entry.du, fh * entry.dv] };
}

/** The quad of an entry drawn whole (a single tile, a stale raster, the coarse stand-in): the entry and its margin, the full UV rect. */
export function fullQuad(entry) {
    return { ox: -entry.padding, oy: -entry.padding, w: entry.w, h: entry.h, uv: [entry.u, entry.v, entry.du, entry.dv] };
}
