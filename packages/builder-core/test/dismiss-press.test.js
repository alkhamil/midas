// The dismiss press action: a click on a slot (a frame container) dismisses the element. In Play the root takes an exit (a fade and scale of antd's mid
// duration, 0.2s) and is hidden when the exit ends (at once under prefers-reduced-motion); in the export a click calls `onClose` and hides the element
// through local state, with no motion. The canvas is static: a dismiss writes no node field. A disabled element never dismisses. Synthetic schemas only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { pressAttrsOf } from '../src/behavior-engine/display.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { applyPress } from '../src/prototype/press.js';
import { modelFor, instanceFor, BOXY } from './helpers/box-template.js';

/** BOXY whose box dismisses the element on a click, and has an exit motion. */
const DISMISSY = (() => {
    const t = structuredClone(BOXY);
    t.id = 'dismissy';
    t.name = 'Dismissy';
    t.press = [{ slot: 'box', dismiss: true }];
    t.events = [{ name: 'onClick', exposeAsTrigger: true }];
    t.motion = { exit: { duration: '0.2s', timing: 'ease', to: { opacity: '0', transform: 'scale(0.8)' } } };
    return t;
})();

test('the schema accepts a dismiss press, and refuses one that also names another action', () => {
    assert.deepEqual(validateTemplateSchema(DISMISSY), []);
    const bad = structuredClone(DISMISSY);
    bad.press = [{ slot: 'closer', dismiss: true, toggle: 'closable' }];
    assert.ok(validateTemplateSchema(bad).some(p => /press/.test(p)), 'one action only');
});

test('a dismiss press says its action as the press attribute Play reads', () => {
    assert.deepEqual(pressAttrsOf(DISMISSY, 'box'), { 'data-press': 'dismiss' });
});

test('the export holds a local dismissed state, hides the element while it holds, and its click calls onClose', () => {
    const model = modelFor(DISMISSY);
    const out = generateComponent(model.template, model.binding, model.variables, 'Dismissy', model.frame, id => model.created.filter(n => n.parentId === id));
    assert.deepEqual(out.problems, []);
    const jsx = out.files['Dismissy.jsx'];
    assert.match(jsx, /^import \{ useState \} from 'react';/m);
    assert.match(jsx, /const \[dismissed, setDismissed\] = useState\(false\);/);
    assert.match(jsx, /if \(dismissed\) return null;/);
    assert.match(jsx, /export function Dismissy\(\{[^}]*onClose[^}]*\}\)/);
    // The element is disabled by its own state (BOXY's disabled prop), so the click is guarded by it.
    assert.match(jsx, /onClick=\{\(\) => \{ if \(!\(disabled\)\) \{ setDismissed\(true\); onClose\?\.\(\); \} \}\}/);
});

test('the stylesheet exits a dismissed root with a fade and a scale of 0.2s, and hides it at once under reduced motion', () => {
    const model = modelFor(DISMISSY);
    const css = generateComponent(model.template, model.binding, model.variables, 'Dismissy', model.frame, id => model.created.filter(n => n.parentId === id)).files['Dismissy.css'];
    assert.match(css, /\.dismissy \{\s*transition: opacity 0\.2s ease, transform 0\.2s ease;\s*\}/);
    assert.match(css, /\.dismissy\[data-dismissed\] \{\s*opacity: 0;\s*transform: scale\(0\.8\);\s*\}/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.dismissy\[data-dismissed\] \{\s*display: none;\s*\}/);
});

test('Play: a click dismisses the root (the exit starts) unless it is disabled, and the canvas writes no dismiss', () => {
    const root = (attrs = {}) => ({ attrs, set: {}, hasAttribute(n) { return n in this.attrs; }, setAttribute(n, v) { this.attrs[n] = v; }, removeAttribute(n) { delete this.attrs[n]; } });
    const glyph = r => ({ getAttribute: n => (n === 'data-press' ? 'dismiss' : null), closest: sel => (sel === '[data-press-root]' ? r : null) });
    const r = root({ 'data-press-root': '' });
    assert.equal(applyPress({ closest: sel => (sel === '[data-press]' ? glyph(r) : null) }), true);
    assert.ok('data-dismissed' in r.attrs, 'the root is dismissed');
    const off = root({ 'data-press-root': '', 'aria-disabled': 'true' });
    assert.equal(applyPress({ closest: sel => (sel === '[data-press]' ? glyph(off) : null) }), false);
    assert.equal('data-dismissed' in off.attrs, false, 'a disabled element does not dismiss');
    const model = modelFor(DISMISSY);
    const nodes = instanceFor(model, {});
    assert.ok(nodes.every(n => !('dismissed' in n)), 'the canvas holds no dismiss');
});
