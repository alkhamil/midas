// What a master starts with when it is created from a template or a plain frame is bound to it: the alignment (Button: center and center; Input: left and
// center) and, for the Input only, a fixed width of 343px. All of it is a default the node owns: the designer changes it in the Design panel, and neither Auto
// Fix, a sync nor a second run of the generator puts it back (the alignment is written once, when the frame has no auto layout yet; the width is
// written once at bind time, even when the frame already lays out). The width is not a variable, so it is
// not the bound-axes rule's business. The Button has no width default.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { applyTemplateToFrame, instanceOf } from '../src/behavior-engine/template-master.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { rootLayoutOf } from '../src/behavior-engine/layout.js';
import { buttonModel } from '../../../scripts/button-model.mjs';
import { inputModel } from '../../../scripts/input-model.mjs';

const button = TEMPLATES.get('button');
const input = TEMPLATES.get('input');
const bmodel = buttonModel({ colors: ['primary'], variantModes: ['solid'] });
const imodel = inputModel();
const plainFrame = () => ({ id: 'master', name: 'Frame', type: 'frame', parentId: null, fills: [], w: 160, h: 32 });
const run = (template, model, frame, children = []) => applyTemplateToFrame(template, { frame, children, binding: { variables: model.binding.variables }, variables: { collections: model.collections, items: model.items }, idOf: key => `d-${key}` });

test('a Button is created centred on both axes, an Input left and centred', () => {
    const b = plainFrame(); run(button, bmodel, b);
    assert.equal(b.layout, 'horizontal');
    assert.equal(b.primaryAlign, 'center');
    assert.equal(b.counterAlign, 'center');
    const i = plainFrame(); run(input, imodel, i);
    assert.equal(i.primaryAlign, 'start');
    assert.equal(i.counterAlign, 'center');
});

test('only the Input gets a width: fixed 343px, with no variable bound to it; the Button keeps its sizing', () => {
    const i = plainFrame(); run(input, imodel, i);
    assert.equal(i.w, 343);
    assert.equal(i.layoutSizingH, 'fixed');
    assert.equal(i.vars?.w, undefined, 'not bound to a variable');
    const b = plainFrame(); run(button, bmodel, b);
    assert.equal(b.w, 160, 'the Button keeps the width its frame had');
    assert.equal(b.layoutSizingH, 'hug');
    assert.equal('rootWidth' in button, false);
});

test('a designer\'s change survives regeneration: alignment, width and sizing are not put back by a second run, by Auto Fix\'s run, or with a layer missing', () => {
    const frame = plainFrame();
    const first = run(input, imodel, frame);
    Object.assign(frame, { primaryAlign: 'end', counterAlign: 'start', w: 200, layoutSizingH: 'hug' });
    run(input, imodel, frame, first.created);
    const without = first.created.filter(n => n.name !== 'count' && n.behavior?.part !== 'count');
    run(input, imodel, frame, without);
    assert.deepEqual([frame.primaryAlign, frame.counterAlign, frame.w, frame.layoutSizingH], ['end', 'start', 200, 'hug']);
    delete frame.primaryAlign; delete frame.counterAlign;
    run(input, imodel, frame, first.created);
    assert.deepEqual([frame.primaryAlign, frame.counterAlign], [undefined, undefined], 'a designer who set the defaults back is not overruled either');
});

test('a frame that already has its own auto layout keeps its alignment but takes the fixed width when it is bound', () => {
    const frame = { ...plainFrame(), layout: 'vertical', primaryAlign: 'end', counterAlign: 'end', w: 90, layoutSizingH: 'fill' };
    const first = run(input, imodel, frame);
    assert.deepEqual([frame.layout, frame.primaryAlign, frame.counterAlign, frame.w, frame.layoutSizingH], ['vertical', 'end', 'end', 343, 'fixed']);
    frame.w = 500; frame.layoutSizingH = 'hug';
    run(input, imodel, frame, first.created);
    assert.deepEqual([frame.w, frame.layoutSizingH], [500, 'hug'], 'a rebind never resets the designer width');
});

test('an instance starts with the master\'s alignment and width, and the export lays out the way the master does', () => {
    const frame = plainFrame();
    const created = run(input, imodel, frame).created;
    const [root] = instanceOf(input, frame, created, {}, { id: src => `i-${src}` });
    assert.deepEqual([root.primaryAlign, root.counterAlign, root.w, root.layoutSizingH], ['start', 'center', 343, 'fixed']);
    const layout = rootLayoutOf(frame, 0);
    assert.equal(layout.justifyContent, 'flex-start');
    assert.equal(layout.alignItems, 'center');
});

test('the export gives the root the fixed width of its master, and only when the master is fixed and the width is not a variable', () => {
    const frame = plainFrame();
    run(input, imodel, frame);
    const css = generateComponent(input, imodel.binding, { collections: imodel.collections, items: imodel.items }, 'Input', frame, () => []).files['Input.css'];
    assert.match(css, /\.input \{\n(?:.*\n)*?\s*width: 343px;/);
    const b = plainFrame(); run(button, bmodel, b);
    const bcss = generateComponent(button, bmodel.binding, { collections: bmodel.collections, items: bmodel.items }, 'Button', b, () => []).files['Button.css'];
    assert.doesNotMatch(bcss.match(/\.button \{\n[^}]*\}/)[0], /\n\s*width:/);
    const hugged = { ...frame, layoutSizingH: 'hug' };
    assert.doesNotMatch(generateComponent(input, imodel.binding, { collections: imodel.collections, items: imodel.items }, 'Input', hugged, () => []).files['Input.css'].match(/\.input \{\n[^}]*\}/)[0], /\n\s*width:/);
});

test('the schema fields are validated: a root width is a positive number, a primary alignment is start, center or end', () => {
    const with_ = over => validateTemplateSchema({ ...structuredClone(input), ...over }).join('\n');
    assert.equal(with_({}), '');
    assert.match(with_({ rootWidth: 0 }), /rootWidth must be a positive number of px/);
    assert.match(with_({ rootWidth: 'wide' }), /rootWidth must be a positive number of px/);
    assert.match(with_({ rootPrimaryAlign: 'left' }), /rootPrimaryAlign "left" must be start, center or end/);
});
