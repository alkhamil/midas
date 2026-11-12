// The fills the engine has (Solid, the four gradients, Image) on the surfaces that derive from the canvas: one pure function per type shared by the generic background, Play and
// the export; no hidden fill (a layer's fallback colour is a bound variable, not a Fill-list entry); an instance's own picture fit reaches the export as a prop.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cssBackgroundOf, gradientCss, gradientStops, isGradientFill } from '../src/geometry/fills.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { nodeFieldPatch } from '../src/behavior-engine/display.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
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

test('the export gives an instance its own picture fit as a prop, inheriting the main component\'s fit when it says nothing: two instances can export different CSS', () => {
    const card = TEMPLATES.get('antd-card');
    const model = modelFor(card);
    const out = generateComponent(card, model.binding, model.variables, 'Card', model.frame, id => model.created.filter(n => n.parentId === id));
    const source = out.files['Card.jsx'] ?? out.files['Card.tsx'];
    assert.match(source, /coverImageFit/, 'the prop');
    assert.match(source, /data-coverImage-fit=\{coverImageFit\}/, 'the attribute: absent when the instance says nothing');
    const css = out.files['Card.css'];
    assert.match(css, /\.antd-card\[data-coverImage\] \.antd-card-belowBox \{[^}]*background-size: cover;/, 'the main component\'s fit is the base');
    for (const [mode, size, repeat] of [['fill', 'cover', 'no-repeat'], ['fit', 'contain', 'no-repeat'], ['tile', 'auto', 'repeat']]) {
        assert.match(css, new RegExp(`\\.antd-card\\[data-coverImage-fit="${mode}"\\] \\.antd-card-belowBox \\{[^}]*background-size: ${size};[^}]*background-repeat: ${repeat};`), `${mode} overrides it`);
    }
});
