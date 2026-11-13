import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDomTree } from '../src/index.js';
import { paintLayerOf } from '../src/geometry/paint-layer.js';

const frame = extra => ({ id: 'f1', type: 'frame', name: 'F', x: 0, y: 0, w: 200, h: 100, parentId: null, fills: [{ type: 'solid', color: '#ffffff', visible: true }], strokeWidth: 4, stroke: '#000000', ...extra });
const treeOf = (n, assets = {}) => JSON.stringify(toDomTree({ pages: [{ id: 'p', name: 'P', nodes: [n] }], assets, variables: {} }, n.id).root);

test('a gradient stroke paint is a layer clipped by the stroke area, in the frame own overlay', () => {
  const sf = { type: 'linear', color: '#ff0000', color2: '#0000ff', opacity: 1, visible: true };
  const out = treeOf(frame({ strokeFill: sf }));
  assert.match(out, /<linearGradient id=\\"midas-sp-f1\\"/);
  assert.match(out, /<clipPath id=\\"midas-sp-f1k\\"><path data-area d=\\"M/);
  assert.match(out, /<g clip-path=\\"url\(#midas-sp-f1k\)\\" data-paint-content><rect [^>]*fill=\\"url\(#midas-sp-f1\)\\"/);
  assert.ok(!treeOf(frame({ strokeFill: { type: 'solid', color: '#00ff00', visible: true } })).includes('midas-sp-'), 'a solid paint is the stroke colour, no layer');
});

test('a pattern, a picture and a video poster stroke are layers with their tile or picture', () => {
  const box = { w: 200, h: 100 }, assets = { a: 'data:image/png;base64,AAAA' };
  const p = paintLayerOf({ type: 'pattern', image: 'a', tileType: 'HORIZONTAL_HEXAGONAL', iw: 10, ih: 10, scale: 1, spacingX: 0, spacingY: 0, visible: true }, 'x', box, assets);
  assert.match(p.defs, /<pattern id="x"[^>]*width="10" height="20"/);
  assert.equal((p.defs.match(/<image /g) || []).length, 2);
  assert.match(p.content, /fill="url\(#x\)"/);
  const i = paintLayerOf({ type: 'image', image: 'a', mode: 'fit', iw: 20, ih: 10, visible: true }, 'y', box, assets);
  assert.match(i.content, /<image href="data:image\/png;base64,AAAA" x="0" y="0" width="200" height="100" preserveAspectRatio="none"/, 'a 2:1 picture fits a 2:1 box');
  const v = paintLayerOf({ type: 'video', video: 'v', poster: 'a', mode: 'fill', iw: 10, ih: 10, visible: true }, 'z', box, assets);
  assert.match(v.content, /x="0" y="-50" width="200" height="200"/, 'a square poster covers the box and reaches past it on one axis');
  assert.equal(paintLayerOf({ type: 'image', image: 'missing', iw: 4, ih: 4, visible: true }, 'q', box, assets), null, 'no asset, no layer');
  assert.equal(paintLayerOf({ type: 'image', image: 'a', visible: true }, 'q', box, assets), null, 'no measured size, no layer');
  assert.match(paintLayerOf({ type: 'angular', color: '#112233', color2: '#ffffff', visible: true }, 'r', box, assets).content, /fill="#112233"/, 'angular has no svg paint server: its first colour');
});

test('Play paints an angular or a diamond stroke as a raster of the canvas own gradient, never a radialGradient', () => {
  const box = { w: 200, h: 100 };
  for (const type of ['angular', 'diamond']) {
    const layer = paintLayerOf({ type, color: '#ff0000', color2: '#0000ff', visible: true }, 'r', box, {}, undefined, { raster: true, pad: 4 });
    assert.ok(!layer.defs.includes('radialGradient') && !layer.content.includes('radialGradient'), type);
    assert.match(layer.content, /<image data-raster="[^"]*" x="-4" y="-4" width="208" height="108" preserveAspectRatio="none"\/>/, type);
    const source = JSON.parse(layer.content.match(/data-raster="([^"]*)"/)[1].replace(/&quot;/g, '"'));
    assert.deepEqual([source.paint.type, source.w, source.h, source.pad], [type, 200, 100, 4]);
  }
});
