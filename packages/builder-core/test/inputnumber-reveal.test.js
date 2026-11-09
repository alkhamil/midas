// The handler column of the InputNumber slides in from the right edge while it fades in (antd's handler wrap: the transition of every property over motionDurationMid, 0.2s, the
// default easing), on hover and focus-within, and slides back on leave. Play and the export only: the canvas node tree is unchanged and static. Reduced motion shows the column at
// once with no slide; a disabled control never reveals it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const number = TEMPLATES.get('inputnumber');
const model = modelFor(number);
const css = generateComponent(number, model.binding, model.variables, 'InputNumber', model.frame, id => model.created.filter(n => n.parentId === id)).files['InputNumber.css'];
/** Every rule body of an exact selector, joined (the selector may have several rules: the layout one and the reveal one). */
const NL = String.fromCharCode(10);
const block = selector => {
    const out = [];
    for (let at = css.indexOf(NL + selector + ' {'); at >= 0; at = css.indexOf(NL + selector + ' {', at + 1)) out.push(css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at)));
    return out.join(NL);
};

test('the schema says the slide and its time and easing as data: antd uses 0.2s and the default easing; the slide leaves from the right edge', () => {
    assert.deepEqual(number.reveal, { slot: 'stepper', duration: '0.2s', easing: 'ease', slide: '100%' });
    assert.deepEqual(validateTemplateSchema(number), []);
    const bad = structuredClone(number);
    bad.reveal.slide = 'far';
    assert.match(validateTemplateSchema(bad).join('\n'), /reveal slide/);
    bad.reveal = { ...number.reveal, easing: 5 };
    assert.match(validateTemplateSchema(bad).join('\n'), /reveal easing/);
});

test('at rest the column is transparent and one width off to the right; revealed it is opaque and in place; both over 0.2s with the same easing, reversed on leave', () => {
    const rest = block('.inputnumber-stepper').replace(/\s+/g, ' ');
    assert.match(rest, /opacity: 0;/);
    assert.match(rest, /transform: translateX\(100%\);/, 'the slide starts at the right edge');
    assert.match(rest, /pointer-events: none;/);
    assert.match(rest, /transition: opacity 0\.2s ease, transform 0\.2s ease;/, 'one time and easing for the fade and the slide, so leaving runs the same in reverse');
    const shown = /\.inputnumber:hover:not\(:has\(:disabled\)\) \.inputnumber-stepper,\n\.inputnumber:focus-within:not\(:has\(:disabled\)\) \.inputnumber-stepper \{([^}]*)\}/.exec(css)?.[1].replace(/\s+/g, ' ');
    assert.ok(shown, 'on hover and on focus-within');
    assert.match(shown, /opacity: 1;/);
    assert.match(shown, /transform: translateX\(0\);/, 'to rest');
    assert.match(shown, /pointer-events: auto;/);
});

test('the slide stays inside the box: the control clips it, so the column never shows outside the border while it moves', () => {
    assert.match(block('.inputnumber').replace(/\s+/g, ' '), /overflow: hidden;/);
});

test('a disabled control never reveals it: the reveal rule is guarded on the field not being disabled, and nothing else reveals it', () => {
    assert.ok(!/\.inputnumber:hover \.inputnumber-stepper/.test(css) && !/\.inputnumber:focus-within \.inputnumber-stepper/.test(css), 'no unguarded reveal');
    assert.equal((css.match(/translateX\(0\)/g) ?? []).length, 1, 'one rule brings it to rest');
    assert.ok(!/\.inputnumber:has\(:disabled\) \.inputnumber-stepper \{[^}]*opacity: 1/.test(css));
});

test('prefers-reduced-motion: no slide and no transition, the column shows at once', () => {
    const media = /@media \(prefers-reduced-motion: reduce\) \{\s*\.inputnumber-stepper \{([^}]*)\}/.exec(css)?.[1].replace(/\s+/g, ' ');
    assert.ok(media, 'the override is there');
    assert.match(media, /transition: none;/);
    assert.match(media, /transform: none;/, 'it never sits off to the side');
});

test('the canvas and the shared tree are unchanged: the column is a plain layer, drawn, with no opacity, transform or hidden flag; the animation is in the stylesheet only', () => {
    for (const n of instanceFor(model, number.sampleProps)) {
        assert.ok(n.visible !== false && n.opacity !== 0, n.name);
        assert.equal(n.transform, undefined);
    }
    const nodes = instanceFor(model, number.sampleProps);
    const tree = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, ...nodes] }], variables: model.variables }, nodes[0].id);
    const walk = el => [el, ...(el.children ?? []).flatMap(walk)];
    for (const el of walk(tree.root)) assert.ok(!/translate|opacity/.test(JSON.stringify(el.style ?? {})), 'no inline slide or fade in the descriptors');
    assert.match(String(tree.styles), /translateX\(100%\)/, 'Play carries the stylesheet');
});
