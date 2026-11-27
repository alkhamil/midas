// Skeleton: one component, Type picks the kind (Text, Paragraph, Avatar, Button, Input, Image, Node). Each kind shows its own layers, and a prop shows
// only for the kinds it applies to. Size is the five Midas steps; Active pulses the shown blocks in Play, on by default.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { modelFor, instanceFor } from './helpers/box-template.js';
import { SIZE_MODES } from '../src/templates/size-modes.js';

const skeleton = TEMPLATES.get('antd-skeleton');
const model = modelFor(skeleton);

/** The layers of an instance under these props, root excluded, by their anatomy or part id. */
const layersOf = props => instanceFor(model, props).slice(1).map(n => n.behavior?.slot ?? n.name);
const TEXT_LAYERS = ['title', 'row1', 'row2', 'row3'];

test('Skeleton is one registered template, valid, with Type, Size and Active', () => {
    assert.ok(skeleton, 'Skeleton is in the registry');
    assert.equal(skeleton.name, 'Skeleton');
    assert.deepEqual(validateTemplateSchema(skeleton, { templateIds: new Set(TEMPLATES.keys()) }), []);
    assert.deepEqual(skeleton.props.type.options, ['text', 'paragraph', 'avatar', 'button', 'input', 'image', 'node']);
    assert.deepEqual(skeleton.props.size.modes, SIZE_MODES);
    assert.equal(skeleton.props.active.default, true);
});

test('the text kind shows a title and three lines, the paragraph the lines only, and no block', () => {
    const text = layersOf({ type: 'text' });
    assert.ok(TEXT_LAYERS.every(k => text.includes(k)));
    const paragraph = layersOf({ type: 'paragraph', title: true });
    assert.ok(!paragraph.includes('title'), 'a paragraph has no title bar');
    assert.ok(['row1', 'row2', 'row3'].every(k => paragraph.includes(k)));
    assert.ok(!text.some(k => ['buttonBlock', 'inputBlock', 'imageBlock', 'nodeBlock'].includes(k)));
});

test('each block kind shows its own block only, and no text container', () => {
    for (const [type, block] of [['button', 'buttonBlock'], ['input', 'inputBlock'], ['image', 'imageBlock'], ['node', 'nodeBlock'], ['avatar', 'avatar']]) {
        const layers = layersOf({ type });
        assert.ok(!layers.includes('content'), `${type} has no text container`);
        assert.ok(!TEXT_LAYERS.some(k => layers.includes(k)), `${type} shows no text lines`);
        if (block !== 'avatar') assert.ok(layers.includes(block), `${type} shows ${block}`);
    }
    assert.ok(layersOf({ type: 'text' }).includes('content'));
    assert.ok(layersOf({ type: 'paragraph' }).includes('content'));
});

test('Shape shows only for Button, Avatar Shape only for Avatar and Text, and the glyph of Image and Node is its own', () => {
    assert.deepEqual(skeleton.props.shape.visibleIf, { prop: 'type', is: 'button' });
    assert.deepEqual(skeleton.props.avatarShape.visibleIf, { any: [{ prop: 'type', is: 'avatar' }, { prop: 'type', is: 'text' }] });
    assert.deepEqual(skeleton.props.imageIcon.visibleIf, { prop: 'type', is: 'image' });
    assert.deepEqual(skeleton.props.nodeIcon.visibleIf, { prop: 'type', is: 'node' });
});

test('the avatar is shown for the Avatar kind, and beside the text when Avatar is on', () => {
    assert.ok(!layersOf({ type: 'text' }).includes('avatar'));
    assert.ok(layersOf({ type: 'text', avatar: true }).includes('avatar'));
    assert.ok(layersOf({ type: 'avatar' }).includes('avatar'));
});

test('Active pulses the shown blocks (Play reads the loop condition); the blocks are the anatomy and the avatar', () => {
    const looped = skeleton.anatomy.filter(p => p.loop).map(p => p.id);
    assert.deepEqual(looped, ['avatar', 'title', 'row1', 'row2', 'row3', 'buttonBlock', 'inputBlock', 'imageBlock', 'nodeBlock']);
    assert.deepEqual(skeleton.anatomy.find(a => a.id === 'row1').loop.when, { prop: 'active', is: true });
});
