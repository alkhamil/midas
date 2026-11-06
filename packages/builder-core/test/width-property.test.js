// A frame's width is a token property like its height: `display.<key>.width` binds the layer's `w` variable (a bound axis is fixed, never hug or fill) and
// the stylesheet writes `width` from the token. A Switch's track is fixed in width and height.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NODE_PROPERTIES, VARIABLE_KEYS } from '../src/behavior-engine/display.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { BOXY, modelFor } from './helpers/box-template.js';

/** BOXY whose root is a fixed width from a token. */
const WIDE = (() => {
    const t = structuredClone(BOXY);
    t.id = 'widey';
    t.name = 'Widey';
    t.tokens.fromVariant.push('trackWidth');
    t.tokenKinds.trackWidth = 'length';
    t.tokenRoles.trackWidth = 'switch-min-width';
    t.display.root.width = 'trackWidth';
    return t;
})();
const model = modelFor(WIDE);

test('width is a length property of a frame, bound through the w variable', () => {
    assert.deepEqual(NODE_PROPERTIES.frame.width, { kind: 'length', css: 'width' });
    assert.deepEqual(VARIABLE_KEYS.width, ['w']);
    assert.deepEqual(validateTemplateSchema(WIDE), []);
});

test('a text layer has no width token', () => {
    const bad = structuredClone(WIDE);
    bad.display.label.width = 'trackWidth';
    assert.ok(validateTemplateSchema(bad).some(p => /width/.test(p)));
});

test('the master root is bound to the width variable and fixed horizontally', () => {
    assert.ok(model.frame.vars?.w);
    assert.equal(model.frame.layoutSizingH, 'fixed');
});

test('the export writes the width from the token', () => {
    const out = generateComponent(model.template, model.binding, model.variables, 'Widey', model.frame, id => model.created.filter(n => n.parentId === id));
    assert.deepEqual(out.problems, []);
    assert.match(out.files['Widey.css'], /\.widey \{[^}]*width: var\(--widey-track-width\)/);
});
