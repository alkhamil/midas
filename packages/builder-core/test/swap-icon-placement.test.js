// The swap mechanism, by placement: in every state of a Password Input exactly one eye is displayed, it sits inside the eye box, it carries the slot's
// class (so the same size, colour and hover rules as the other eye), and a swapped-in icon is drawn inside a positioned wrapper (an absolutely placed
// vector must find the wrapper as its containing block, never the root). Pressing flips the local state, both ways; picker icons are drawn.
// Play's inline styles are modelled: an inline `display` beats a stylesheet rule unless that rule is !important.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { modelFor, instanceFor } from './helpers/box-template.js';
import { computed, elementsOf } from './helpers/play-compute.js';

const input = TEMPLATES.get('input');
const model = modelFor(input);
const out = generateComponent(model.template, model.binding, model.variables, 'Input', model.frame, id => model.created.filter(n => n.parentId === id));
const css = Object.entries(out.files).find(([name]) => name.endsWith('.css'))[1];
const jsx = out.files['Input.jsx'];

const comp = (id, name) => ({ id, name: 'Icon/' + name, type: 'frame', parentId: null, x: 0, y: 0, w: 24, h: 24, layout: 'horizontal', fills: [], layoutSizingH: 'fixed', layoutSizingV: 'fixed', component: true });
const vec = (id, parentId, w) => ({ id, name: 'v', type: 'path', parentId, x: 0, y: 0, w, h: w, points: [{ x: 0, y: 0 }, { x: 16, y: 0 }, { x: 16, y: 16 }, { x: 0, y: 16 }], fills: [{ type: 'solid', color: '#20202a', opacity: 1, visible: true }], strokeWidth: 0, rotation: 0, opacity: 1, visible: true, locked: false });
const library = [comp('c-on', 'eye'), vec('c-on-v', 'c-on', 16), comp('c-off', 'eyeOff'), vec('c-off-v', 'c-off', 16), comp('c-on2', 'eye2'), vec('c-on2-v', 'c-on2', 12)];

/** Play's tree for a password Input; the eye-off layer is auto layout like a real nested icon (so it carries an inline display). */
function playTree(extra = {}) {
    const nodes = instanceFor(model, { kind: 'password', eyeOnIcon: 'c-on', eyeOffIcon: 'c-off', ...extra });
    for (const n of nodes) if (n.behavior?.slot === 'eyeOff') n.layout = 'horizontal';
    const top = { id: 'top', name: 'Top', type: 'frame', parentId: null, layout: 'vertical', x: 0, y: 0, w: 400, h: 400, fills: [], layoutSizingH: 'hug', layoutSizingV: 'hug' };
    nodes[0].parentId = 'top';
    return toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [top, model.frame, ...model.created, ...nodes, ...library] }], variables: model.variables }, 'top').root;
}

/** Whether an element is displayed under the stylesheet: an inline display wins over a rule unless the rule is !important. */
function displayed(el, chain) {
    const rule = computed(css, chain).display;
    if (rule !== undefined && /!important$/.test(rule)) return !/^none/.test(rule);
    const value = el.style?.display ?? rule;
    return value !== 'none';
}

const rootOf = tree => elementsOf(tree).find(({ el }) => el.attrs?.class === 'input');
const eyesOf = tree => elementsOf(tree).filter(({ el }) => /^input-eye(On|Off)$/.test(el.attrs?.class ?? ''));

/** Play after a press: the same attribute flip applyPress writes on the root. */
const pressed = (tree, on) => { const { el } = rootOf(tree); if (on) el.attrs['data-revealed'] = ''; else delete el.attrs['data-revealed']; };

for (const [label, revealed] of [['hidden', false], ['revealed', true]]) {
    test(`Play, ${label}: exactly one eye is displayed, inside the eye box, with the slot class`, () => {
        const tree = playTree();
        pressed(tree, revealed);
        const shown = eyesOf(tree).filter(({ el, chain }) => displayed(el, chain));
        assert.equal(shown.length, 1, 'one displayed eye');
        const { el, chain } = shown[0];
        assert.equal(el.attrs.class, revealed ? 'input-eyeOn' : 'input-eyeOff');
        assert.equal(chain.at(-2).attrs.class, 'input-eyeBox', 'its parent is the eye box');
        const decls = computed(css, chain);
        // The same size and colour as the other eye: both read the slot's icon-size and glyph tokens.
        const other = eyesOf(tree).find(e => e.el !== el);
        const otherDecls = computed(css, other.chain);
        assert.match(decls.width, /^\d+px$/);
        for (const key of ['width', 'height', 'color']) assert.equal(decls[key], otherDecls[key], key);
    });
}

test('Play: the swapped-in eye is a positioned wrapper holding its vector (an absolute svg finds the wrapper, not the root)', () => {
    const tree = playTree();
    const eyeOn = eyesOf(tree).find(({ el }) => el.attrs.class === 'input-eyeOn').el;
    assert.equal(eyeOn.style.position, 'relative', 'the wrapper is the containing block');
    assert.equal(eyeOn.html, undefined, 'the wrapper holds no markup of its own');
    assert.equal(eyeOn.style.display, 'flex', 'an auto layout icon keeps its flow');
    assert.equal(eyeOn.children.length, 1);
    assert.match(eyeOn.children[0].html, /^<svg /);
});

test('Play: the eyes follow the picker choices', () => {
    const tree = playTree({ eyeOnIcon: 'c-on2' });
    const eyeOn = eyesOf(tree).find(({ el }) => el.attrs.class === 'input-eyeOn').el;
    assert.match(eyeOn.children[0].html, /^<svg width="12" height="12"/, 'the picked component is drawn');
});

test('Play: both eyes share the hover rule and the disabled behaviour', () => {
    for (const cls of ['input-eyeOn', 'input-eyeOff']) assert.ok(css.includes(`.input:not(:has(:disabled)) .${cls}:hover`), `${cls} hovers`);
});

test('the export: one eye per state, each in the eye box, with the slot class', () => {
    assert.match(jsx, /<div className="input-eyeBox" onClick=[^\n]*>\n\s*\{eyeShown && !revealed && <span className="input-eyeOff">\{eyeOffIcon\}<\/span>\}\n\s*\{eyeShown && revealed && <span className="input-eyeOn">\{eyeOnIcon\}<\/span>\}\n\s*<\/div>/, 'both eyes are children of the box, gated by the local state');
});

test('the export: a stylesheet hides the off-state eye of the same attribute, and nothing re-shows a displayed one', () => {
    assert.ok(css.includes('.input:not([data-revealed]) .input-eyeOn {\n  display: none !important;\n}'));
    assert.ok(css.includes('.input[data-revealed] .input-eyeOff {\n  display: none !important;\n}'));
    assert.ok(!/display: initial/.test(css), 'no rule resets display to initial');
});
