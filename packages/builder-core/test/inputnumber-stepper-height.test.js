// InputNumber's stepper (the handler column) follows the height of the box at every Size mode: its height is the box's `height` token, bound on the
// layer, so the canvas and Play take the same number when the Size changes (a fixed, unbound height would stay large at xs). The column covers the box's
// full height from the top edge, and its halves fill it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { pinnedFrame } from '../src/behavior-engine/template-master.js';
import { previewOf } from '../src/behavior-engine/preview.js';
import { cssVarOf } from '../src/behavior-engine/tokens.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { modelFor, instanceFor } from './helpers/box-template.js';
import { SIZE_MODES } from '../src/templates/size-modes.js';

const template = TEMPLATES.get('inputnumber');
const model = modelFor(template);
const stepper = template.anatomy.find(s => s.id === 'stepper');
const CONTROL_HEIGHT = { xs: 16, sm: 24, md: 32, lg: 40, xl: 48 };

/** The resolved variables of the template at one Size mode, by css name. */
function varsAt(size) {
    const modes = Object.fromEntries(Object.entries(model.binding.variables).map(([prop, cid]) => {
        const coll = model.variables.collections.find(c => c.id === cid);
        const want = prop === 'size' ? size : (template.props[prop].defaultMode ?? coll.modes[0].name);
        return [prop, coll.modes.find(m => m.name === want).id];
    }));
    return previewOf(template, model.binding, modes, model.variables, template.sampleProps, 'default').vars;
}

test('the stepper height is the box height token: its display height is that token, and its layer binds the height', () => {
    assert.equal(template.display.stepper.height, 'height');
    const layer = instanceFor(model, {}).find(n => n.name === 'stepper');
    assert.ok(layer.vars?.h, 'the stepper layer binds its height to a variable');
});

for (const size of SIZE_MODES) {
    test(`${size}: the pinned stepper is the box height of that Size mode, from the top edge, and its right edge is inside the right border`, () => {
        const vars = varsAt(size);
        const border = parseFloat(vars[cssVarOf(template.id, template.display.root.strokeWidth)]);
        const f = pinnedFrame(template, stepper, { w: 200, h: CONTROL_HEIGHT[size] }, vars);
        assert.equal(f.h, CONTROL_HEIGHT[size], `${size}: the column is the box height`);
        assert.equal(f.y, 0, 'from the top edge of the box');
        assert.equal(f.x + f.w, 200 - border, 'its right edge is the inside of the right border');
    });
}

test('Play: the column takes the box height token and starts on the top border line (its top is minus the border)', () => {
    const css = generateComponent(template, model.binding, model.variables, 'InputNumber', model.frame, id => model.created.filter(n => n.parentId === id)).files['InputNumber.css'];
    assert.match(css, /\.inputnumber-stepper \{[^}]*top: calc\(-1 \* var\(--inputnumber-border-width\)\);/);
    assert.match(css, /\.inputnumber-stepper \{[^}]*height: var\(--inputnumber-height\);/);
    assert.doesNotMatch(css, /\.inputnumber-stepper \{[^}]*bottom: 0;/, 'no bottom pin: the height is the token');
});
