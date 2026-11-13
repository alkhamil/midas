// The raster of a gradient, painted with a 2D canvas context: one drawing for the canvas (which uses it as a pattern) and for Play (which draws it as an image of
// an SVG layer clipped by the stroke area). Radial, angular and diamond gradients (and a linear one with handles or many stops) are drawn this way; the diamond is
// the radial ramp at 1.2 of its radius, as the canvas has always drawn it. A canvas is created by the caller (`makeCanvas`), so this module touches no DOM.
import { gradientStops } from './fills.js';

/**
 * A gradient fill painted into a canvas that covers the layer's box and `pad` beyond it on every side, the gradient continued as SVG pads it. 512 px is plenty:
 * gradients are smooth.
 * @param {any} f a gradient fill
 * @param {number} w the layer's width
 * @param {number} h the layer's height
 * @param {number} pad how far the paint is needed beyond the box (a stroke's reach)
 * @param {(w: number, h: number) => any} makeCanvas a canvas of this size in pixels
 * @returns {{ canvas: any, k: number, cw: number, ch: number }} `k` is canvas pixels per layer unit
 */
export function gradientRaster(f, w, h, pad, makeCanvas) {
    const W = w + 2 * pad, H = h + 2 * pad, res = Math.min(512, Math.max(16, Math.ceil(Math.max(W, H))));
    const k = res / Math.max(W, H), cw = Math.max(1, Math.round(W * k)), ch = Math.max(1, Math.round(H * k));
    const canvas = makeCanvas(cw, ch), g = canvas.getContext('2d'), stops = gradientStops(f), handles = f.handles;
    if (pad) g.translate(pad * k, pad * k);
    g.scale(pad ? w * k : cw, pad ? h * k : ch); // draw in 0-1 layer space
    const add = gr => { for (const s of stops) gr.addColorStop(s.pos, s.color); return gr; };
    if (f.type === 'linear') {
        const a = handles?.a || { x: 0, y: .5 }, b = handles?.b || { x: 1, y: .5 };
        g.fillStyle = add(g.createLinearGradient(a.x, a.y, b.x, b.y));
    }
    else {
        const c = handles?.a || { x: .5, y: .5 }, bx = handles?.b || { x: 1, y: .5 }, by = handles?.c || { x: .5, y: 1 };
        // Map the unit circle onto the gradient's ellipse (its axes can be rotated and skewed).
        g.transform(bx.x - c.x, bx.y - c.y, by.x - c.x, by.y - c.y, c.x, c.y);
        g.fillStyle = f.type === 'angular' && g.createConicGradient ? add(g.createConicGradient(0, 0, 0)) : add(g.createRadialGradient(0, 0, 0, 0, 0, f.type === 'diamond' ? 1.2 : 1));
    }
    g.fillRect(-1000, -1000, 2000, 2000);
    return { canvas, k, cw, ch };
}
