// A stroke paint other than a plain colour (a gradient, a pattern, a picture or a video poster) as an SVG paint server, so Play draws it from the same fields the canvas
// paints. A stroke is drawn by SVG shapes, whose `stroke="url(#id)"` reads a paint server of the same document: the server is made once per layer and held in a hidden svg.
import { gradientHandlePoints, gradientStops, isGradientFill, patternCellOf, patternPhaseOf, patternTileId, patternTileOf, imageRotationOf } from './fills.js';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const num = v => Math.round(v * 1000) / 1000;

/**
 * The paint server of a stroke paint. Null for a solid colour, a hidden paint, or one that cannot be drawn yet (a tile or picture without its asset or its measured size).
 * An angular gradient has no SVG paint server (it is a conic gradient): it draws as its first colour here.
 * @param {any} f the stroke paint (a fill-shaped object)
 * @param {string} id the id the server takes
 * @param {{ w: number, h: number }} box the layer's size, which a pattern tile and a picture are placed in
 * @param {Record<string, string>} assets the document's asset sources by id
 * @param {(id: string) => any} [lookup] nodes by id (a pattern source)
 * @returns {{ defs: string, paint: string } | null} `paint` is the value of the stroke attribute
 */
export function paintServerOf(f, id, box, assets, lookup) {
    if (!f || f.type === 'solid' || f.visible === false) return null;
    if (isGradientFill(f)) return gradientServer(f, id, box);
    if (f.type === 'pattern') return patternServer(f, id, box, assets, lookup);
    if (f.type === 'image' || f.type === 'video') return pictureServer(f, id, box, assets);
    return null;
}

function gradientServer(f, id, box) {
    const stops = gradientStops(f);
    if (f.type === 'angular') return { defs: '', paint: stops[0].color };
    const list = stops.map(s => `<stop offset="${num(s.pos)}" stop-color="${esc(s.color.slice(0, 7))}"${(s.alpha ?? 1) < 1 ? ` stop-opacity="${num(s.alpha)}"` : ''}/>`).join('');
    const H = gradientHandlePoints(f, box);
    if (f.type === 'linear') return { defs: `<linearGradient id="${id}" x1="${num(H.a.x)}" y1="${num(H.a.y)}" x2="${num(H.b.x)}" y2="${num(H.b.y)}">${list}</linearGradient>`, paint: `url(#${id})` };
    const c = H.c ?? { x: H.a.x, y: H.a.y + 0.5 };
    return { defs: `<radialGradient id="${id}" cx="0" cy="0" r="${f.type === 'diamond' ? 1.2 : 1}" gradientTransform="matrix(${num(H.b.x - H.a.x)} ${num(H.b.y - H.a.y)} ${num(c.x - H.a.x)} ${num(c.y - H.a.y)} ${num(H.a.x)} ${num(H.a.y)})">${list}</radialGradient>`, paint: `url(#${id})` };
}

function patternServer(f, id, box, assets, lookup) {
    const tile = patternTileOf(f), src = assets[patternTileId(f, lookup)];
    if (!tile || !src) return null;
    const cell = patternCellOf(f.tileType, tile.stepX, tile.stepY), phase = patternPhaseOf(f, box.w, box.h);
    const images = cell.at.map(([x, y]) => `<image href="${esc(src)}" x="${num(x)}" y="${num(y)}" width="${num(tile.tileW)}" height="${num(tile.tileH)}"/>`).join('');
    return { defs: `<pattern id="${id}" patternUnits="userSpaceOnUse" x="${num(phase.x)}" y="${num(phase.y)}" width="${num(cell.W)}" height="${num(cell.H)}">${images}</pattern>`, paint: `url(#${id})` };
}

function pictureServer(f, id, box, assets) {
    const src = assets[f.type === 'video' ? f.poster : f.image], { w, h } = box;
    if (!src || !(w > 0 && h > 0)) return null;
    const mode = f.mode || 'fill', rot = imageRotationOf(f), turn = rot ? ` transform="rotate(${num(rot)} ${num(w / 2)} ${num(h / 2)})"` : '';
    const href = esc(src);
    if (mode === 'tile') {
        if (!(f.iw && f.ih)) return null;
        const tw = f.iw * (f.scale || 1), th = f.ih * (f.scale || 1);
        return { defs: `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${num(tw)}" height="${num(th)}"><image href="${href}" width="${num(tw)}" height="${num(th)}"/></pattern>`, paint: `url(#${id})` };
    }
    let image;
    if (mode === 'crop') {
        if (!(f.iw && f.ih)) return null;
        const zoom = f.crop?.scale || 1, cx = f.crop?.x ?? 0.5, cy = f.crop?.y ?? 0.5, k = Math.max(w / f.iw, h / f.ih) * zoom, dw = f.iw * k, dh = f.ih * k;
        image = `<image href="${href}" x="${num((w - dw) / 2 - (cx - 0.5) * dw)}" y="${num((h - dh) / 2 - (cy - 0.5) * dh)}" width="${num(dw)}" height="${num(dh)}"${turn}/>`;
    }
    else image = `<image href="${href}" width="${num(w)}" height="${num(h)}" preserveAspectRatio="xMidYMid ${mode === 'fit' ? 'meet' : 'slice'}"${turn}/>`;
    return { defs: `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${num(w)}" height="${num(h)}">${image}</pattern>`, paint: `url(#${id})` };
}
