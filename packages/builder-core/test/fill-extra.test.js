import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hexToRgb, rgbToHex, rgbToHsl, hslToRgb, rgbToHsv, hsvToRgb, colorFormats, colorFromFormat, documentColors,
  gradientAddStop, gradientRemoveStop, gradientSetStop, gradientReverse, gradientCss,
  IMAGE_MODES, GRADIENT_TYPES, PATTERN_TILE_TYPES, VIDEO_MODES,
  imageFillLayout, imageRotationOf, imageTransformOf, imageAdjustFilter, imageSvgLayer,
  patternLayout, patternFillCss, patternSourceOf, patternTileId,
  videoObjectFit, videoObjectPosition, videoPosterOf, hasVideoFill,
  moveFill, visibleFillsOf, cssBackgroundOf,
  parseCssColor, gradientHandlePoints, gradientHandleMove, cropZoomFor, cropRotateFor,
  moveStopKeys, gradientColorAt, patternCellOf, patternStepOf, contrastRatio, wcagLevels, patternTileOf, patternPhaseOf, patternSvgLayer, imageSvgUrl, cropCssVars, remapFillKeys, moveFillKeys,
  shiftStopKeys, stopBindingKey, parseStopKey, fillParamType,
} from '../src/geometry/fills.js';

test('color formats round trip without changing the color', () => {
  assert.deepEqual(hexToRgb('#ff0000'), [255, 0, 0]);
  assert.deepEqual(hexToRgb('#0f0'), [0, 255, 0]);
  assert.equal(rgbToHex(255, 0, 0), '#ff0000');
  const cf = colorFormats('#ff0000');
  assert.deepEqual(cf.rgb, { r: 255, g: 0, b: 0 });
  assert.equal(colorFromFormat('hex', { hex: 'FF0000' }), '#ff0000');
  assert.equal(colorFromFormat('rgb', { r: 255, g: 0, b: 0 }), '#ff0000');
  assert.equal(colorFromFormat('hsl', { h: 0, s: 1, l: 0.5 }), '#ff0000');
  assert.equal(colorFromFormat('hsb', { h: 0, s: 1, v: 1 }), '#ff0000');
  const hsl = rgbToHsl(255, 0, 0);
  assert.deepEqual(hslToRgb(hsl.h, hsl.s, hsl.l).map(Math.round), [255, 0, 0]);
  const hsv = rgbToHsv(255, 0, 0);
  assert.deepEqual(hsvToRgb(hsv.h, hsv.s, hsv.v).map(Math.round), [255, 0, 0]);
});

test('document colors list solid and gradient colors in first seen order', () => {
  const nodes = [{ fills: [{ type: 'solid', color: '#ff0000', visible: true }] }, { fills: [{ type: 'linear', color: '#00ff00', color2: '#0000ff', visible: true }] }];
  assert.deepEqual(documentColors(nodes), ['#ff0000', '#00ff00', '#0000ff']);
});

test('gradient stops add remove set and reverse share one pure path', () => {
  const base = { type: 'linear', color: '#000000', color2: '#ffffff' };
  const added = gradientAddStop(base, 0.5);
  assert.equal(added.stops.length, 3);
  const removed = gradientRemoveStop(added, 1);
  assert.equal(removed.stops.length, 2);
  const floor = gradientRemoveStop(base, 0);
  assert.equal(floor.stops.length, 2);
  const set = gradientSetStop(base, 0, { color: '#111111' });
  assert.equal(set.color, '#111111');
  const rev = gradientReverse({ type: 'linear', stops: [{ pos: 0, color: '#000000' }, { pos: 1, color: '#ffffff' }], color: '#000000', color2: '#ffffff' });
  assert.equal(rev.stops[0].color, '#ffffff');
  assert.ok(gradientCss(rev).layer.length > 0);
  assert.deepEqual(GRADIENT_TYPES, ['linear', 'radial', 'angular', 'diamond']);
});

test('image modes cover fill fit crop and tile with rotation and adjustments from one function', () => {
  assert.deepEqual(IMAGE_MODES, ['fill', 'fit', 'crop', 'tile']);
  assert.equal(imageFillLayout({ mode: 'fill' }).size, 'cover');
  assert.equal(imageFillLayout({ mode: 'fit' }).size, 'contain');
  assert.equal(imageFillLayout({ mode: 'tile' }).repeat, 'repeat');
  assert.equal(imageFillLayout({ mode: 'tile', scale: 2, iw: 10, ih: 20 }).size, '20px 40px');
  assert.equal(imageFillLayout({ mode: 'tile', scale: 2 }), null);
  const crop = imageFillLayout({ mode: 'crop', crop: { x: 0.25, y: 0.75, scale: 2 } });
  assert.match(crop.position, /25% 75%/);
  assert.equal(imageRotationOf({ rotation: 30 }), 30);
  assert.equal(imageRotationOf({ crop: { rotation: 15 } }), 15);
  assert.equal(imageTransformOf({ rotation: 30 }), 'rotate(30deg)');
  assert.equal(imageTransformOf({}), '');
  assert.equal(imageAdjustFilter({}), '');
  assert.match(imageAdjustFilter({ adjust: { exposure: 0.2, contrast: 0.1 } }), /brightness.*contrast/);
  const assets = { a: 'data:image/png;base64,AAAA' };
  assert.equal(imageSvgLayer({ type: 'image', image: 'a', mode: 'fill' }, assets), null);
  assert.ok(imageSvgLayer({ type: 'image', image: 'a', mode: 'crop', crop: { x: 0.5, y: 0.5, scale: 2 } }, assets).layer.includes('data:image/svg+xml'));
  assert.ok(imageSvgLayer({ type: 'image', image: 'a', mode: 'fill', rotation: 45 }, assets).layer.includes('rotate'));
});

test('pattern tile resolves live linked source at render time with scale spacing and alignment', () => {
  assert.deepEqual(PATTERN_TILE_TYPES, ['RECTANGULAR', 'HORIZONTAL_HEXAGONAL', 'VERTICAL_HEXAGONAL']);
  assert.equal(patternLayout({}).repeat, 'repeat');
  assert.equal(patternLayout({ align: 'center' }).position, '50% 50%');
  const assets = { t: 'data:image/png;base64,AAAA' };
  const byId = id => (id === 'src' ? { assetId: 't' } : null);
  assert.equal(patternSourceOf({ type: 'pattern', source: 'src' }, byId).assetId, 't');
  assert.ok(patternFillCss({ type: 'pattern', source: 'src' }, assets, byId).layer.includes('data:image/png'));
  assert.equal(patternFillCss({ type: 'pattern', source: 'missing' }, assets, byId), null);
  assert.ok(cssBackgroundOf([{ type: 'pattern', source: 'src', visible: true }], assets, byId).background.length > 0);
});

test('video is static on canvas and a video element in Play and export with object fit from mode', () => {
  assert.deepEqual(VIDEO_MODES, ['fill', 'fit', 'crop', 'tile']);
  assert.equal(videoObjectFit('fill'), 'cover');
  assert.equal(videoObjectFit('fit'), 'contain');
  assert.equal(videoObjectFit('crop'), 'cover');
  assert.equal(videoObjectPosition({ mode: 'crop', crop: { x: 0.25, y: 0.5 } }), '25% 50%');
  assert.equal(videoObjectPosition({ mode: 'fill' }), 'center');
  const assets = { v: 'data:video/mp4;base64,AAAA', p: 'data:image/png;base64,AAAA' };
  assert.equal(videoPosterOf({ poster: 'p' }, assets), assets.p);
  assert.equal(videoPosterOf({}, assets), null);
  assert.equal(hasVideoFill({ visible: true, fills: [{ type: 'video', video: 'v', visible: true }] }), true);
  assert.equal(hasVideoFill({ visible: false, fills: [{ type: 'video', video: 'v', visible: true }] }), false);
  assert.equal(cssBackgroundOf([{ type: 'video', video: 'v', visible: true }], assets).background, '');
});

test('fill param keys bind by value type: sources kinds and modes are strings, sizes numbers', () => {
  for (const key of ['source', 'tileType', 'align', 'mode', 'video', 'image', 'poster']) assert.equal(fillParamType(`fills.2.${key}`), 'string', key);
  for (const key of ['scale', 'spacingX', 'spacingY']) assert.equal(fillParamType(`fills.0.${key}`), 'number', key);
  assert.equal(fillParamType('fills.0'), null);
  assert.equal(fillParamType('fills.0.stop.1'), null);
  assert.equal(fillParamType('fills.0.color'), null);
  assert.equal(fillParamType('fill'), null);
});

test('fill list order visibility and stacking from one pure path with no hidden fills by code', () => {
  const fills = [{ type: 'solid', color: '#ff0000', visible: true }, { type: 'solid', color: '#00ff00', visible: true }];
  assert.deepEqual(moveFill(fills, 0, 1).map(f => f.color), ['#00ff00', '#ff0000']);
  assert.equal(moveFill(fills, 0, 5), fills);
  assert.deepEqual(visibleFillsOf({ fills: [{ type: 'solid', color: '#111111', visible: false }, { type: 'solid', color: '#222222', visible: true }] }).map(f => f.color), ['#222222']);
  const stacked = cssBackgroundOf([{ type: 'solid', color: '#ff0000', visible: true }, { type: 'solid', color: '#00ff00', visible: false }]);
  assert.ok(stacked.background.includes('#ff0000') && !stacked.background.includes('#00ff00'));
});

test('css colours parse to the same rgb in every notation, and unknown text parses to nothing', () => {
  assert.deepEqual(parseCssColor('#ff0000'), { r: 255, g: 0, b: 0 });
  assert.deepEqual(parseCssColor('#f00'), { r: 255, g: 0, b: 0 });
  assert.deepEqual(parseCssColor('rgb(255, 0, 0)'), { r: 255, g: 0, b: 0 });
  assert.deepEqual(parseCssColor('rgb(255 0 0)'), { r: 255, g: 0, b: 0 });
  assert.deepEqual(parseCssColor('rgba(255, 0, 0, 0.5)'), { r: 255, g: 0, b: 0 });
  assert.deepEqual(parseCssColor('  RGB( 10 , 20 , 30 ) '), { r: 10, g: 20, b: 30 });
  assert.equal(parseCssColor('banana'), null);
  assert.equal(parseCssColor(''), null);
  assert.equal(colorFromFormat('css', { text: 'rgb(255, 0, 0)' }), '#ff0000');
  assert.equal(colorFromFormat('css', { text: 'banana' }), null);
  assert.equal(colorFromFormat('css', { r: 0, g: 128, b: 255 }), '#0080ff');
  assert.equal(colorFromFormat('hsl', { h: 0, s: 1, l: 0.5 }), '#ff0000');
  assert.equal(colorFromFormat('hsb', { h: 120, s: 1, v: 1 }), '#00ff00');
});

test('a stop alpha rides in the stop and the export draws it, while a plain gradient stays plain css', () => {
  assert.equal(gradientCss({ type: 'linear', color: '#000000', color2: '#ffffff' }).layer, 'linear-gradient(180deg, #000000, #ffffff)');
  const withAlpha = gradientCss({ type: 'linear', color: '#000000', color2: '#ffffff', stops: [{ pos: 0, color: '#000000' }, { pos: 0.5, color: '#ff0000', alpha: 0.5 }, { pos: 1, color: '#ffffff' }] }).layer;
  assert.match(withAlpha, /data:image\/svg\+xml/);
  assert.match(decodeURIComponent(withAlpha.slice(withAlpha.indexOf(',') + 1, withAlpha.indexOf('")'))), /stop-opacity="0.5"/);
  const set = gradientSetStop({ type: 'linear', color: '#000000', color2: '#ffffff' }, 1, { pos: 0.5, alpha: 0.5 });
  assert.equal(set.stops[1].alpha, 0.5);
  const cleared = gradientSetStop({ type: 'linear', color: '#000000', color2: '#ffffff', stops: [{ pos: 0, color: '#000000' }, { pos: 0.5, color: '#ff0000', alpha: 0.5 }, { pos: 1, color: '#ffffff' }] }, 1, { alpha: 1 });
  assert.equal('alpha' in cleared.stops[1], false);
});

test('gradient handles default per type and a drag moves one point clamped, keeping the others', () => {
  assert.deepEqual(gradientHandlePoints({ type: 'linear' }), { a: { x: 0, y: 0.5 }, b: { x: 1, y: 0.5 } });
  assert.deepEqual(gradientHandlePoints({ type: 'radial' }), { a: { x: 0.5, y: 0.5 }, b: { x: 1, y: 0.5 }, c: { x: 0.5, y: 1 } });
  const moved = gradientHandleMove({ type: 'linear', color: '#000000', color2: '#ffffff' }, 'b', { x: 0.8, y: 0.2 });
  assert.deepEqual([gradientHandlePoints(moved).a, moved.handles.b], [{ x: 0, y: 0.5 }, { x: 0.8, y: 0.2 }]);
  assert.deepEqual(gradientHandleMove({ type: 'linear' }, 'a', { x: 9, y: -9 }).handles.a, { x: 2, y: -1 });
  assert.deepEqual(gradientHandleMove({ type: 'linear', handles: { a: { x: 0.1, y: 0.1 }, b: { x: 0.9, y: 0.9 } } }, 'c', { x: 0.5, y: 0.5 }).handles.c, undefined);
});

test('crop zoom follows the drag ratio and rotation normalises with optional snap', () => {
  assert.equal(cropZoomFor(2, 100, 50), 4);
  assert.equal(cropZoomFor(2, 100, 400), 0.5);
  assert.equal(cropZoomFor(8, 100, 10), 8);
  assert.equal(cropZoomFor(0.2, 100, 1000), 0.2);
  assert.equal(cropRotateFor(0, 0, 90, false), 90);
  assert.equal(cropRotateFor(170, 0, 30, false), -160);
  assert.equal(cropRotateFor(0, 0, 92, true), 90);
});

test('pattern tiles from the recorded natural size, phases by alignment, and draws one svg shared by every surface', () => {
  assert.equal(patternTileOf({ type: 'pattern' }), null);
  const f = { type: 'pattern', source: 's', scale: 2, spacingX: 4, spacingY: 6, iw: 10, ih: 20, visible: true };
  assert.deepEqual(patternTileOf(f), { tileW: 20, tileH: 40, stepX: 20.8, stepY: 42.4 });
  assert.deepEqual(patternPhaseOf(f, 100, 100), { x: 0, y: 0 });
  assert.deepEqual(patternPhaseOf({ ...f, align: 'center' }, 100, 100), { x: 8.4, y: 7.6 });
  assert.deepEqual(patternPhaseOf({ ...f, align: 'bottom-right' }, 100, 100), { x: 16.8, y: 15.2 });
  const assets = { t: 'data:image/png;base64,AAAA' };
  const byId = id => (id === 's' ? { assetId: 't' } : null);
  const layer = patternSvgLayer(f, assets, byId);
  assert.ok(layer.image.startsWith('url("data:image/svg+xml,'));
  assert.equal(layer.size, '20.8px 42.4px');
  assert.equal(layer.repeat, 'repeat');
  const withBox = patternSvgLayer({ ...f, align: 'bottom-right' }, assets, byId, { w: 100, h: 100 });
  assert.equal(withBox.position, '16.8px 15.2px');
  assert.equal(patternSvgLayer({ ...f, align: 'center' }, assets, byId).position, '50% 50%');
  assert.equal(patternSvgLayer({ type: 'pattern', source: 'missing' }, assets, byId), null);
  const stacked = cssBackgroundOf([{ ...f, align: 'center' }], assets, byId, { w: 100, h: 100 });
  assert.ok(stacked.background.includes('data:image/svg+xml'));
  assert.ok(stacked.background.includes('8.4px 7.6px'));
  const fallback = cssBackgroundOf([{ type: 'pattern', source: 's' }], assets, byId);
  assert.ok(fallback.background.includes('data:image/png'));
});

test('an image svg url carries the crop rotation and adjustments for every surface', () => {
  const assets = { a: 'data:image/png;base64,AAAA' };
  assert.equal(imageSvgUrl({ type: 'image', image: 'a', mode: 'fill' }, assets), null);
  const url = imageSvgUrl({ type: 'image', image: 'a', mode: 'crop', crop: { x: 0.25, y: 0.25, scale: 2 }, rotation: 30, adjust: { exposure: 0.2 } }, assets);
  assert.ok(url.startsWith('data:image/svg+xml,'));
  const svg = decodeURIComponent(url);
  assert.match(svg, /rotate\(30 0.5 0.5\)/);
  assert.match(svg, /<filter id="filter">/);
});

test('a pattern fill resolves to its own asset or its live linked source layer picture, never a snapshot', () => {
  const byId = id => (id === 'src' ? { assetId: 't' } : id === 'plain' ? { fills: [{ type: 'image', image: 'u', visible: true }] } : null);
  assert.equal(patternTileId({ type: 'pattern', image: 't' }, byId), 't');
  assert.equal(patternTileId({ type: 'pattern', source: 'src' }, byId), 't');
  assert.equal(patternTileId({ type: 'pattern', source: 'plain' }, byId), 'u');
  assert.equal(patternTileId({ type: 'pattern', source: 'missing' }, byId), null);
  assert.equal(patternTileId({ type: 'pattern', source: 'src' }), null, 'no lookup resolves nothing');
  assert.equal(patternTileId({ type: 'solid', color: '#ff0000' }, byId), null);
});

test('an image svg layer carries the same longhands as its pattern sibling, so Play draws it from the same fields', () => {
  const assets = { a: 'data:image/png;base64,AAAA' };
  const svg = imageSvgLayer({ type: 'image', image: 'a', mode: 'crop', crop: { x: 0.25, y: 0.25, scale: 2 }, rotation: 30, adjust: { exposure: 0.2 } }, assets);
  assert.ok(svg.layer.startsWith('url("data:image/svg+xml,'));
  assert.equal(svg.image, svg.layer.slice(0, svg.layer.indexOf('")') + 2));
  assert.deepEqual([svg.size, svg.position, svg.repeat], ['100% 100%', '0 0', 'no-repeat']);
  assert.equal(imageSvgLayer({ type: 'image', image: 'a', mode: 'fill' }, assets), null);
});

test('a crop window reads as background position and size from the normalized point and zoom', () => {
  assert.deepEqual(cropCssVars({ x: 0.25, y: 0.75, zoom: 2 }), { position: '25% 75%', size: '200%' });
  assert.deepEqual(cropCssVars({}), { position: '50% 50%', size: 'cover' });
  assert.deepEqual(cropCssVars({ x: 2, y: -1, zoom: 1 }), { position: '100% 0%', size: 'cover' });
  assert.deepEqual(cropCssVars({ x: 1 / 3, y: 2 / 3, zoom: 1.5 }), { position: '33.33% 66.67%', size: '150%' });
});

test('fill variable keys remap across fill and stop edits without touching other keys', () => {
  assert.equal(stopBindingKey(0, 2), 'fills.0.stop.2');
  assert.deepEqual(parseStopKey('fills.0.stop.2'), { i: 0, k: 2 });
  assert.equal(parseStopKey('fills.0'), null);
  assert.equal(parseStopKey('fill'), null);
  const vars = { 'fills.0': 'a', 'fills.0.stop.1': 'b', 'fills.1': 'c', 'fills.1.stop.0': 'd', other: 'e' };
  assert.deepEqual(remapFillKeys(vars, 1, 1), { 'fills.0': 'a', 'fills.0.stop.1': 'b', 'fills.2': 'c', 'fills.2.stop.0': 'd', other: 'e' });
  assert.deepEqual(remapFillKeys(vars, 1, -1, 0), { 'fills.0': 'c', 'fills.0.stop.0': 'd', other: 'e' });
  assert.deepEqual(moveFillKeys(vars, 0, 1), { 'fills.1': 'a', 'fills.1.stop.1': 'b', 'fills.0': 'c', 'fills.0.stop.0': 'd', other: 'e' });
  assert.deepEqual(shiftStopKeys({ 'fills.0.stop.1': 'b', 'fills.0.stop.2': 'c', 'fills.0': 'a' }, 0, 1, 1), { 'fills.0.stop.2': 'b', 'fills.0.stop.3': 'c', 'fills.0': 'a' });
  assert.deepEqual(shiftStopKeys({ 'fills.0.stop.1': 'b', 'fills.0.stop.2': 'c' }, 0, 1, -1, 1), { 'fills.0.stop.1': 'c' });
});

test('pattern tile types, percentage spacing, blend modes and contrast follow Figma', () => {
  assert.deepEqual(patternCellOf('RECTANGULAR', 10, 20), { W: 10, H: 20, at: [[0, 0]] });
  assert.deepEqual(patternCellOf('HORIZONTAL_HEXAGONAL', 10, 20), { W: 10, H: 40, at: [[0, 0], [5, 20]] });
  assert.deepEqual(patternCellOf('VERTICAL_HEXAGONAL', 10, 20), { W: 20, H: 20, at: [[0, 0], [10, 10]] });
  assert.deepEqual(patternStepOf(100, 50, { spacingX: 20, spacingY: 20 }), { stepX: 120, stepY: 60 });
  assert.equal(contrastRatio('#000000', '#ffffff'), 21);
  assert.equal(contrastRatio('#ffffff', '#ffffff'), 1);
  assert.deepEqual(wcagLevels(4.6), { aa: true, aaLarge: true, aaa: false, aaaLarge: true });
  const out = cssBackgroundOf([{ type: 'solid', color: '#ff0000', visible: true, blend: 'multiply' }, { type: 'solid', color: '#0000ff', visible: true }]);
  assert.equal(out.blend, 'multiply, normal');
  assert.equal(cssBackgroundOf([{ type: 'solid', color: '#ff0000', visible: true }]).blend, undefined);
});

test('a gradient has a blended colour at any position, for a stop added by a click on the bar', () => {
  const f = { type: 'linear', color: '#000000', color2: '#ffffff' };
  assert.equal(gradientColorAt(f, 0), '#000000');
  assert.equal(gradientColorAt(f, 1), '#ffffff');
  assert.equal(gradientColorAt(f, 0.5), '#808080');
});

test('a plain linear gradient puts its canvas handles on its angle line; a stop that crosses its neighbours takes its variable with it', () => {
  const p = gradientHandlePoints({ type: 'linear', angle: 0 }, { w: 200, h: 100 });
  assert.deepEqual([p.a.x, p.a.y, p.b.x, p.b.y], [0, 0.5, 1, 0.5]);
  const v = gradientHandlePoints({ type: 'linear', angle: 90 }, { w: 200, h: 100 });
  assert.deepEqual([v.a.x, v.a.y, v.b.x, v.b.y].map(x => Math.round(x * 1000) / 1000 + 0), [0.5, 0, 0.5, 1]);
  assert.deepEqual(gradientHandlePoints({ type: 'linear' }).a, { x: 0, y: 0.5 }, 'no box keeps the default line');
  const vars = { 'fills.0.stop.1': 'a', 'fills.0.stop.2': 'b', 'fills.1.stop.1': 'c' };
  assert.deepEqual(moveStopKeys(vars, 0, 1, 2), { 'fills.0.stop.2': 'a', 'fills.0.stop.1': 'b', 'fills.1.stop.1': 'c' });
  assert.deepEqual(moveStopKeys(vars, 0, 2, 1), { 'fills.0.stop.1': 'b', 'fills.0.stop.2': 'a', 'fills.1.stop.1': 'c' });
});
