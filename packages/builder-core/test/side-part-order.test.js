// A part on a side (the Button's spinner, by iconPlacement) sits before the label for `start` and after it for `end`, and while it shows it replaces the icon
// slot on its side. The export and Play draw that order; the canvas must too, also when the placement changes on an instance that already exists (before, only a
// freshly made instance was ordered, so an `end` Button loading showed its spinner at the start on the canvas and at the end in Play and the export).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { applyTemplateToFrame, instanceOf, sidedPartOrder } from '../src/behavior-engine/template-master.js';
import { slotShown } from '../src/behavior-engine/template-master.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { buttonModel } from '../../../scripts/button-model.mjs';

const button = TEMPLATES.get('button');
const model = buttonModel({ colors: ['primary'], variantModes: ['solid'] });
const variables = { collections: model.collections, items: model.items };
const spinner = { id: 's', name: 'spinner', type: 'ellipse', behavior: { version: 2, part: 'spinner' } };
const label = { id: 'l', name: 'label', type: 'text' };
const iconStart = { id: 'is', name: 'iconStart', type: 'frame', behavior: { version: 2, slot: 'iconStart' } };
const iconEnd = { id: 'ie', name: 'iconEnd', type: 'frame', behavior: { version: 2, slot: 'iconEnd' } };

test('the spinner goes before the label for start and after it for end, whatever order the layers were in', () => {
    assert.deepEqual(sidedPartOrder(button, [spinner, label], { iconPlacement: 'start' }), ['s', 'l']);
    assert.deepEqual(sidedPartOrder(button, [spinner, label], { iconPlacement: 'end' }), ['l', 's']);
    assert.deepEqual(sidedPartOrder(button, [label, spinner], { iconPlacement: 'start' }), ['s', 'l']);
    assert.deepEqual(sidedPartOrder(button, [label, spinner], { iconPlacement: 'end' }), ['l', 's']);
});

test('the other layers keep their places: an icon slot stays on its side of the label', () => {
    assert.deepEqual(sidedPartOrder(button, [iconStart, spinner, label, iconEnd], { iconPlacement: 'end' }), ['is', 'l', 's', 'ie']);
    assert.deepEqual(sidedPartOrder(button, [iconStart, label, spinner, iconEnd], { iconPlacement: 'start' }), ['is', 's', 'l', 'ie']);
});

test('a template with no sided part, or an instance with no label, keeps its order', () => {
    assert.deepEqual(sidedPartOrder(TEMPLATES.get('input'), [label, spinner], {}), ['l', 's']);
    assert.deepEqual(sidedPartOrder(button, [spinner], { iconPlacement: 'end' }), ['s']);
});

test('it is the order a new instance is made with, for both placements', () => {
    const frame = { id: 'master', name: 'Button', type: 'frame', parentId: null, fills: [] };
    const created = applyTemplateToFrame(button, { frame, children: [], binding: { variables: model.binding.variables }, variables, idOf: key => `m-${key}` }).created;
    for (const iconPlacement of ['start', 'end']) {
        const copies = instanceOf(button, frame, created, { iconPlacement, loading: true }, { id: src => `i-${src}` }).slice(1);
        const ids = copies.map(n => n.id);
        const wanted = sidedPartOrder(button, copies, { iconPlacement });
        assert.deepEqual(ids, wanted, iconPlacement);
    }
});

test('loading replaces the icon of its side and nothing else: the icon slot is not shown while the spinner takes its place, on its own side only', () => {
    const props = { hasIcon: true, iconPlacement: 'start', loading: true };
    assert.equal(slotShown(button, 'iconStart', props), false, 'the start icon is replaced');
    assert.equal(slotShown(button, 'iconEnd', props), false, 'the end icon is not shown for placement start');
    assert.equal(slotShown(button, 'iconStart', { ...props, loading: false }), true);
    assert.equal(slotShown(button, 'iconEnd', { hasIcon: true, iconPlacement: 'end', loading: true }), false);
    assert.equal(slotShown(button, 'iconEnd', { hasIcon: true, iconPlacement: 'end', loading: false }), true);
});

test('Play and the export draw one thing at the placement side: the spinner, never the icon beside it, with and without hasIcon', () => {
    const css = generateComponent(button, model.binding, variables, 'Button', { id: 'm', type: 'frame', layout: 'horizontal' }, () => []).files['Button.jsx'];
    assert.match(css, /\{hasIcon && iconPlacement === "start" && !\(loading === true && iconPlacement === "start"\) && <span className="button-iconStart">/);
    assert.match(css, /\{hasIcon && iconPlacement === "end" && !\(loading === true && iconPlacement === "end"\) && <span className="button-iconEnd">/);
    assert.match(css, /\{loading === true && iconPlacement !== "end" && \(<svg className="button-spinner"/);
    assert.match(css, /\{loading === true && iconPlacement === "end" && \(<svg className="button-spinner"/);
    assert.ok(css.indexOf('iconPlacement !== "end" && (<svg') < css.indexOf('<span className="button-label">'), 'start: before the label');
    assert.ok(css.indexOf('iconPlacement === "end" && (<svg') > css.indexOf('<span className="button-label">'), 'end: after the label');
});
