// The fills the engine has (Solid, the four gradients, Image) on the surfaces that derive from the canvas: one pure function per type shared by the generic background, Play and
// the export; no hidden fill (a layer's fallback colour is a bound variable, not a Fill-list entry); an instance's own picture fit reaches the export as a prop.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cssBackgroundOf, gradientCss, gradientStops, isGradientFill, patternSvgLayer } from '../src/geometry/fills.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { nodeFieldPatch } from '../src/behavior-engine/display.js';
import { generateComponent, gradientLayerOf, patternLayerOf } from '../src/behavior-engine/codegen.js';
import { modelFor } from './helpers/box-template.js';

const svgOf = layer => decodeURIComponent(layer.slice(layer.indexOf(',') + 1, layer.indexOf('")')));

test('gradient stops: the stops sorted, the first and last following the two colours; two colours when it holds no stops', () => {
    assert.deepEqual(gradientStops({ color: '#111111', color2: '#eeeeee' }), [{ pos: 0, color: '#111111' }, { pos: 1, color: '#eeeeee' }]);
    const stops = gradientStops({ color: '#000000', color2: '#ffffff', stops: [{ pos: 1, color: '#aaaaaa' }, { pos: 0.4, color: '#bbbbbb' }, { pos: 0, color: '#cccccc' }] });
    assert.deepEqual(stops.map(s => [s.pos, s.color]), [[0, '#000000'], [0.4, '#bbbbbb'], [1, '#ffffff']]);
});

test('a plain linear gradient is a CSS linear gradient at the canvas angle plus 90; with its fill opacity in every colour', () => {
    assert.equal(gradientCss({ type: 'linear', color: '#000000', color2: '#ffffff', angle: 0 }).layer, 'linear-gradient(90deg, #000000, #ffffff)');
    assert.equal(gradientCss({ type: 'linear', color: '#000000', color2: '#ffffff', angle: 90, opacity: 0.5 }).layer, 'linear-gradient(180deg, #00000080, #ffffff80)');
});

test('a linear gradient with handles or many stops is an SVG gradient from handle a to handle b in the layer\'s unit space, with every stop', () => {
    const layer = gradientCss({ type: 'linear', color: '#000000', color2: '#ffffff', handles: { a: { x: 0.1, y: 0.2 }, b: { x: 0.9, y: 0.8 } }, stops: [{ pos: 0, color: '#000000' }, { pos: 0.5, color: '#ff0000' }, { pos: 1, color: '#ffffff' }] }).layer;
    const svg = svgOf(layer);
    assert.match(svg, /<linearGradient id="g" x1="0.1" y1="0.2" x2="0.9" y2="0.8">/);
    assert.equal((svg.match(/<stop /g) ?? []).length, 3);
    assert.match(svg, /offset="0.5" stop-color="#ff0000"/);
    assert.match(layer, / 0 0 \/ 100% 100% no-repeat$/);
});

test('radial and diamond fills map the unit circle onto the ellipse the handles give (a diamond reaches 1.2); an angular one is a conic from its axis', () => {
    const handles = { a: { x: 0.5, y: 0.5 }, b: { x: 1, y: 0.5 }, c: { x: 0.5, y: 1 } };
    assert.match(svgOf(gradientCss({ type: 'radial', color: '#000000', color2: '#ffffff', handles }).layer), /<radialGradient id="g" cx="0" cy="0" r="1" gradientTransform="matrix\(0.5 0 0 0.5 0.5 0.5\)">/);
    assert.match(svgOf(gradientCss({ type: 'diamond', color: '#000000', color2: '#ffffff', handles }).layer), /r="1.2"/);
    assert.equal(gradientCss({ type: 'angular', color: '#000000', color2: '#ffffff', handles: { a: { x: 0.25, y: 0.75 }, b: { x: 0.25, y: 0.25 } } }).layer, 'conic-gradient(from 0deg at 25% 75%, #000000 0%, #ffffff 100%)');
    assert.match(svgOf(gradientCss({ type: 'radial', color: '#000000', color2: '#ffffff', opacity: 0.4 }).layer), /opacity="0.4"/);
});

test('every gradient type draws in the generic background (none is reported as unsupported), a hidden fill is left out, and the fill list stacks top first', () => {
    for (const type of ['linear', 'radial', 'angular', 'diamond']) {
        assert.ok(isGradientFill({ type }));
        const out = cssBackgroundOf([{ type, color: '#000000', color2: '#ffffff', visible: true }]);
        assert.deepEqual(out.unsupported, [], type);
        assert.ok(out.background.length > 0, type);
    }
    const stacked = cssBackgroundOf([{ type: 'solid', color: '#ff0000', visible: true }, { type: 'solid', color: '#00ff00', visible: false }, { type: 'linear', color: '#000000', color2: '#ffffff', visible: true }]);
    assert.ok(stacked.background.includes('#ff0000') && !stacked.background.includes('#00ff00'), 'the hidden fill is not in the list');
});

test('a layer that gets a picture keeps its other fills as they are and gains exactly the image fill: no hidden fill is added or made', () => {
    const none = nodeFieldPatch('imageFill', 'a', 'frame', { fills: [] }).fills;
    assert.deepEqual(none.map(f => [f.type, f.visible]), [['image', true]], 'a layer with no fill has one row, the picture');
    const coloured = nodeFieldPatch('imageFill', 'a', 'frame', { fills: [{ type: 'solid', color: '#ff0000', visible: true }] }).fills;
    assert.deepEqual(coloured.map(f => [f.type, f.visible]), [['solid', true], ['image', true]], 'the colour fill the designer made stays as it is');
    assert.deepEqual(nodeFieldPatch('imageFill', null, 'frame', { fills: coloured }).fills.map(f => f.type), ['solid'], 'no picture removes the image fill and nothing else');
});

test('a new source keeps the mode and the scale and drops the natural size of the old picture, which the studio measures again from the new asset', () => {
    const own = { type: 'image', image: 'a', mode: 'tile', scale: 0.5, iw: 80, ih: 40, opacity: 1, visible: true };
    const next = nodeFieldPatch('imageFill', 'b', 'frame', { fills: [own] }).fills[0];
    assert.deepEqual([next.image, next.mode, next.scale, 'iw' in next], ['b', 'tile', 0.5, false]);
    assert.equal(nodeFieldPatch('imageFill', 'a', 'frame', { fills: [own] }).fills[0].iw, 80, 'the same picture keeps its size');
});

test('the export gives an instance its own rotation, adjustment and video source as props, inheriting the main component values when it says nothing', () => {
    const card = TEMPLATES.get('antd-card');
    const model = modelFor(card);
    const out = generateComponent(card, model.binding, model.variables, 'Card', model.frame, id => model.created.filter(n => n.parentId === id));
    const source = out.files['Card.jsx'] ?? out.files['Card.tsx'];
    for (const prop of ['coverImageRotate', 'coverImageFilter', 'coverImageVideo']) {
        assert.match(source, new RegExp(prop + '\\?'), prop + ' is a prop');
        assert.match(source, new RegExp('data-coverImage-' + prop.slice('coverImage'.length).toLowerCase() + '=\\{' + prop), prop + ' reaches a data attribute');
    }
    assert.match(source, /\{coverImageVideo && <video src=\{coverImageVideo\} autoPlay=\{coverImageAutoplay \?\? true\} loop=\{coverImageLoop \?\? true\} muted=\{!coverImageSound\} playsInline \/>\}/, 'a video element on the cover layer, only while the instance sets a source');
    const css = out.files['Card.css'];
    assert.match(css, /\.antd-card\[data-coverImage-rotate\][^{]*\{[^}]*rotate: var\(--antd-card-coverImage-rotate\);/, 'rotation reads the custom property');
    assert.match(css, /\.antd-card\[data-coverImage-filter\][^{]*\{[^}]*filter: var\(--antd-card-coverImage-filter\);/, 'the adjustment reads the custom property');
    assert.match(css, /\.antd-card\[data-coverImage-video\] \.antd-card-belowBox video \{[^}]*object-fit: cover;/, 'the video covers the box by default');
    assert.match(css, /\.antd-card\[data-coverImage-fit="fit"\]\[data-coverImage-video\] \.antd-card-belowBox video \{[^}]*object-fit: contain;/, 'the fit prop overrides the video fit per instance');
});

test('the export gives an instance its own crop window as a prop: two instances with different crops export different CSS', () => {
    const card = TEMPLATES.get('antd-card');
    const model = modelFor(card);
    const out = generateComponent(card, model.binding, model.variables, 'Card', model.frame, id => model.created.filter(n => n.parentId === id));
    const source = out.files['Card.jsx'] ?? out.files['Card.tsx'];
    assert.match(source, /coverImageCrop\?: \{ x\?: number; y\?: number; zoom\?: number \}/, 'crop is a prop');
    assert.match(source, /data-coverImage-crop=\{coverImageCrop \? "" : undefined\}/, 'crop reaches a data attribute');
    assert.match(source, /--antd-card-coverImage-croppos/, 'the anchor rides a custom property');
    assert.match(source, /--antd-card-coverImage-cropsize/, 'the zoom rides a custom property');
    const css = out.files['Card.css'];
    assert.match(css, /\.antd-card\[data-coverImage-crop\][^{]*\{[^}]*background-position: var\(--antd-card-coverImage-croppos\);[^}]*background-size: var\(--antd-card-coverImage-cropsize\);/, 'one rule reads the per-instance window');
});

test('the export gives an instance its own whole fill per surface: two instances with different gradients export different CSS', () => {
    const card = TEMPLATES.get('antd-card');
    const model = modelFor(card);
    const out = generateComponent(card, model.binding, model.variables, 'Card', model.frame, id => model.created.filter(n => n.parentId === id));
    const source = out.files['Card.jsx'] ?? out.files['Card.tsx'];
    for (const prop of ['rootFill', 'belowBoxFill', 'bodyBoxFill']) {
        assert.match(source, new RegExp(prop + '\\?: string'), prop + ' is a prop');
        assert.match(source, new RegExp('data-' + prop + '=\\{' + prop + '\\}'), prop + ' reaches a data attribute');
    }
    const css = out.files['Card.css'];
    assert.match(css, /\.antd-card\[data-rootFill\] \{[^}]*background: var\(--antd-card-rootFill\);/, 'an instance gradient on the root wins while set');
    assert.match(css, /\.antd-card\[data-belowBoxFill\] \.antd-card-belowBox \{[^}]*background: var\(--antd-card-belowBoxFill\);/, 'an instance pattern on the cover wins while set');
    assert.match(css, /\.antd-card\[data-bodyBoxFill\] \.antd-card-bodyBox \{[^}]*background: var\(--antd-card-bodyBoxFill\);/, 'an instance fill on the body wins while set');
});

test('a per-instance gradient struct draws the same layer as the one pure gradient function', () => {
  const plain = { type: 'linear', angle: 0, stops: [{ pos: 0, color: '#000000' }, { pos: 1, color: '#ffffff' }] };
  assert.equal(gradientLayerOf(plain), gradientCss(plain).layer);
  const alpha = { type: 'linear', angle: 90, stops: [{ pos: 0, color: '#000000', alpha: 0.5 }, { pos: 1, color: '#ffffff' }] };
  assert.equal(gradientLayerOf(alpha), gradientCss({ ...alpha, opacity: 1, color: '#000000', color2: '#ffffff' }).layer);
  const angular = { type: 'angular', handles: { a: { x: 0.25, y: 0.75 }, b: { x: 0.25, y: 0.25 } } };
  assert.equal(gradientLayerOf(angular), gradientCss({ ...angular, color: '#d9d9d9', color2: '#ffffff' }).layer);
  const handled = { type: 'radial', handles: { a: { x: 0.5, y: 0.5 }, b: { x: 1, y: 0.5 }, c: { x: 0.5, y: 1 } }, stops: [{ pos: 0, color: '#000000' }, { pos: 1, color: '#ffffff' }] };
  assert.equal(gradientLayerOf(handled), gradientCss({ ...handled, color: '#000000', color2: '#ffffff' }).layer);
  const diamond = { type: 'diamond', stops: [{ pos: 0, color: '#000000' }, { pos: 1, color: '#ffffff' }] };
  assert.match(gradientLayerOf(diamond), /r%3D%221\.2%22/, 'the diamond reaches 1.2 of its radius, encoded in the data url');
  assert.equal(gradientLayerOf(undefined), undefined);
  assert.equal(gradientLayerOf({}), 'linear-gradient(180deg, #d9d9d9, #ffffff)');
});

test('a per-instance pattern struct draws the same tile as the one pure pattern function', () => {
  const fill = { type: 'pattern', source: 's', tileType: 'RECTANGULAR', scale: 2, spacingX: 4, spacingY: 6, align: 'center', iw: 10, ih: 20 };
  const assets = { s: 'data:image/png;base64,AAAA' };
  const byId = id => (id === 's' ? { assetId: 's' } : null);
  const svg = patternSvgLayer(fill, assets, byId);
  const layer = patternLayerOf({ source: assets.s, tileType: 'RECTANGULAR', scale: 2, spacingX: 4, spacingY: 6, align: 'center', iw: 10, ih: 20 });
  const tileOf = l => decodeURIComponent(l.slice(l.indexOf(',') + 1, l.indexOf('")')));
  assert.equal(tileOf(layer), tileOf(svg.layer), 'the same one-tile svg');
  assert.equal(layer.slice(layer.indexOf('")') + 2), svg.layer.slice(svg.layer.indexOf('")') + 2), 'the same position size and repeat around the tile');
  assert.ok(layer.includes('20.8px 42.4px repeat'), 'the tile size is the natural size times the scale, stepped by the spacing');
  const offset = patternLayerOf({ source: 'u', tileType: 'HORIZONTAL_HEXAGONAL', scale: 1, spacingX: 8, spacingY: 8, iw: 10, ih: 10 });
  assert.ok(offset.includes('10.8px 21.6px repeat'), 'the offset tile is two rows tall');
  assert.equal(patternLayerOf({ source: 'u', scale: 2 }), 'url("u") 0 0 / 200% repeat', 'no natural size repeats the raw picture at the scale');
  assert.equal(patternLayerOf(undefined), undefined);
  assert.equal(patternLayerOf({}), undefined);
});

test('the export gives an instance its own gradient and pattern params as props: two instances with different stops export different CSS', () => {
  const card = TEMPLATES.get('antd-card');
  const model = modelFor(card);
  const out = generateComponent(card, model.binding, model.variables, 'Card', model.frame, id => model.created.filter(n => n.parentId === id));
  const source = out.files['Card.jsx'] ?? out.files['Card.tsx'];
  for (const prop of ['rootGradient', 'belowBoxGradient', 'bodyBoxGradient', 'rootPattern', 'belowBoxPattern', 'bodyBoxPattern']) {
    assert.match(source, new RegExp(prop + '\\?'), prop + ' is a prop');
  }
  assert.match(source, /data-root-gradient=\{rootGradient \? "" : undefined\}/, 'a gradient reaches a data attribute');
  assert.match(source, /data-belowBox-pattern=\{belowBoxPattern \? "" : undefined\}/, 'a pattern reaches a data attribute');
  assert.match(source, /--antd-card-root-gradient': rootGradient \? gradientLayerOf\(rootGradient\) : undefined/, 'stops ride a custom property');
  assert.match(source, /--antd-card-belowBox-pattern': belowBoxPattern \? patternLayerOf\(belowBoxPattern\) : undefined/, 'tile params ride a custom property');
  assert.match(source, /function gradientLayerOf\(g: GradientFill \| undefined\): string \| undefined \{/, 'the gradient serializer is emitted typed');
  assert.match(source, /function patternLayerOf\(p: PatternFill \| undefined\): string \| undefined \{/, 'the pattern serializer is emitted typed');
  const plain = source.slice(source.indexOf('type GradientFill')).split('\n').filter(l => !l.startsWith('type GradientFill') && !l.startsWith('type PatternFill')).join('\n')
    .replace(/: GradientFill \| undefined/g, '').replace(/: PatternFill \| undefined/g, '').replace(/: string \| undefined/g, '')
    .replace('(c: string, a: number | undefined)', '(c, a)').replace('(x: number, y: number)', '(x, y)').replace("= ({ 'top-left'", "= { 'top-left'").replace('} as Record<string, string>)[p.align', '}[p.align');
  const emitted = new Function(`${plain}; return { gradientLayerOf, patternLayerOf };`)();
  assert.equal(emitted.gradientLayerOf({ type: 'linear', angle: 0, stops: [{ pos: 0, color: '#000000' }, { pos: 1, color: '#ffffff' }] }), 'linear-gradient(90deg, #000000, #ffffff)', 'the emitted serializer runs');
  assert.ok(emitted.patternLayerOf({ source: 's', scale: 2, iw: 10, ih: 10 }).includes('20px 20px repeat'), 'the emitted pattern serializer runs');
  const css = out.files['Card.css'];
  assert.match(css, /\.antd-card\[data-root-gradient\] \{[^}]*background: var\(--antd-card-root-gradient\);/, 'an instance gradient wins while set');
  assert.match(css, /\.antd-card\[data-belowBox-pattern\] \.antd-card-belowBox \{[^}]*background: var\(--antd-card-belowBox-pattern\);/, 'an instance pattern on the cover wins while set');
  const a = gradientLayerOf({ type: 'linear', angle: 0, stops: [{ pos: 0, color: '#000000' }, { pos: 1, color: '#ffffff' }] });
  const b = gradientLayerOf({ type: 'linear', angle: 90, stops: [{ pos: 0, color: '#ff0000' }, { pos: 1, color: '#0000ff' }] });
  assert.notEqual(a, b, 'different stops export different CSS');
  const c = patternLayerOf({ source: 's', scale: 1, iw: 10, ih: 10 });
  const d = patternLayerOf({ source: 's', scale: 2, iw: 10, ih: 10 });
  assert.notEqual(c, d, 'different tile scales export different CSS');
});

test('the export bakes the main gradient of a surface as its base, over the token colour', () => {
  const card = TEMPLATES.get('antd-card');
  const model = modelFor(card);
  model.frame.fills = [{ type: 'linear', angle: 0, color: '#000000', color2: '#ffffff', opacity: 1, visible: true }];
  const body = model.created.find(n => n.behavior?.group === 'bodyBox' || n.behavior?.slot === 'bodyBox');
  body.fills = [{ type: 'radial', color: '#111111', color2: '#222222', opacity: 1, visible: true }];
  const out = generateComponent(card, model.binding, model.variables, 'Card', model.frame, id => model.created.filter(n => n.parentId === id));
  const css = out.files['Card.css'];
  assert.match(css, /\.antd-card \{[^}]*background: linear-gradient\(90deg, #000000, #ffffff\);/, 'the root base is the full gradient, not the token colour');
  assert.match(css, /\.antd-card \.antd-card-bodyBox \{[^}]*background: url\("data:image\/svg\+xml,[^"]*radialGradient/, 'the body base is the full radial svg, like Play');
});

test('the export gives an instance its own picture fit as a prop, inheriting the main component\'s fit when it says nothing: two instances can export different CSS', () => {
    const card = TEMPLATES.get('antd-card');
    const model = modelFor(card);
    const out = generateComponent(card, model.binding, model.variables, 'Card', model.frame, id => model.created.filter(n => n.parentId === id));
    const source = out.files['Card.jsx'] ?? out.files['Card.tsx'];
    assert.match(source, /coverImageFit/, 'the prop');
    assert.match(source, /tileSizeVar\('coverImage', coverImageScale\)/, 'the tile size bakes the prop name, not a template splinter');
    assert.match(source, /data-coverImage-fit=\{coverImageFit\}/, 'the attribute: absent when the instance says nothing');
    const css = out.files['Card.css'];
    assert.match(css, /\.antd-card\[data-coverImage\] \.antd-card-belowBox \{[^}]*background-size: cover;/, 'the main component\'s fit is the base');
    for (const [mode, size, repeat] of [['fill', 'cover', 'no-repeat'], ['fit', 'contain', 'no-repeat'], ['tile', 'auto', 'repeat']]) {
        assert.match(css, new RegExp(`\\.antd-card\\[data-coverImage-fit="${mode}"\\] \\.antd-card-belowBox \\{[^}]*background-size: ${size};[^}]*background-repeat: ${repeat};`), `${mode} overrides it`);
    }
});
