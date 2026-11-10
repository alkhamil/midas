// A plain frame with an inside stroke (a Button's border) is drawn by the shader, not rastered: the raster path tiled it into thousands of
// atlas entries at high zoom and filled the atlas. Anything the shader cannot draw (dashes, per-side widths, miter joins, outside and
// centre strokes of other kinds) stays on the raster path. The two functions are cut out of midas.js by name (as raster-scale.test.js does).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { RECT_LIKE, strokeIsOn, strokeClosed, strokeSidesUniform } from '@midas/builder-core';

const src = fs.readFileSync(new URL('../src/engine/midas.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
function sliceFunction(name) {
    const head = src.indexOf(`\nfunction ${name}(`) + 1;
    if (head < 1) throw new Error(`midas.js has no function ${name}`);
    return src.slice(head, src.indexOf('\n}\n', head) + 2);
}
const { strokeNeedsRaster } = new Function('RECT_LIKE', 'strokeIsOn', 'strokeClosed', 'strokeSidesUniform',
    `${sliceFunction('insideStrokeOnShader')}\n${sliceFunction('strokeNeedsRaster')}\nreturn { strokeNeedsRaster };`)(RECT_LIKE, strokeIsOn, strokeClosed, strokeSidesUniform);

const frame = extra => ({ type: 'frame', w: 56, h: 24, radius: 6, stroke: '#4338ca', strokeWidth: 1, strokeAlign: 'inside', ...extra });

test('a frame with a uniform solid inside stroke is drawn by the shader', () => {
    assert.equal(strokeNeedsRaster(frame()), false);
    assert.equal(strokeNeedsRaster(frame({ stroke: '#00000000' })), false);
    assert.equal(strokeNeedsRaster({ ...frame(), type: 'rect' }), false);
});

test('what the shader cannot draw stays on the raster path', () => {
    assert.equal(strokeNeedsRaster(frame({ strokeStyle: 'dashed' })), true);
    assert.equal(strokeNeedsRaster(frame({ strokeJoin: 'miter' })), true);
    assert.equal(strokeNeedsRaster(frame({ strokeAlign: 'outside' })), true);
    assert.equal(strokeNeedsRaster(frame({ strokeSides: { t: 2, r: 1, b: 1, l: 1 } })), strokeSidesUniform(frame({ strokeSides: { t: 2, r: 1, b: 1, l: 1 } })) ? false : true);
});

test('the shader reads the inside flag from the instance (uv.x) and offsets the stroke band by half its width', () => {
    assert.match(src, /abs\(d\+select\(0\.,item\.props\.y\*\.5,item\.uv\.x==1\.\)\)/);
});
