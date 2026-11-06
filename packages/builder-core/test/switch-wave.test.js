// Switch click wave (antd parity): the track ripples in the accent colour, like Button's wave.
// The mechanism is generic (interaction.wave plus a wave-color token); the schema only declares it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { modelFor } from './helpers/box-template.js';

const sw = TEMPLATES.get('switch');

function css() {
    const model = modelFor(sw);
    const out = generateComponent(sw, model.binding, model.variables, 'Switch', model.frame, id => model.created.filter(n => n.parentId === id));
    assert.deepEqual(out.problems, []);
    return out.files['Switch.css'];
}

test('the schema declares the generic wave interaction with an accent wave colour', () => {
    assert.deepEqual(validateTemplateSchema(structuredClone(sw)).filter(p => /interaction|wave/i.test(p)), []);
    assert.deepEqual(sw.interaction, { focus: 'outline', wave: true });
    assert.ok(sw.tokens.fromColor.includes('wave-color'), 'wave-color is a Color token');
    assert.equal(sw.tokenKinds['wave-color'], 'color');
    assert.deepEqual(sw.tokenRoles['wave-color'], { default: 'text', primary: 'brand', danger: 'danger' });
});

test('the export draws the wave ring in the accent colour and fires it on click', () => {
    const text = css();
    assert.match(text, /@keyframes midas-wave \{\s*0% \{\s*box-shadow: 0 0 0 0 var\(--midas-wave-color\); opacity: 0\.2;\s*\}/s);
    assert.match(text, /\.switch\[data-wave-on\]::after \{\s*animation: midas-wave 2s cubic-bezier\(0\.08, 0\.82, 0\.17, 1\);\s*\}/s);
    assert.match(text, /\.switch::after \{\s*content: '';\s*position: absolute;\s*inset: 0;\s*border-radius: inherit;\s*pointer-events: none;\s*--midas-wave-color: var\(--switch-wave-color\);\s*box-shadow: 0 0 0 0 var\(--midas-wave-color\);\s*opacity: 0;\s*\}/s);
    const model = modelFor(sw);
    const out = generateComponent(sw, model.binding, model.variables, 'Switch', model.frame, id => model.created.filter(n => n.parentId === id));
    assert.match(out.files['Switch.jsx'], /data-wave/);
    assert.match(out.files['Switch.jsx'], /waveDown\(e\.currentTarget\)/);
});

test('the wave is off while disabled or loading, and respects reduced motion', () => {
    const text = css();
    assert.match(text, /@media \(prefers-reduced-motion: reduce\) \{\s*\.switch \{\s*transition: none;\s*\}\s*\.switch\[data-wave-on\]::after \{\s*animation: none;\s*\}/s);
    const model = modelFor(sw);
    const out = generateComponent(sw, model.binding, model.variables, 'Switch', model.frame, id => model.created.filter(n => n.parentId === id));
    assert.match(out.files['Switch.jsx'], /blocked \? undefined : \(e\) => \{ if \(onClick\) onClick\(e\); waveDown\(e\.currentTarget\); \}/);
});

test("Button's export still draws its own wave and names no Switch token", () => {
    const button = TEMPLATES.get('button');
    const model = modelFor(button);
    const out = generateComponent(button, model.binding, model.variables, 'Button', model.frame, id => model.created.filter(n => n.parentId === id));
    assert.deepEqual(out.problems, []);
    assert.match(out.files['Button.css'], /\.button\[data-wave-on\]::after/);
    assert.doesNotMatch(out.files['Button.css'], /switch/i);
    assert.doesNotMatch(out.files['Button.jsx'], /switch/i);
});
