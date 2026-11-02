// The antd click wave: a ring on the host that expands and fades, then removes itself. A click toggles the
// data-wave-on attribute, the ::after ring animates (box-shadow 0 to 6px, opacity .2 to 0), and animationend removes
// the attribute. No wave when disabled; reduced motion kills it. One shared runtime in Play, an inline equivalent in
// generated code; no per-component branches.
import test from 'node:test';
import assert from 'node:assert/strict';
import { showWave } from '../src/prototype/wave.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { buttonModel } from '../../../scripts/button-model.mjs';
import { inputModel } from '../../../scripts/input-model.mjs';

const button = TEMPLATES.get('button');
const input = TEMPLATES.get('input');
const model = buttonModel({ colors: ['primary'], variantModes: ['solid'] });
const vars = { collections: model.collections, items: model.items };
const master = { id: 'm', name: 'Button', type: 'frame', layout: 'horizontal', behavior: model.binding, vars: {} };
const out = generateComponent(button, model.binding, vars, 'Button', master, () => []);
const css = out.files['Button.css'];
const jsx = out.files['Button.jsx'];

function fakeHost({ disabled = false } = {}) {
    const listeners = {};
    const el = {
        disabled,
        attrs: {},
        offsetWidth: 120,
        setAttribute(k, v) { this.attrs[k] = v; },
        removeAttribute(k) { delete this.attrs[k]; },
        addEventListener(t, fn, o) { (listeners[t] ??= []).push({ fn, o }); },
        fire(t, ev) { for (const { fn } of listeners[t] ?? []) fn(ev); },
    };
    return { el, listeners };
}

test('a click sets data-wave-on and animationend removes it', () => {
    const { el } = fakeHost();
    showWave(el, { raf: fn => fn() });
    assert.equal(el.attrs['data-wave-on'], '');
    el.fire('animationend', { animationName: 'midas-wave' });
    assert.ok(!('data-wave-on' in el.attrs), 'removed after the wave animation');
});

test('other animations do not remove it; rapid clicks restart it', () => {
    const { el } = fakeHost();
    showWave(el, { raf: fn => fn() });
    el.fire('animationend', { animationName: 'something-else' });
    assert.equal(el.attrs['data-wave-on'], '', 'kept');
    showWave(el, { raf: fn => fn() });
    assert.equal(el.attrs['data-wave-on'], '', 'restarted');
});

test('no wave when disabled', () => {
    const { el, listeners } = fakeHost({ disabled: true });
    showWave(el, { raf: fn => fn() });
    assert.ok(!('data-wave-on' in el.attrs), 'no attribute');
    assert.deepEqual(listeners, {}, 'no listeners');
});

test('codegen emits the wave hooks on wave templates only', () => {
    assert.match(jsx, /data-wave/);
    assert.match(jsx, /onAnimationEnd/);
    assert.match(jsx, /data-wave-on/);
    const imodel = inputModel({});
    const ijsx = generateComponent(input, imodel.binding, { collections: imodel.collections, items: imodel.items }, 'Input', { id: 'm', name: 'Input', type: 'frame', layout: 'horizontal', behavior: imodel.binding, vars: {} }, () => []).files['Input.jsx'];
    assert.doesNotMatch(ijsx, /data-wave/);
});

test('the wave ring inherits radius and reads the wave colour', () => {
    assert.match(css, /\.button \{[^}]*position: relative;/);
    assert.match(css, /\.button::after \{[^}]*border-radius: inherit;[^}]*box-shadow: 0 0 0 0 var\(--button-wave-color\);/);
    assert.match(css, /@keyframes midas-wave \{[\s\S]*?box-shadow: 0 0 0 6px var\(--button-wave-color\);[\s\S]*?opacity: 0;/);
    assert.match(css, /\.button\[data-wave-on\]::after \{\n\s*animation: midas-wave 2s cubic-bezier\(0\.08, 0\.82, 0\.17, 1\);\n\}/);
});
