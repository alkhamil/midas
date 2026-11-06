// A persistent state may be an attribute of the root (`statePseudo: '[data-checked]'`), not a pseudo-class: a label has no :checked of its own. The
// export writes the attribute from the prop and the stylesheet selects on it; Play draws the same attribute; the box (a group frame with display
// tokens) draws its own fill, border, radius and size in the stylesheet, and the states swap the token variables it reads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { BOXY, modelFor, instanceFor } from './helpers/box-template.js';

const model = modelFor(BOXY);
const files = () => {
    const out = generateComponent(model.template, model.binding, model.variables, 'Boxy', model.frame, id => model.created.filter(n => n.parentId === id));
    assert.deepEqual(out.problems, []);
    return out.files;
};

test('the validator accepts an attribute selector for a persistent state and refuses a class selector', () => {
    assert.deepEqual(validateTemplateSchema(BOXY), []);
    const bad = structuredClone(BOXY);
    bad.statePseudo.checked = '.checked';
    assert.ok(validateTemplateSchema(bad).some(p => /statePseudo/.test(p)));
});

test('the export writes the state attribute from the prop and selects on it, guarded by the disabled state', () => {
    const { 'Boxy.jsx': jsx, 'Boxy.css': css } = files();
    assert.match(jsx, /data-checked=\{checked \|\| undefined\}/);
    assert.match(css, /\.boxy\[data-variant="[^"]+"\]\[data-checked\]:not\(\[aria-disabled="true"\]\) \{[^}]*--boxy-box-bg: var\(--boxy-box-bg-checked\)|\.boxy\[data-variant="[^"]+"\]\[data-checked\]:not\(\[aria-disabled="true"\]\) \{[^}]*--boxy-box-bg:/);
    assert.match(css, /\[aria-disabled="true"\] \{[^}]*--boxy-box-bg:/, 'disabled swaps the box colours too');
});

test('the box is one element of the template with its own fill, border, radius and size from its tokens', () => {
    const { 'Boxy.jsx': jsx, 'Boxy.css': css } = files();
    assert.match(jsx, /<div className="boxy-box">/);
    const rule = css.match(/\.boxy-box \{[^}]*\}/g).join('\n');
    assert.match(rule, /background-color: var\(--boxy-box-bg\)/);
    assert.match(rule, /border-color: var\(--boxy-box-border\)/);
    assert.match(rule, /border-width: 1px/);
    assert.match(rule, /border-style: solid/);
    assert.match(rule, /border-radius: var\(--boxy-box-radius\)/);
    assert.match(rule, /width: var\(--boxy-box-size\)/);
    assert.match(rule, /height: var\(--boxy-box-size\)/);
    assert.match(rule, /box-sizing: border-box/);
});

test('the root draws no border of its own: the box is the one border-drawing element', () => {
    const { 'Boxy.css': css } = files();
    const root = css.match(/\.boxy \{[^}]*\}/g).join('\n');
    assert.doesNotMatch(root, /border-width/);
});

test('Play draws the state attribute on the root, from the instance props', () => {
    const play = props => {
        const nodes = instanceFor(model, props);
        const { root, problems } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, ...nodes] }], variables: model.variables }, nodes[0].id);
        assert.deepEqual(problems, []);
        return root;
    };
    assert.equal(play({ checked: true }).attrs['data-checked'], true);
    assert.equal(play({}).attrs['data-checked'], undefined);
});
