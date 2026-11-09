// Tag's close is a clickable part: it recolours on hover to the Color preset's solid colour (a bound token, no literal). The hover is an interaction of
// Play and the export; the canvas is static (the close layer binds its rest colour only). Tag has no disabled state, so nothing blocks the hover.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { iconDefsOf } from '../src/behavior-engine/anatomy.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const tag = TEMPLATES.get('antd-tag');
const model = modelFor(tag);
const exported = generateComponent(model.template, model.binding, model.variables, 'Tag', model.frame, id => model.created.filter(n => n.parentId === id));

test('the close icon recolours on hover to the preset solid colour (a Color token)', () => {
    const close = iconDefsOf(tag).find(d => d.slot === 'close');
    assert.equal(close.tokens.hoverColour, 'color-solid');
    assert.equal(close.tokens.colour, 'fg', 'the rest colour is unchanged');
});

test('the export and Play write the hover rule on the close, token-bound, and nothing else changes colour on hover', () => {
    const css = exported.files['Tag.css'];
    assert.match(css, /\.antd-tag-close:hover \{\s*color: var\(--antd-tag-color-solid\);\s*\}/);
    assert.doesNotMatch(css, /:hover[^}]*#[0-9a-f]{3,8}/i, 'no colour literal in a hover rule');
});

test('the canvas is static: the close layer binds its rest colour, not the hover one', () => {
    const close = instanceFor(model, { closable: true }).find(n => n.name === 'close');
    assert.equal(Object.values(close.vars ?? {}).includes(model.variables.items.find(i => i.name === 'tagColorSolid')?.id), false, 'no hover colour variable on the layer');
});
