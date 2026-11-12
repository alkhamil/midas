// An image fill is drawn on the element of the layer that holds it: its own box, its own paint order, clipped by the box and its corners. One pure function turns a fill into
// the CSS properties (fit, tile and scale from the fill's own props); Play and the export read it, so a Card cover sits inside its cover frame whichever side of the head it is
// on, and the root never receives a picture that belongs to a layer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cssBackgroundOf, imageFillCss, imageFillLayout, imageFillStyleOf } from '../src/geometry/fills.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { fieldStyleOf, nodeFieldPatch } from '../src/behavior-engine/display.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { overflowOf, toDomTree } from '../src/prototype/dom-tree.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const assets = { a: 'data:image/png;base64,AAAA' };

test('each fit mode computes its CSS from the fill: fill covers, fit contains, tile repeats at the natural size times the scale', () => {
    assert.deepEqual(imageFillCss({ type: 'image', image: 'a', mode: 'fill' }, assets), { backgroundImage: `url("${assets.a}")`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' });
    assert.deepEqual(imageFillCss({ type: 'image', image: 'a' }, assets).backgroundSize, 'cover', 'fill is the default mode');
    assert.deepEqual(imageFillCss({ type: 'image', image: 'a', mode: 'fit' }, assets).backgroundSize, 'contain');
    assert.deepEqual(imageFillCss({ type: 'image', image: 'a', mode: 'tile' }, assets), { backgroundImage: `url("${assets.a}")`, backgroundRepeat: 'repeat' });
    assert.deepEqual(imageFillCss({ type: 'image', image: 'a', mode: 'tile', scale: 0.5, iw: 80, ih: 40 }, assets), { backgroundImage: `url("${assets.a}")`, backgroundSize: '40px 20px', backgroundPosition: '0 0', backgroundRepeat: 'repeat' });
    assert.equal(imageFillCss({ type: 'image', image: 'a', mode: 'tile', scale: 0.5 }, assets), null, 'a scaled tile needs the natural size');
    assert.equal(imageFillCss({ type: 'image', image: 'missing', mode: 'fill' }, assets), null, 'a missing asset draws nothing: the flat colour is the fallback');
    assert.deepEqual(imageFillLayout({ mode: 'fit' }), { position: 'center', size: 'contain', repeat: 'no-repeat' });
});

test('the generic background of a frame with an image fill is unchanged by the shared function (Avatar and every other image fill)', () => {
    const background = fill => cssBackgroundOf([{ type: 'image', image: 'a', visible: true, ...fill }], assets).background;
    assert.equal(background({ mode: 'fill' }), `url("${assets.a}") center / cover no-repeat`);
    assert.equal(background({ mode: 'fit' }), `url("${assets.a}") center / contain no-repeat`);
    assert.equal(background({ mode: 'tile' }), `url("${assets.a}") repeat`);
    assert.equal(cssBackgroundOf([{ type: 'image', image: 'a', mode: 'tile', scale: 2, visible: true }], assets).unsupported[0], 'image', 'a scaled tile without a natural size is reported as before');
});

test('the top visible image fill of a layer is the one it draws; a hidden one or none draws nothing', () => {
    const fills = [{ type: 'solid', color: '#ccc', visible: false }, { type: 'image', image: 'a', mode: 'fit', visible: true }];
    assert.equal(imageFillStyleOf(fills, assets).backgroundSize, 'contain');
    assert.equal(imageFillStyleOf([{ type: 'image', image: 'a', visible: false }], assets), null);
    assert.equal(imageFillStyleOf([{ type: 'solid', color: '#ccc' }], assets), null);
});

const card = TEMPLATES.get('antd-card');
const model = modelFor(card);
function play(props, fillPatch = {}) {
    const nodes = instanceFor(model, { cover: true, coverImage: 'a', ...props });
    // The sync gives the cover frame its picture (the colour fill hidden, one image fill); the test writes the same fills.
    for (const n of nodes) if (n.behavior?.group === 'aboveBox' || n.behavior?.group === 'belowBox' || n.behavior?.slot === 'aboveBox' || n.behavior?.slot === 'belowBox') n.fills = [{ type: 'solid', color: '#e5e7eb', opacity: 1, visible: false }, { type: 'image', image: 'a', mode: 'fill', scale: 1, opacity: 1, visible: true, ...fillPatch }];
    return toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, ...nodes] }], variables: model.variables, assets }, nodes[0].id).root;
}

for (const position of ['above', 'below']) {
    test(`Play, cover ${position} the head: the picture is on the cover frame's own element, never on the root, and the cover sits where the position says`, () => {
        const root = play({ coverPosition: position });
        const cover = root.children.find(c => /-(above|below)Box$/.test(c.attrs.class));
        assert.ok(cover, 'the cover frame is an element');
        assert.equal(cover.attrs.class, `antd-card-${position}Box`);
        assert.equal(cover.style.backgroundImage, `url("${assets.a}")`);
        assert.equal(cover.style.backgroundSize, 'cover');
        assert.equal(cover.style.backgroundRepeat, 'no-repeat');
        assert.equal(root.style.backgroundImage, undefined, 'the root carries no picture');
        const order = root.children.map(c => c.attrs.class.replace('antd-card-', ''));
        assert.deepEqual(order.filter(c => ['aboveBox', 'belowBox', 'header', 'bodyBox'].includes(c)), position === 'above' ? ['aboveBox', 'header', 'bodyBox'] : ['header', 'belowBox', 'bodyBox']);
        // The card clips its children to its corners, so whichever layer is first takes the top radius; the layers themselves carry none.
        const rootRule = /.antd-card {[^}]*}/.exec(generateComponent(card, model.binding, model.variables, 'Card', model.frame, id => model.created.filter(n => n.parentId === id)).files['Card.css'])[0];
        assert.match(rootRule, /overflow: hidden;/);
        assert.ok(rootRule.includes("border-radius: var(--antd-card-radius);"));
        assert.equal(cover.style.borderRadius, undefined);
        assert.equal(root.children.find(c => c.attrs.class === 'antd-card-header').style.borderRadius, undefined, 'the head has no radius of its own, above or below the cover');
    });
}

test('every fit mode reaches the cover element in Play', () => {
    for (const [mode, size, repeat] of [['fill', 'cover', 'no-repeat'], ['fit', 'contain', 'no-repeat'], ['tile', undefined, 'repeat']]) {
        const cover = play({}, { mode }).children.find(c => c.attrs.class === 'antd-card-belowBox');
        assert.equal(cover.style.backgroundSize, size, mode);
        assert.equal(cover.style.backgroundRepeat, repeat, mode);
    }
});

test('Play draws a crop, rotation and adjustment on the cover from the same SVG layer the canvas and the export read', () => {
    const cover = play({ coverImage: 'a' }, { mode: 'crop', crop: { x: 0.25, y: 0.75, scale: 2 }, rotation: 15, adjust: { contrast: 0.2 } }).children.find(c => c.attrs.class === 'antd-card-belowBox');
    assert.match(cover.style.backgroundImage, /^url\("data:image\/svg\+xml,/);
    assert.equal(cover.style.backgroundSize, '100% 100%');
    const svg = decodeURIComponent(cover.style.backgroundImage.slice(cover.style.backgroundImage.indexOf(',') + 1, cover.style.backgroundImage.indexOf('")')));
    assert.match(svg, /rotate\(15 0.5 0.5\)/);
    assert.match(svg, /slope="1.2"/);
});

test('Play draws a pattern on a template picture layer from the same SVG tile the canvas repeats', () => {
    const nodes = instanceFor(model, { cover: true, coverImage: 'a' });
    for (const n of nodes) if (n.behavior?.group === 'belowBox' || n.behavior?.slot === 'belowBox') n.fills = [{ type: 'pattern', image: 'a', tileType: 'HORIZONTAL_HEXAGONAL', scale: 2, spacingX: 3, spacingY: 4, align: 'center', opacity: 1, visible: true }];
    for (const n of nodes) if (n.behavior?.group === 'belowBox' || n.behavior?.slot === 'belowBox') Object.assign(n.fills[0], { iw: 40, ih: 20 });
    const root = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, ...nodes] }], variables: model.variables, assets }, nodes[0].id).root;
    const cover = root.children.find(c => /-(above|below)Box$/.test(c.attrs.class));
    assert.match(cover.style.backgroundImage, /^url\("data:image\/svg\+xml,/);
    assert.equal(cover.style.backgroundSize, '82.4px 83.2px');
    const svg = decodeURIComponent(cover.style.backgroundImage.slice(cover.style.backgroundImage.indexOf(',') + 1, cover.style.backgroundImage.indexOf('")')));
    assert.match(svg, /width="82.4" height="83.2"/);
});

test('Play draws a pattern with no measured tile at the nine point alignment the picker shows', () => {
    const nodes = instanceFor(model, { cover: true, coverImage: 'a' });
    for (const n of nodes) if (n.behavior?.group === 'belowBox' || n.behavior?.slot === 'belowBox') n.fills = [{ type: 'pattern', image: 'a', align: 'center', opacity: 1, visible: true }];
    const root = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, ...nodes] }], variables: model.variables, assets }, nodes[0].id).root;
    const cover = root.children.find(c => /-(above|below)Box$/.test(c.attrs.class));
    assert.equal(cover.style.backgroundImage, 'url("' + assets.a + '")');
    assert.equal(cover.style.backgroundPosition, '50% 50%');
});

test('a video asset through a picture prop is a video source, kept with its mode and poster like an image', () => {
    const videoAssets = { ...assets, v: 'data:video/mp4;base64,AAAA' };
    assert.deepEqual(nodeFieldPatch('imageFill', 'v', 'frame', { fills: [] }, videoAssets), { fills: [{ type: 'video', video: 'v', mode: 'fill', scale: 1, opacity: 1, visible: true }] });
    const own = { type: 'video', video: 'v', mode: 'fit', scale: 1, poster: 'a', opacity: 1, visible: true };
    assert.deepEqual(nodeFieldPatch('imageFill', 'v', 'frame', { fills: [{ type: 'solid', color: '#ccc', visible: true }, own] }, videoAssets).fills, [{ type: 'solid', color: '#ccc', visible: true }, own], 'the same source keeps everything');
    const swapped = nodeFieldPatch('imageFill', 'a', 'frame', { fills: [own] }, videoAssets).fills;
    assert.equal(swapped[0].type, 'image', 'an image asset back on a video fill is an image fill');
    assert.deepEqual(nodeFieldPatch('imageFill', null, 'frame', { fills: [own] }, videoAssets), { fills: [] }, 'no asset removes the picture');
});

test('Play draws a gradient on a template layer from the canvas fill, the same layer the export bakes', () => {
    const root = play({}, { type: 'linear', angle: 0, color: '#000000', color2: '#ffffff' });
    const cover = root.children.find(c => /-(above|below)Box$/.test(c.attrs.class));
    assert.ok(cover.style.background.includes('linear-gradient(90deg, #000000, #ffffff)'), 'the canvas stops reach Play unchanged');
});

test('Play draws a pattern on a template layer from its live-linked source, the same tile the export repeats', () => {
    const nodes = instanceFor(model, { cover: true, coverImage: 'a' });
    const tile = { id: 'tile-src', name: 'Tile', type: 'frame', parentId: null, x: 0, y: 0, w: 80, h: 40, fills: [{ type: 'image', image: 'a', mode: 'fill', scale: 1, opacity: 1, visible: true }] };
    for (const n of nodes) if (n.behavior?.group === 'belowBox' || n.behavior?.slot === 'belowBox') n.fills = [{ type: 'pattern', source: 'tile-src', tileType: 'RECTANGULAR', scale: 1, spacingX: 0, spacingY: 0, iw: 80, ih: 40, opacity: 1, visible: true }];
    const root = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, tile, ...nodes] }], variables: model.variables, assets }, nodes[0].id).root;
    const cover = root.children.find(c => /-(above|below)Box$/.test(c.attrs.class));
    assert.match(cover.style.backgroundImage, /^url\("data:image\/svg\+xml,/);
    assert.equal(cover.style.backgroundSize, '80px 40px');
});

test('Play draws a video fill on a template picture layer as a video element, below the content and clipped to the box', () => {
    const nodes = instanceFor(model, { cover: true, coverImage: 'a' });
    for (const n of nodes) if (n.behavior?.group === 'belowBox' || n.behavior?.slot === 'belowBox') n.fills = [{ type: 'video', video: 'v', mode: 'fit', opacity: 1, visible: true }];
    const withVideo = { ...assets, v: 'data:video/mp4;base64,AAAA' };
    const root = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, ...nodes] }], variables: model.variables, assets: withVideo }, nodes[0].id).root;
    const cover = root.children.find(c => /-(above|below)Box$/.test(c.attrs.class));
    const video = cover.children[0];
    assert.equal(video.tag, 'video');
    assert.equal(video.attrs.src, withVideo.v);
    assert.deepEqual([video.attrs.autoplay, video.attrs.muted, video.attrs.loop, video.attrs.playsinline], [true, true, true, true]);
    assert.ok(Object.keys(video.attrs).includes('playsinline'), 'the attribute name is the lowercase html form Play writes verbatim');
    assert.equal(video.style.objectFit, 'contain');
    assert.equal(video.style.position, 'absolute');
    assert.equal(cover.style.overflow, 'hidden');
});

test('the exported video html carries lowercase playsinline, from the descriptor Play mounts verbatim', () => {
    const nodes = instanceFor(model, { cover: true, coverImage: 'a' });
    for (const n of nodes) if (n.behavior?.group === 'belowBox' || n.behavior?.slot === 'belowBox') n.fills = [{ type: 'video', video: 'v', mode: 'fit', opacity: 1, visible: true }];
    const withVideo = { ...assets, v: 'data:video/mp4;base64,AAAA' };
    const root = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, ...nodes] }], variables: model.variables, assets: withVideo }, nodes[0].id).root;
    const video = root.children.find(c => /-(above|below)Box$/.test(c.attrs.class)).children[0];
    // The player mounts descriptor attributes under their own names (setAttribute with the key: booleans draw as empty-valued
    // attributes, anything else as its string, false and undefined draw nothing). The html string below is what that mount writes.
    const attrs = Object.entries(video.attrs ?? {})
        .filter(([, value]) => value !== false && value !== undefined)
        .map(([key, value]) => ` ${key}="${value === true ? '' : String(value).replace(/"/g, '&quot;')}"`)
        .join('');
    const html = `<${video.tag}${attrs}>`;
    assert.ok(html.includes(' playsinline=""'), 'lowercase in the html string: ' + html);
    assert.ok(!html.includes('playsInline') && !html.includes('playInline'), 'no camelcase variant: ' + html);
    assert.ok(html.includes(' autoplay=""') && html.includes(' muted=""') && html.includes(' loop=""'), 'the defaults ride along: ' + html);
});

test('a picture on another layer than the root is not the root\'s: fieldStyleOf gives the root only the root writer\'s picture', () => {
    const style = fieldStyleOf(card, { cover: true, coverImage: 'a' }, assets);
    assert.equal(style.style.backgroundImage, undefined);
    assert.deepEqual(style.attrs, {});
});

test('the export draws the cover on the cover layer\'s own rule, inside the root that says the picture shows, with the fit of the main component\'s fill', () => {
    const out = generateComponent(card, model.binding, model.variables, 'Card', model.frame, id => model.created.filter(n => n.parentId === id));
    const css = out.files['Card.css'];
    for (const key of ['aboveBox', 'belowBox']) {
        assert.match(css, new RegExp(`\\.antd-card\\[data-coverImage\\] \\.antd-card-${key} \\{[^}]*background-image: var\\(--antd-card-coverImage\\);[^}]*background-size: cover;[^}]*background-repeat: no-repeat;`));
    }
    assert.doesNotMatch(css, /\.antd-card\[data-coverImage\] \{/, 'the root gets no picture rule');
});

test('Avatar (the root\'s picture) still draws on the root, as before', () => {
    const avatar = TEMPLATES.get('antd-avatar');
    const style = fieldStyleOf(avatar, { src: 'a' }, assets);
    assert.equal(style.style.backgroundImage, `url("${assets.a}")`);
    assert.ok('data-src' in style.attrs);
});

test('a frame\'s own clip never cuts its own shadow, and only a frame with Clip content on clips its children', () => {
    assert.deepEqual(overflowOf({ clip: false }), { overflowX: 'visible', overflowY: 'visible' });
    assert.deepEqual(overflowOf({ clip: true }), { overflowX: 'clip', overflowY: 'clip' });
    assert.equal(overflowOf({ clip: true, prototype: { overflow: 'vertical' } }).overflowY, 'auto');
});
