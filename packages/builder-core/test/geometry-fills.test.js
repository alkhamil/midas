import { test } from 'node:test';
import assert from 'node:assert/strict';
import { topFillOf, withTopColor, topColorOf, cssBackgroundOf } from '../src/geometry/fills.js';
import { colorWithAlpha } from '../src/geometry/format.js';

const fill = (color, extra = {}) => ({ type: 'solid', color, opacity: 1, visible: true, ...extra });

test('the top fill is the first visible one, so a hidden first fill is skipped', () => {
    const fills = [fill('#111111', { visible: false }), fill('#0058CA')];
    assert.equal(topFillOf(fills), fills[1]);
    assert.equal(topColorOf({ fills }), '#0058CA');
});

test('setting the top colour changes the top visible fill, the one the layer shows', () => {
    const fills = [fill('#111111', { visible: false }), fill('#0058CA')];
    const next = withTopColor(fills, '#00ff00');
    assert.equal(topColorOf({ fills: next }), '#00ff00');
    assert.equal(next[0].color, '#111111', 'the hidden fill is left alone');
});

test('setting the top colour keeps the fill type, so a gradient stays a gradient', () => {
    const gradient = { type: 'linear', stops: [{ color: '#000000' }, { color: '#ffffff' }], angle: 90, visible: true, opacity: 1, color: '#000000' };
    const [top] = withTopColor([gradient], '#ff0000');
    assert.equal(top.type, 'linear');
    assert.equal(top.color, '#ff0000');
    assert.deepEqual(top.stops, gradient.stops);
});

test('the colour none hides the top visible fill and leaves the rest', () => {
    const fills = [fill('#111111'), fill('#0058CA')];
    const next = withTopColor(fills, 'none');
    assert.equal(next[0].visible, false);
    assert.equal(next[1].visible, true);
    assert.equal(topColorOf({ fills: next }), '#0058CA');
});

test('a layer with no visible fill gets a solid one on top when it is given a colour', () => {
    assert.deepEqual(withTopColor([], '#ff0000'), [fill('#ff0000')]);
    const hidden = [fill('#111111', { visible: false })];
    assert.equal(topColorOf({ fills: withTopColor(hidden, '#ff0000') }), '#ff0000');
});

test('the colour none on a layer with no visible fill changes nothing', () => {
    const hidden = [fill('#111111', { visible: false })];
    assert.deepEqual(withTopColor(hidden, 'none'), hidden);
    assert.deepEqual(withTopColor([], 'none'), []);
});

test('a fill list is one CSS background: the top fill first, hidden fills left out', () => {
    const fills = [fill('#ff0000'), fill('#000000', { visible: false }), { type: 'linear', color: '#000000', color2: '#ffffff', angle: 0, opacity: 1, visible: true }];
    assert.equal(cssBackgroundOf(fills).background, 'linear-gradient(#ff0000, #ff0000), linear-gradient(90deg, #000000, #ffffff)');
});

test('a single solid fill is its colour, with its opacity as an alpha byte', () => {
    assert.equal(cssBackgroundOf([fill('#0058CA')]).background, '#0058CA');
    assert.equal(cssBackgroundOf([fill('#0058CA', { opacity: 0.5 })]).background, '#0058CA80');
});

test('radial and angular fills map to their CSS gradients', () => {
    const radial = { type: 'radial', color: '#000000', color2: '#ffffff', opacity: 1, visible: true };
    const angular = { type: 'angular', color: '#000000', color2: '#ffffff', opacity: 1, visible: true };
    assert.equal(cssBackgroundOf([radial]).background, 'radial-gradient(circle, #000000, #ffffff)');
    assert.equal(cssBackgroundOf([angular]).background, 'conic-gradient(from 0deg, #000000, #ffffff)');
});

test('an image fill has no CSS background and is reported as unsupported; no fills paint nothing', () => {
    assert.deepEqual(cssBackgroundOf([{ type: 'image', image: 'x', visible: true }]), { background: '', unsupported: ['image'] });
    assert.deepEqual(cssBackgroundOf([]), { background: '', unsupported: [] });
});

test('a colour with an opacity: a six digit hex takes an alpha byte, any other colour is mixed with transparent', () => {
    assert.equal(colorWithAlpha('#1e88e5', 1), '#1e88e5');
    assert.equal(colorWithAlpha('#1e88e5', 0.25), '#1e88e540');
    assert.equal(colorWithAlpha('red', 0.5), 'color-mix(in srgb, red 50%, transparent)');
});
