// A bound fill index resolves into its fill: the Libraries tab and the four-dots bind fills.N for every fill type, and the
// bound colour lands where each type reads it (a solid, a gradient first stop, a pattern or video fallback colour; images take none).
import test from 'node:test';
import assert from 'node:assert/strict';
import { studioReplay } from './helpers/studioReplay.js';

function bound(n, prop, val) {
    const { writeBound } = studioReplay();
    return writeBound(n, prop, val);
}

test('a bound whole fill resolves into its fill for every type', () => {
    const solid = { type: 'solid', color: '#111111', opacity: 1, visible: true };
    assert.equal(bound({ fills: [solid] }, 'fills.0', '#ff0000'), true);
    assert.equal(solid.color, '#ff0000');
    const gradient = { type: 'linear', angle: 90, color: '#111111', color2: '#222222', opacity: 1, visible: true };
    assert.equal(bound({ fills: [gradient] }, 'fills.0', '#ff0000'), true);
    assert.equal(gradient.color, '#ff0000');
    const pattern = { type: 'pattern', source: 's', opacity: 1, visible: true };
    assert.equal(bound({ fills: [pattern] }, 'fills.0', '#ff0000'), true);
    assert.equal(pattern.color, '#ff0000');
    const video = { type: 'video', video: 'v', mode: 'fill', opacity: 1, visible: true };
    assert.equal(bound({ fills: [video] }, 'fills.0', '#ff0000'), true);
    assert.equal(video.color, '#ff0000');
    const image = { type: 'image', image: 'a', mode: 'fill', scale: 1, visible: true };
    assert.equal(bound({ fills: [image] }, 'fills.0', '#ff0000'), false);
    assert.equal(image.color, undefined);
});

test('a bound pattern param resolves into the fill it names', () => {
    const { writeBound } = studioReplay();
    const pattern = { type: 'pattern', source: 'old', tileType: 'RECTANGULAR', scale: 1, spacingX: 0, spacingY: 0, opacity: 1, visible: true };
    assert.equal(writeBound({ fills: [pattern] }, 'fills.0.source', 'src'), true);
    assert.equal(pattern.source, 'src');
    assert.equal(writeBound({ fills: [pattern] }, 'fills.0.scale', 2), true);
    assert.equal(pattern.scale, 2);
    assert.equal(writeBound({ fills: [pattern] }, 'fills.0.spacingX', 4), true);
    assert.equal(pattern.spacingX, 4);
    assert.equal(writeBound({ fills: [pattern] }, 'fills.0.tileType', 'HORIZONTAL_HEXAGONAL'), true);
    assert.equal(pattern.tileType, 'HORIZONTAL_HEXAGONAL');
    assert.equal(writeBound({ fills: [pattern] }, 'fills.0.align', 'center'), true);
    assert.equal(pattern.align, 'center');
    assert.equal(writeBound({ fills: [pattern] }, 'fills.0.scale', 'nope'), false, 'a size takes a number');
    assert.equal(writeBound({ fills: [pattern] }, 'fills.0.source', 'src'), false, 'the same value writes nothing');
    assert.equal(writeBound({ fills: [pattern] }, 'fills.0.source', ''), false, 'an empty source writes nothing');
    assert.equal(writeBound({ fills: [] }, 'fills.0.source', 'src'), false, 'no fill binds nothing');
    assert.equal(writeBound({ fills: [pattern] }, 'fills.0.bogus', 'x'), false, 'an unknown param binds nothing');
});

test('a bound video param resolves into its source and mode like an image', () => {
    const { writeBound } = studioReplay();
    const video = { type: 'video', video: 'old', mode: 'fill', opacity: 1, visible: true };
    assert.equal(writeBound({ fills: [video] }, 'fills.0.video', 'v'), true);
    assert.equal(video.video, 'v');
    assert.equal(writeBound({ fills: [video] }, 'fills.0.mode', 'fit'), true);
    assert.equal(video.mode, 'fit');
    const image = { type: 'image', image: 'old', mode: 'fill', opacity: 1, visible: true };
    assert.equal(writeBound({ fills: [image] }, 'fills.0.image', 'a'), true);
    assert.equal(image.image, 'a');
});

test('a bound stop resolves into its gradient stop colour', () => {
    const { writeBound } = studioReplay();
    const n = { fills: [{ type: 'linear', angle: 90, color: '#111111', color2: '#222222', stops: [{ color: '#111111', pos: 0 }, { color: '#222222', pos: 1 }], opacity: 1, visible: true }] };
    assert.equal(writeBound(n, 'fills.0.stop.1', '#00ff00'), true);
    assert.equal(n.fills[0].stops[1].color, '#00ff00');
    assert.equal(n.fills[0].color2, '#00ff00');
});
