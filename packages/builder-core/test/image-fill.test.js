// An image fill is drawn on the element of the layer that holds it: its own box, its own paint order, clipped by the box and its corners. One pure function turns a fill into
// the CSS properties (fit, tile and scale from the fill's own props); Play and the export read it, so a Card cover sits inside its cover frame whichever side of the head it is
// on, and the root never receives a picture that belongs to a layer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cssBackgroundOf, imageFillCss, imageFillLayout, imageFillStyleOf } from '../src/geometry/fills.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { fieldStyleOf } from '../src/behavior-engine/display.js';
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
