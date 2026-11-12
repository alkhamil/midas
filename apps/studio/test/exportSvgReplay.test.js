// The plain-frame SVG export draws every fill type statically: a video is its poster frame clipped to the box
// (SVG has no video element, so the export never plays and never carries playsinline), a pattern repeats its
// live-linked tile, and gradients keep every stop, position, alpha and transform the canvas holds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { studioReplay } from './helpers/studioReplay.js';

function setup(nodes, assets) {
    const replay = studioReplay({ activeImages: new Map() });
    const { doc } = replay;
    doc.data.assets = assets;
    const page = { id: 'p', name: 'S', nodes: [], parentId: null };
    doc.data.pages.push(page);
    doc.data.pageId = page.id;
    for (const n of nodes) page.nodes.push({ parentId: null, x: 0, y: 0, w: 200, h: 100, ...n });
    doc.refresh();
    return replay;
}

const frame = fills => ({ id: 'f', name: 'F', type: 'frame', fills });

test('a single video or pattern fill takes the raster path, like an image or a rich gradient', () => {
    const { needsRasterFill } = studioReplay();
    assert.equal(needsRasterFill({ type: 'frame', fills: [{ type: 'video', video: 'v', visible: true }] }), true);
    assert.equal(needsRasterFill({ type: 'frame', fills: [{ type: 'pattern', source: 's', visible: true }] }), true);
    assert.equal(needsRasterFill({ type: 'frame', fills: [{ type: 'image', image: 'a', visible: true }] }), true);
    assert.equal(needsRasterFill({ type: 'frame', fills: [{ type: 'solid', color: '#ff0000', visible: true }] }), false);
    assert.equal(needsRasterFill({ type: 'frame', fills: [{ type: 'linear', color: '#000000', color2: '#ffffff', visible: true }] }), false);
});

test('a plain video exports its poster frame clipped to the box, and no video element', () => {
    const { exportSVG, doc } = setup([frame([{ type: 'video', video: 'v', mode: 'fit', poster: 'p', opacity: 1, visible: true }])],
        { v: 'data:video/mp4;base64,AAAA', p: 'data:image/png;base64,PPPP' });
    const out = exportSVG(doc, ['f']);
    assert.match(out, /<image href="data:image\/png;base64,PPPP"[^>]*preserveAspectRatio="xMidYMid slice"[^>]*clip-path="url\(#v0f0c\)"/);
    assert.ok(!out.includes('<video'), 'the static export never plays');
    assert.ok(!out.includes('playsinline'), 'no interaction attribute without an element');
});

test('a video with no poster exports the pending colour, never a failure', () => {
    const { exportSVG, doc } = setup([frame([{ type: 'video', video: 'v', mode: 'fill', opacity: 1, visible: true }])],
        { v: 'data:video/mp4;base64,AAAA' });
    assert.match(exportSVG(doc, ['f']), /fill="rgba\(140,140,150,\.18\)"/);
});

test('a plain pattern exports its live-linked tile repeated at its step', () => {
    const { exportSVG, doc } = setup([
        { id: 'src', name: 'Tile', type: 'frame', fills: [{ type: 'image', image: 't', mode: 'fill', opacity: 1, visible: true }] },
        frame([{ type: 'pattern', source: 'src', tileType: 'RECTANGULAR', scale: 1, spacingX: 0, spacingY: 0, iw: 80, ih: 40, opacity: 1, visible: true }]),
    ], { t: 'data:image/png;base64,AAAA' });
    const out = exportSVG(doc, ['f']);
    assert.match(out, /<pattern id="v0f0" patternUnits="userSpaceOnUse" width="80" height="40">/);
    assert.match(out, /<rect[^>]*fill="url\(#v0f0\)"[^>]*clip-path="url\(#v0f0c\)"/);
    assert.ok(out.includes('data:image/svg+xml'), 'the tile is the same one-tile svg Play repeats');
});

test('a pattern with no resolvable picture exports the pending colour', () => {
    const { exportSVG, doc } = setup([frame([{ type: 'pattern', source: 'missing', iw: 80, ih: 40, opacity: 1, visible: true }])], {});
    assert.match(exportSVG(doc, ['f']), /fill="rgba\(140,140,150,\.18\)"/);
});

test('a radial gradient keeps every stop and the handle matrix of the canvas', () => {
    const { exportSVG, doc } = setup([frame([{ type: 'radial', color: '#000000', color2: '#ffffff', handles: { a: { x: 0.5, y: 0.5 }, b: { x: 1, y: 0.5 }, c: { x: 0.5, y: 1 } }, opacity: 1, visible: true }])], {});
    const out = exportSVG(doc, ['f']);
    assert.match(out, /<radialGradient[^>]*gradientTransform="matrix\(0\.5 0 0 0\.5 0\.5 0\.5\)"/);
    assert.equal(out.match(/<stop /g).length, 2);
});

test('an angular gradient exports the same conic string the canvas reads', () => {
    const { exportSVG, doc } = setup([frame([{ type: 'angular', color: '#000000', color2: '#ffffff', stops: [{ pos: 0, color: '#000000' }, { pos: 0.5, color: '#ff0000' }, { pos: 1, color: '#ffffff' }], opacity: 1, visible: true }])], {});
    const out = exportSVG(doc, ['f']);
    assert.match(out, /<foreignObject[^>]*>.*conic-gradient\(.*<\/foreignObject>/s);
    assert.equal(out.match(/<stop /g), null, 'the conic runs in the browser, not as svg stops');
});

test('a plain linear gradient keeps its stops and their alpha', () => {
    const { exportSVG, doc } = setup([frame([{ type: 'linear', angle: 0, color: '#000000', color2: '#ffffff', stops: [{ pos: 0, color: '#000000', alpha: 0.5 }, { pos: 1, color: '#ffffff' }], opacity: 1, visible: true }])], {});
    const out = exportSVG(doc, ['f']);
    assert.match(out, /<stop offset="0" stop-color="#000000" stop-opacity="0\.5"\/>/);
    assert.match(out, /<stop offset="1" stop-color="#ffffff"\/>/);
});
