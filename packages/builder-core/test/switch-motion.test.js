// Switch motion (antd, timings and easings only): the track recolours over 0.2s ease-in-out;
// the handle grows 4px while pressed over 0.2s (flex-end keeps its far edge on the padding,
// so it grows toward the inside). The checked prop moves the handle by alignment on every
// surface — the travel always spans the real track width, so there is no transform slide
// to transition. Play uses the same stylesheet as the export; the canvas stays static.
// Disabled never animates; reduced motion kills the transitions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const sw = TEMPLATES.get('switch');

function css() {
    const model = modelFor(sw);
    const out = generateComponent(sw, model.binding, model.variables, 'Switch', model.frame, id => model.created.filter(n => n.parentId === id));
    assert.deepEqual(out.problems, []);
    return out.files['Switch.css'];
}

test('the schema declares the motion as data: track and handle transitions and the press grow, no slide', () => {
    assert.deepEqual(validateTemplateSchema(structuredClone(sw)).filter(p => /motion/i.test(p)), []);
    assert.deepEqual(sw.motion.transitions, [
        { key: 'root', props: ['background-color'], duration: '0.2s', timing: 'ease-in-out' },
        { key: 'handle', props: ['width'], duration: '0.2s', timing: 'ease-in-out' },
    ]);
    assert.equal(sw.motion.slide, undefined, 'alignment moves the handle, so no transform slide is declared');
    assert.deepEqual(sw.motion.press, { key: 'handle', token: 'handleSize', prop: 'width', grow: '4px' });
});

test('the export transitions the track colour and the handle width', () => {
    const text = css();
    assert.match(text, /\.switch \{\s*[^}]*transition: background-color 0\.2s ease-in-out;\s*[^}]*\}/s);
    assert.match(text, /\.switch-handle \{\s*[^}]*transition: width 0\.2s ease-in-out;\s*[^}]*\}/s);
});

test('the handle moves by alignment: checked puts it at the end, unchecked at the start', () => {
    const text = css();
    assert.match(text, /\.switch\[data-checked-align="start"\] \{\s*justify-content: flex-start;\s*\}/s);
    assert.match(text, /\.switch\[data-checked-align="end"\] \{\s*justify-content: flex-end;\s*\}/s);
    assert.doesNotMatch(text, /translateX/, 'no transform travel: the travel spans the real track width');
});

test('the handle grows 4px while pressed', () => {
    assert.match(css(), /\.switch:active:not\(:disabled\) \.switch-handle \{\s*width: calc\(var\(--switch-handle-size\) \+ 4px\);\s*\}/s);
});

test('a slid handle grows toward the inside: one press rule, flex-end keeps the far edge on the padding', () => {
    assert.doesNotMatch(css(), /\[data-checked\]:active/, 'no checked-specific press rule: alignment already holds the far edge');
});

test('a disabled switch does not animate', () => {
    const text = css();
    assert.match(text, /\.switch:disabled \{\s*transition: none;\s*\}/s);
    assert.match(text, /\.switch:disabled \.switch-handle \{\s*transition: none;\s*\}/s);
});

test('reduced motion kills the transitions', () => {
    const text = css();
    const tail = text.slice(text.indexOf('@media (prefers-reduced-motion: reduce)'));
    assert.match(tail, /\.switch-handle \{\s*transition: none;\s*\}/s);
});

test('Play applies the same motion stylesheet as the export', () => {
    const model = modelFor(sw);
    const nodes = instanceFor(model, { checked: true });
    const frame = { id: 'top', name: 'Top', type: 'frame', parentId: null, layout: 'vertical', x: 0, y: 0, w: 400, h: 400, fills: [], layoutSizingH: 'hug', layoutSizingV: 'hug' };
    nodes[0].parentId = 'top';
    const { styles, problems } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [frame, model.frame, ...model.created, ...nodes] }], variables: model.variables }, 'top');
    assert.deepEqual(problems, []);
    assert.match(styles, /transition: background-color 0\.2s ease-in-out;/s);
    assert.match(styles, /transition: width 0\.2s ease-in-out;/s);
    assert.doesNotMatch(styles, /translateX/, 'Play moves the handle by alignment, like the export');
});
