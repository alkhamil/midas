// The binder offers variables of the fill param type: a whole fill or a gradient stop takes a colour, a pattern or
// video source, kind or mode a string, a size a number; anything else binds nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { studioReplay } from './helpers/studioReplay.js';

test('fill keys bind by value type, unknown keys bind nothing', () => {
    const { bindType } = studioReplay({ VAR_BIND: {} });
    assert.equal(bindType('fills.0'), 'color');
    assert.equal(bindType('fills.2.stop.1'), 'color');
    for (const key of ['source', 'tileType', 'align', 'mode', 'video', 'image', 'poster']) assert.equal(bindType(`fills.1.${key}`), 'string', key);
    for (const key of ['scale', 'spacingX', 'spacingY']) assert.equal(bindType(`fills.1.${key}`), 'number', key);
    assert.equal(bindType('fills.1.bogus'), null);
    assert.equal(bindType('opacity'), null);
});
