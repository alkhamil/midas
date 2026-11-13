// A stroke paint other than a plain colour (a gradient, a pattern, a picture or a video poster) as an SVG layer: the markup that paints it, to be placed in a group
// clipped by the stroke's area path, so only the stroke shows it. Play and the SVG export draw it from the same fields the canvas paints. The markup is made by the Rust
// core (`paint_layer`); this module resolves the asset a paint draws and puts the layer on a layer of the document.
import { paintLayer } from '../core/index.js';
import { escapeAttr } from './format.js';
import { patternTileId } from './fills.js';
import { strokeIsOn } from './shapes.js';

/** The fields of a gradient fill the raster reads. */
const RASTER_FIELDS = ['type', 'stops', 'color', 'color2', 'angle', 'handles'];

/**
 * The layer of a stroke paint. Null for a solid colour, a hidden paint, or one that cannot be drawn yet (a tile or picture without its asset or its measured size).
 * Linear and radial gradients are SVG gradients in the layer's pixel space, a picture is placed by the core's `picture_extent`. An angular or a diamond gradient has no SVG
 * paint server: it is its first stop's colour (the SVG export), or with `raster` (Play) an image the page paints with the canvas's own gradient drawing (`data-raster`,
 * filled in by Play: it needs a canvas) that covers the box and `pad` beyond it.
 * @param {any} f the stroke paint (a fill-shaped object)
 * @param {string} id the id the layer takes
 * @param {{ w: number, h: number }} box the layer's size, which a gradient, a pattern tile and a picture are placed in
 * @param {Record<string, string>} assets the document's asset sources by id
 * @param {(id: string) => any} [lookup] nodes by id (a pattern source)
 * @param {{ raster?: boolean, pad?: number }} [options]
 * @returns {{ defs: string, content: string } | null}
 */
export function paintLayerOf(f, id, box, assets, lookup, { raster = false, pad = 0 } = {}) {
    if (!f || f.type === 'solid' || f.visible === false) return null;
    const asset = f.type === 'pattern' ? patternTileId(f, lookup) : f.type === 'video' ? f.poster : f.type === 'image' ? f.image : null;
    const layer = paintLayer(f, id, box.w, box.h, (asset && assets[asset]) || null);
    if (!layer) return null;
    if (raster && (f.type === 'angular' || f.type === 'diamond')) {
        const source = Object.fromEntries(RASTER_FIELDS.filter(k => f[k] !== undefined).map(k => [k, f[k]]));
        return { defs: '', content: `<image data-raster="${escapeAttr(JSON.stringify({ paint: source, w: box.w, h: box.h, pad }))}" x="${-pad}" y="${-pad}" width="${box.w + 2 * pad}" height="${box.h + 2 * pad}" preserveAspectRatio="none"/>` };
    }
    return { defs: layer.defs, content: layer.content };
}

/**
 * A layer whose stroke reads a paint layer instead of a colour (`strokeLayer`: the layer's `defs` and `content` and the `id` they take). Null for a layer with no stroke,
 * a solid stroke, or a paint that cannot be drawn yet.
 * @param {any} n
 * @param {string} id the id the layer takes
 * @param {Record<string, string>} assets
 * @param {(id: string) => any} [lookup]
 * @param {{ raster?: boolean }} [options]
 * @returns {any | null}
 */
export function strokeWithPaintLayer(n, id, assets, lookup, { raster = false } = {}) {
    const sf = n.strokeFill;
    if (!sf || sf.type === 'solid' || !strokeIsOn(n)) return null;
    const layer = paintLayerOf(sf, id, { w: n.w, h: n.h }, assets, lookup, { raster, pad: Math.max(0, n.strokeWidth || 0) });
    return layer ? { ...n, strokeLayer: { ...layer, id } } : null;
}
