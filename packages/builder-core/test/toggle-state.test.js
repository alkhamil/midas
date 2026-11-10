// A press that flips a local (non-prop) interaction state, and an icon swap shown by that state.
// TOGGLY is BOXY whose box press reveals a second icon: the check icon shows while the box is checked
// and unrevealed, the peek icon while it is checked and revealed. The peek icon has no canvas layer:
// it lives in the eyeBox-style container only in Play and the export, drawn from its component.
// The label control is masked while checked unless revealed. Synthetic schemas only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { pressAttrsOf } from '../src/behavior-engine/display.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { applyPress } from '../src/prototype/press.js';
import { modelFor, instanceFor, BOXY } from './helpers/box-template.js';

/** BOXY whose box press flips a local revealed state that swaps the check icon for a peek icon. */
const TOGGLY = (() => {
    const t = structuredClone(BOXY);
    t.id = 'toggly';
    t.name = 'Toggly';
    t.press = [{ slot: 'box', toggleState: 'revealed' }];
    t.control = { slot: 'label', value: 'label', maskWhen: { prop: 'checked', is: true }, maskUnless: 'revealed' };
    t.props.peekIcon = { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'checked', is: true }, remembered: true };
    t.icons = [
        { show: 'checked', slot: 'check', component: 'checkIcon', label: 'Check icon', tokens: { colour: 'check-fg', disabledColour: 'glyph-fg-disabled', size: 'indicatorSize' }, swap: { by: 'revealed', is: false } },
        { show: 'checked', slot: 'peek', component: 'peekIcon', label: 'Peek icon', tokens: { colour: 'check-fg', disabledColour: 'glyph-fg-disabled', size: 'indicatorSize' }, swap: { by: 'revealed', is: true } },
    ];
    t.display.peek = { size: 'indicatorSize' };
    return t;
})();

test('the schema accepts a toggleState press, a maskUnless naming it, and swap icon defs', () => {
    assert.deepEqual(validateTemplateSchema(TOGGLY), []);
});

test('the schema refuses a toggleState that shares its press with another action or names nothing', () => {
    const both = structuredClone(TOGGLY);
    both.press = [{ slot: 'box', toggleState: 'revealed', toggle: 'checked' }];
    assert.ok(validateTemplateSchema(both).some(p => /press/.test(p)), 'one action only');
    const bad = structuredClone(TOGGLY);
    bad.press = [{ slot: 'box', toggleState: 'nope' }];
    bad.icons[1].swap = { by: 'nope', is: true };
    assert.ok(validateTemplateSchema(bad).length > 0, 'the state must exist');
    const badMask = structuredClone(TOGGLY);
    badMask.control.maskUnless = 'nope';
    assert.ok(validateTemplateSchema(badMask).some(p => /maskUnless/.test(p)), 'the mask must name a boolean prop or a toggleState');
});

test('a toggleState press says toggle with the data attribute Play flips', () => {
    assert.deepEqual(pressAttrsOf(TOGGLY, 'box'), { 'data-press': 'toggle', 'data-press-attr': 'data-revealed' });
});

test('the swap icon takes no canvas layer: checked shows the check slot alone', () => {
    const model = modelFor(TOGGLY);
    const nodes = instanceFor(model, { checked: true, checkIcon: 'c', peekIcon: 'p' });
    const slots = nodes.slice(1).map(n => n.behavior?.slot ?? n.behavior?.group);
    assert.ok(!slots.includes('peek'), 'the swap icon takes no canvas layer');
    const base = modelFor(BOXY);
    assert.deepEqual(slots, instanceFor(base, { checked: true, checkIcon: 'c' }).slice(1).map(n => n.behavior?.slot ?? n.behavior?.group),
        'the swap icon adds no layer: the canvas matches the template without it');
});

test('the export holds a local revealed state, toggles it on click, and swaps the icons by it', () => {
    const model = modelFor(TOGGLY);
    const out = generateComponent(model.template, model.binding, model.variables, 'Toggly', model.frame, id => model.created.filter(n => n.parentId === id));
    assert.deepEqual(out.problems, []);
    const jsx = out.files['Toggly.jsx'];
    assert.match(jsx, /^import \{ useState \} from 'react';/m);
    assert.match(jsx, /const \[revealed, setRevealed\] = useState\(false\);/);
    assert.match(jsx, /data-revealed=\{revealed \|\| undefined\}/);
    assert.match(jsx, /onClick=\{\(\) => \{ if \(!\(disabled\)\) setRevealed\(!revealed\); \}\}/);
    assert.match(jsx, /\{checked && !revealed && <span className="toggly-check">\{checkIcon\}<\/span>\}/);
    assert.match(jsx, /\{checked && revealed && <span className="toggly-peek">\{peekIcon\}<\/span>\}/);
    assert.match(jsx, /export function Toggly\(\{[^}]*\}\)/);
    assert.ok(!/revealed = |onRevealedChange|passwordVisible/.test(jsx.match(/export function Toggly\(\{[^}]*\}\)/)[0]), 'revealed is local: no prop, no callback');
    assert.match(jsx, /type=\{\(checked === true\) && !revealed \? "password" : undefined\}/);
});

test('the stylesheet hides the swap icon until the local state holds, and hides the plain one while it does', () => {
    const model = modelFor(TOGGLY);
    const css = generateComponent(model.template, model.binding, model.variables, 'Toggly', model.frame, id => model.created.filter(n => n.parentId === id)).files['Toggly.css'];
    assert.match(css, /\.toggly:not\(\[data-revealed\]\) \.toggly-peek \{\s*display: none !important;\s*\}/);
    assert.match(css, /\.toggly\[data-revealed\] \.toggly-check \{\s*display: none !important;\s*\}/);
    assert.ok(!/display: initial/.test(css), 'the shown side is never reset');
});

test('Play: a click flips the local attribute and retypes a masked input; the canvas holds no swap layer', () => {
    const fakeInput = () => ({ type: 'password', hasAttribute: () => false, getAttribute: n => (n === 'data-mask-unless' ? 'data-revealed' : null) });
    const root = (attrs = {}, inputs = []) => ({ attrs, hasAttribute(n) { return n in this.attrs; }, setAttribute(n, v) { this.attrs[n] = v; }, removeAttribute(n) { delete this.attrs[n]; }, querySelector: () => inputs[0] ?? null, querySelectorAll: () => inputs });
    const glyph = r => ({ getAttribute: n => (n === 'data-press' ? 'toggle' : n === 'data-press-attr' ? 'data-revealed' : null), closest: sel => (sel === '[data-press-root]' ? r : null) });
    const input = fakeInput();
    const r = root({ 'data-press-root': '' }, [input]);
    const click = () => applyPress({ closest: sel => (sel === '[data-press]' ? glyph(r) : null) });
    assert.equal(click(), true);
    assert.equal(r.attrs['data-revealed'], '', 'the local state flips on the root');
    assert.equal(input.type, 'text', 'a masked input shows its text while the state holds');
    assert.equal(click(), true);
    assert.ok(!('data-revealed' in r.attrs), 'a second click flips it back');
    assert.equal(input.type, 'password', 'and the input masks again');
});

test('Play draws a swap icon from its component in the slot colour, hidden until the state holds', () => {
    const model = modelFor(TOGGLY);
    const comp = { id: 'comp-peek', name: 'Icon/peek', type: 'frame', parentId: null, x: 0, y: 0, w: 24, h: 24, layout: 'horizontal', fills: [], layoutSizingH: 'fixed', layoutSizingV: 'fixed', component: true };
    const vec = { id: 'comp-peek-v', name: 'peek', type: 'path', parentId: 'comp-peek', x: 4, y: 4, w: 16, h: 16, pathW: 16, pathH: 16, closed: true, points: [{ x: 0, y: 0 }, { x: 16, y: 0 }, { x: 16, y: 16 }, { x: 0, y: 16 }], fills: [{ type: 'solid', color: '#20202a', opacity: 1, visible: true }], strokeWidth: 0, rotation: 0, opacity: 1, visible: true, locked: false };
    const nodes = instanceFor(model, { checked: true, checkIcon: 'c', peekIcon: 'comp-peek' });
    const top = { id: 'top', name: 'Top', type: 'frame', parentId: null, layout: 'vertical', x: 0, y: 0, w: 400, h: 400, fills: [], layoutSizingH: 'hug', layoutSizingV: 'hug' };
    const lay = n => { if (n.parentId == null && !n.component) n.parentId = 'top'; return n; };
    const { root, problems } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [top, model.frame, ...model.created, ...nodes.map(lay), comp, vec] }], variables: model.variables }, 'top');
    assert.deepEqual(problems, []);
    const find = (el, cls) => el.attrs?.class === cls ? el : (el.children || []).map(c => find(c, cls)).find(Boolean);
    const peek = find(root, 'toggly-peek');
    assert.ok(peek, 'the swap icon is drawn without a canvas layer');
    assert.equal(peek.style.position, 'relative', 'a positioned wrapper of the slot class');
    assert.match(peek.children[0].html, /fill="currentColor"/, 'in the slot colour');
    assert.match(peek.children[0].html, /viewBox="0 0 16 16"/, 'at its own box, not the 24 viewBox');
});
