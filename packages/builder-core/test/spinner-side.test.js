import test from 'node:test';
import assert from 'node:assert/strict';
import { replacedSlotsOf } from '../src/behavior-engine/anatomy.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { buttonModel } from '../../../scripts/button-model.mjs';
import { BUTTON } from '../src/templates/button.js';

test('the spinner replaces the icon slot of its placement side while loading: start, end, or none when not loading', () => {
    assert.deepEqual(replacedSlotsOf(BUTTON, { loading: true, iconPlacement: 'start', hasIcon: false }), ['iconStart'], 'start side, with Has Icon off');
    assert.deepEqual(replacedSlotsOf(BUTTON, { loading: true, iconPlacement: 'end', hasIcon: true }), ['iconEnd'], 'end side');
    assert.deepEqual(replacedSlotsOf(BUTTON, { loading: false, iconPlacement: 'end', hasIcon: true }), [], 'not loading: no slot is replaced');
});

test('the generated Button draws the spinner before the label on the start side and after it on the end side', () => {
    const model = buttonModel({ colors: ['primary'], variantModes: ['solid'] });
    const master = { id: 'm', name: 'Button', type: 'frame', component: true, parentId: null, behavior: model.binding, vars: {}, fills: [] };
    const jsx = generateComponent(TEMPLATES.get('button'), model.binding, { collections: model.collections, items: model.items }, 'Button', master, () => []).files['Button.jsx'];
    const label = jsx.indexOf('<span className="button-label">');
    const startSpinner = jsx.indexOf('{loading === true && iconPlacement !== "end" && (<svg className="button-spinner"');
    const endSpinner = jsx.indexOf('{loading === true && iconPlacement === "end" && (<svg className="button-spinner"');
    assert.ok(startSpinner > -1 && startSpinner < label, 'the start-side spinner comes before the label');
    assert.ok(endSpinner > label, 'the end-side spinner comes after the label');
});

test('the exported spinner is sized by the icon size token and draws its stroke in the foreground colour', () => {
    const model = buttonModel({ colors: ['primary'], variantModes: ['solid'] });
    const master = { id: 'm', name: 'Button', type: 'frame', component: true, parentId: null, behavior: model.binding, vars: {}, fills: [] };
    const jsx = generateComponent(TEMPLATES.get('button'), model.binding, { collections: model.collections, items: model.items }, 'Button', master, () => []).files['Button.jsx'];
    const spinner = jsx.slice(jsx.indexOf('<svg className="button-spinner"'), jsx.indexOf('</svg>', jsx.indexOf('<svg className="button-spinner"')));
    assert.ok(spinner.includes('style={{ width: "var(--button-icon-size)", height: "var(--button-icon-size)" }}'), 'the box is the icon size token');
    assert.ok(!/width=\{14\}/.test(spinner), 'no fixed 14px box');
    assert.ok(spinner.includes('stroke="currentColor"'), 'the stroke takes the element colour, which is the foreground token');
});
