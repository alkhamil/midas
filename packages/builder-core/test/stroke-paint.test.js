import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDomTree } from '../src/index.js';
import { paintServerOf } from '../src/geometry/paint-server.js';

const frame = extra => ({ id: 'f1', type: 'frame', name: 'F', x: 0, y: 0, w: 200, h: 100, parentId: null, fills: [{ type: 'solid', color: '#ffffff', visible: true }], strokeWidth: 4, stroke: '#000000', ...extra });
const treeOf = (n, assets = {}) => JSON.stringify(toDomTree({ pages: [{ id: 'p', name: 'P', nodes: [n] }], assets, variables: {} }, n.id).root);

test('a gradient stroke paint is a paint server Play draws the stroke with', () => {
  const sf = { type: 'linear', color: '#ff0000', color2: '#0000ff', opacity: 1, visible: true };
  const out = treeOf(frame({ strokeFill: sf }));
  assert.match(out, /stroke=\\"url\(#midas-sp-f1\)\\"/);
  assert.match(out, /<linearGradient id=\\"midas-sp-f1\\"/);
  assert.ok(!treeOf(frame({ strokeFill: { type: 'solid', color: '#00ff00', visible: true } })).includes('midas-sp-'), 'a solid paint is the stroke colour, no server');
});

test('a pattern, a picture and a video poster stroke are paint servers with their tile or picture', () => {
  const box = { w: 200, h: 100 }, assets = { a: 'data:image/png;base64,AAAA' };
  const p = paintServerOf({ type: 'pattern', image: 'a', tileType: 'HORIZONTAL_HEXAGONAL', iw: 10, ih: 10, scale: 1, spacingX: 0, spacingY: 0, visible: true }, 'x', box, assets);
  assert.match(p.defs, /<pattern id="x"[^>]*width="10" height="20"/);
  assert.equal((p.defs.match(/<image /g) || []).length, 2);
  const i = paintServerOf({ type: 'image', image: 'a', mode: 'fit', visible: true }, 'y', box, assets);
  assert.match(i.defs, /preserveAspectRatio="xMidYMid meet"/);
  const v = paintServerOf({ type: 'video', video: 'v', poster: 'a', mode: 'fill', visible: true }, 'z', box, assets);
  assert.match(v.defs, /xMidYMid slice/);
  assert.equal(paintServerOf({ type: 'image', image: 'missing', visible: true }, 'q', box, assets), null, 'no asset, no server');
  assert.equal(paintServerOf({ type: 'angular', color: '#112233', color2: '#ffffff', visible: true }, 'r', box, assets).paint, '#112233', 'angular has no svg server: its first colour');
});
