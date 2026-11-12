// Card (antd Card): head > cover > body > actions, each optional part a layer made while its prop is on; Size is the five Midas steps, Variant and Type are collections;
// Hoverable gates the hover shadow (preview state, export, cursor).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { activeStateOf, canvasColorsOf, shadowLayersOf } from '../src/behavior-engine/preview.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { iconRolesOf } from '../src/behavior-engine/icon-set.js';
import { templateDependencies } from '../src/behavior-engine/design-system.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const card = TEMPLATES.get('antd-card');
const model = modelFor(card);
const names = props => instanceFor(model, props).slice(1).map(n => n.behavior?.slot ?? n.behavior?.group ?? n.propBind?.slot ?? n.name);

test('the schema is valid and declares the collections, the props and the slots', () => {
    assert.deepEqual(validateTemplateSchema(card), []);
    assert.deepEqual(Object.keys(card.props).sort(), ['actions', 'cover', 'coverImage', 'coverPosition', 'extra', 'header', 'hoverable', 'size', 'title', 'type', 'variant']);
    assert.deepEqual(card.props.size.modes, ['xs', 'sm', 'md', 'lg', 'xl']);
    assert.deepEqual(card.props.variant.modes, ['outlined', 'borderless']);
    assert.deepEqual(card.props.type.modes, ['default', 'inner']);
    assert.deepEqual(card.slots.map(s => s.id), ['extraContent', 'body', 'coverPicture', 'action1', 'action2', 'action3']);
});

test('header, extra, cover and actions add their layers while on and leave none while off', () => {
    const off = names({});
    for (const hidden of ['aboveBox', 'belowBox', 'footer', 'action1Box', 'action1', 'extraContent']) assert.ok(!off.includes(hidden), `${hidden} is not there while its prop is off`);
    assert.ok(off.includes('header'), 'the head is on by default');
    assert.ok(!names({ header: false }).includes('header'), 'header off removes the head');
    assert.ok(names({ cover: true }).includes('belowBox'), 'the cover starts below the head');
    assert.ok(names({ cover: true, coverPosition: 'above' }).includes('aboveBox') && !names({ cover: true, coverPosition: 'above' }).includes('belowBox'));
    assert.ok(names({ extra: true }).includes('extraContent'));
    const actions = names({ actions: true });
    for (const shown of ['footer', 'action1Box', 'action2Box', 'action3Box', 'action1', 'action2', 'action3']) assert.ok(actions.includes(shown), shown);
});

test('the layers run head, cover, body, actions; the body is the frame itself with three text lines', () => {
    const orderOf = props => instanceFor(model, { cover: true, actions: true, ...props }).map(n => n.behavior?.group ?? n.behavior?.slot).filter(g => ['header', 'aboveBox', 'belowBox', 'bodyBox', 'footer'].includes(g));
    assert.deepEqual(orderOf({}), ['header', 'belowBox', 'bodyBox', 'footer'], 'below the head by default');
    assert.deepEqual(orderOf({ coverPosition: 'above' }), ['aboveBox', 'header', 'bodyBox', 'footer']);
    assert.deepEqual(names({}).filter(n => n.startsWith('bodyLine')), ['bodyLine1', 'bodyLine2', 'bodyLine3']);
    assert.equal(card.slots.find(s => s.id === 'body').box, 'bodyBox', 'the Body slot is the body frame itself: no drop-zone layer inside it');
});

test('the size ladder holds the head height, the paddings and the action padding of each step', () => {
    const px = role => Number(/space-(\d+)/.exec(role)?.[1]);
    const row = token => ['xs', 'sm', 'md', 'lg', 'xl'].map(mode => px(card.tokenRoles[token][mode]));
    assert.deepEqual(row('headHeight'), [32, 40, 56, 64, 72]);
    assert.deepEqual(row('padding'), [8, 12, 24, 28, 32]);
    assert.deepEqual(row('actionPaddingY'), [6, 8, 12, 14, 16]);
    assert.equal(card.tokenRoles.titleTypography.md, 'text-lg-strong');
});

test('the actions and the extra start with instances of other templates, whose masters come first', () => {
    const seeds = Object.fromEntries(card.slots.filter(s => s.seed).map(s => [s.id, s.seed[0]]));
    assert.deepEqual(Object.keys(seeds), ['extraContent', 'action1', 'action2', 'action3']);
    assert.deepEqual(['action1', 'action2', 'action3'].map(id => seeds[id].icon), ['setting', 'edit', 'ellipsis']);
    assert.deepEqual(seeds.action1.modes, { variant: 'text' });
    assert.equal(seeds.extraContent.props.label, 'More');
    assert.deepEqual(templateDependencies(card, [...TEMPLATES.values()]).sort(), ['antd-link', 'button', 'icon-button']);
    for (const role of ['setting', 'edit', 'ellipsis']) assert.ok(iconRolesOf([card]).includes(role), role);
});

test('hover is a preview state only while Hoverable holds, and it changes the border and the shadow, never an outline', () => {
    assert.deepEqual(card.previewStates.hover, { border: 'borderHover', shadow: 'shadowHover' });
    assert.equal(activeStateOf(card, resolveProps(card, { hoverable: false }), 'hover').state, 'default');
    const on = activeStateOf(card, resolveProps(card, { hoverable: true }), 'hover');
    assert.equal(on.state, 'hover');
    assert.equal(on.overrides.shadow, 'shadowHover');
});

test('the canvas gets the hover shadow as drop shadows to draw', () => {
    assert.deepEqual(shadowLayersOf('0px 1px 2px -2px #00000029, 0px 3px 6px 0px #0000001f'), [
        { x: 0, y: 1, blur: 2, spread: -2, color: '#00000029' },
        { x: 0, y: 3, blur: 6, spread: 0, color: '#0000001f' },
    ]);
    assert.deepEqual(shadowLayersOf('none'), []);
    const modes = Object.fromEntries(Object.entries(model.binding.variables).map(([prop, cid]) => [prop, model.variables.collections.find(c => c.id === cid).modes.find(m => m.name === card.props[prop].defaultMode).id]));
    const colors = canvasColorsOf(card, model.binding, modes, model.variables, resolveProps(card, { hoverable: true }), 'hover');
    assert.equal(colors?.shadow?.length, 3, 'the three shadows of the lift');
    assert.equal(colors?.stroke !== undefined || colors?.shadow !== undefined, true);
});

test('the export gates the hover rule on the hoverable attribute, draws the shadow and sets the pointer cursor and the 0.2s transition', () => {
    const out = generateComponent(card, model.binding, model.variables, 'Card', model.frame, id => model.created.filter(n => n.parentId === id));
    const css = out.files['Card.css'];
    assert.match(css, /\[data-hoverable\]:hover/);
    assert.match(css, /box-shadow/);
    assert.match(css, /\.antd-card\[data-hoverable\] \{\s*cursor: pointer;/);
    assert.match(css, /transition: border-color 0\.2s ease, box-shadow 0\.2s ease/);
    assert.match(out.files['Card.jsx'] ?? out.files['Card.tsx'], /data-hoverable/);
});

import { newlyShownImageProps, PLACEHOLDER_IMAGE } from '../src/behavior-engine/placeholder-image.js';
import { instancePanel } from '../src/behavior-engine/panel.js';

test('Cover is an image slot: it starts with the placeholder picture when it turns on, not when its position changes or it already has a picture', () => {
    const at = props => resolveProps(card, props);
    assert.deepEqual(newlyShownImageProps(card, at({}), at({ cover: true })), ['coverImage']);
    assert.deepEqual(newlyShownImageProps(card, at({ cover: true }), at({ cover: true, coverPosition: 'above' })), [], 'moving the cover keeps its picture');
    assert.deepEqual(newlyShownImageProps(card, at({}), at({ cover: true, coverImage: 'mine' })), [], 'a picture the designer chose stays');
    assert.match(PLACEHOLDER_IMAGE, /^data:image\/svg\+xml;base64,/);
    assert.equal(card.slots.find(s => s.id === 'coverPicture').holds, 'image');
});

test('Cover position is a Prop right below the Cover toggle, listed only while Cover is on, with its two labels; the picture is the slot row', () => {
    const rowsOf = props => instancePanel({ id: 'i', behavior: { version: 2, props } }, model.frame, model.variables.collections, {}).rows;
    const names = rows => rows.filter(r => r.kind !== 'variable').map(r => r.prop);
    assert.ok(!names(rowsOf({})).includes('coverPosition') && !names(rowsOf({})).includes('coverImage'));
    const on = rowsOf({ cover: true });
    const order = names(on);
    assert.equal(order[order.indexOf('cover') + 1], 'coverPosition');
    assert.deepEqual(on.find(r => r.prop === 'coverPosition').options.map(o => o.name), ['Above header', 'Below header']);
    assert.equal(on.find(r => r.prop === 'coverPosition').value, 'below');
    const picture = on.find(r => r.prop === 'coverImage');
    assert.deepEqual([picture.kind, picture.slot, picture.label], ['image', true, 'Cover']);
});
