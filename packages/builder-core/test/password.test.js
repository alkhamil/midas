// Password: the Input with its text masked and an eye at the end. The eye is a built-in glyph (eye / eyeOff), one managed layer made while visibilityToggle is on and
// removed when it is off; a click in Play flips passwordVisible, which is the input's type and the glyph that shows. Canvas, Play and the export draw one thing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { INPUT } from '../src/templates/input.js';
import { planAnatomy } from '../src/behavior-engine/anatomy.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { planManagedTextBindings, applyBindTokens } from '../src/behavior-engine/bind-tokens.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const password = TEMPLATES.get('password');
const model = modelFor(password);
// The sample placeholder is what a generated master and demo instance start with, so it is the base layer.
const names = props => instanceFor(model, { placeholder: 'Input password', ...props }).slice(1).map(n => n.name);
const exported = () => generateComponent(password, model.binding, model.variables, 'Password', model.frame, id => model.created.filter(n => n.parentId === id));
const playRoot = props => {
    const nodes = instanceFor(model, props);
    return toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, ...nodes] }], variables: model.variables }, nodes[0].id);
};
const find = (el, pred) => pred(el) ? el : (el.children ?? []).map(c => find(c, pred)).find(Boolean);

test('Password is a registered form control built on the Input: same sizes, variants, statuses, managed text; no clear icon and no counter', () => {
    assert.ok(password);
    assert.equal(password.isControl, true);
    assert.deepEqual(validateTemplateSchema(password), []);
    for (const prop of ['variant', 'status', 'size', 'value', 'placeholder', 'hasPrefix', 'prefixKind', 'prefixText', 'prefixIcon', 'hasSuffix', 'suffixText', 'suffixIcon', 'disabled', 'readOnly', 'maxLength']) assert.deepEqual(password.props[prop], INPUT.props[prop], prop);
    for (const prop of ['allowClear', 'clearIcon', 'showCount']) assert.ok(!(prop in password.props), `${prop} is out of scope`);
    assert.ok(!password.anatomy.some(s => s.id === 'clear' || s.id === 'count'));
    assert.equal(password.primarySlot, 'value');
    assert.deepEqual(password.sampleProps, { placeholder: 'Input password' });
});

test('visibilityToggle is on by default; passwordVisible only matters while it is on', () => {
    assert.equal(password.props.visibilityToggle.default, true);
    assert.equal(password.props.passwordVisible.default, false);
    assert.deepEqual(password.props.passwordVisible.visibleIf, { prop: 'visibilityToggle', is: true });
});

test('the master is the root and the placeholder only; the eye is a layer of an instance', () => {
    assert.deepEqual(model.created.map(n => n.name), ['placeholder']);
});

test('a fresh instance holds the placeholder and the closed eye; visible shows the open eye; no toggle leaves neither; each is one layer, never hidden', () => {
    assert.deepEqual(names({}), ['placeholder', 'eyeOff']);
    assert.deepEqual(names({ passwordVisible: true }), ['placeholder', 'eye']);
    assert.deepEqual(names({ visibilityToggle: false }), ['placeholder']);
    assert.deepEqual(names({ visibilityToggle: false, passwordVisible: true }), ['placeholder'], 'the visible state is hidden by the toggle');
    for (const props of [{}, { passwordVisible: true }]) assert.ok(instanceFor(model, props).every(n => n.visible !== false && n.opacity !== 0));
});

test('the eye is removed when the toggle goes off and made again when it comes back, in the same place, after the suffix', () => {
    const layers = instanceFor(model, { placeholder: 'Input password', hasSuffix: true, suffixText: 'kg' }).slice(1).map(n => ({ id: n.id, slot: n.behavior?.slot ?? null, name: n.name }));
    assert.deepEqual(layers.map(l => l.name), ['placeholder', 'suffixText', 'eyeOff']);
    const off = planAnatomy(password, resolveProps(password, { placeholder: 'Input password', hasSuffix: true, suffixText: 'kg', visibilityToggle: false }), layers);
    assert.deepEqual(off, [{ op: 'remove', id: layers[2].id }]);
    assert.deepEqual(planAnatomy(password, resolveProps(password, { placeholder: 'Input password', hasSuffix: true, suffixText: 'kg' }), layers), [], 'the plan converges');
    const swapped = planAnatomy(password, resolveProps(password, { placeholder: 'Input password', hasSuffix: true, suffixText: 'kg', passwordVisible: true }), layers);
    assert.deepEqual(swapped.map(o => o.op).sort(), ['insert', 'remove'], 'one glyph replaces the other');
});

test('the canvas value is bullets while the password is hidden, and the typed text stays in the prop', () => {
    const value = props => instanceFor(model, props).find(n => n.name === 'value').text;
    assert.equal(value({ value: 'secret' }), '••••••');
    assert.equal(value({ value: 'secret', passwordVisible: true }), 'secret');
});

test('the eye is bound to the toggle colour and the icon size', () => {
    const layers = instanceFor(model, {}).filter(n => n.behavior?.slot === 'eyeOff').map(node => ({ key: 'eyeOff', node }));
    const { ops, problems } = planManagedTextBindings({ template: password, binding: model.binding, props: resolveProps(password, {}), layers, variables: model.variables });
    assert.deepEqual(problems, []);
    applyBindTokens(layers, ops);
    assert.ok(layers[0].node.vars['fills.0'], 'colour bound');
    assert.ok(layers[0].node.vars.w && layers[0].node.vars.h, 'size bound');
});

test('disabled recolours the eye with its disabled token', () => {
    assert.equal(password.persistentStates.disabled.tokens['toggle-fg'], 'toggle-fg-disabled');
    assert.equal(password.tokenRoles['toggle-fg-disabled'], 'fg-disabled');
});

test('Play: the input is a password field until passwordVisible, the glyphs say what a click does, the root marks where to find it', () => {
    const hidden = playRoot({ value: 'abc' });
    assert.deepEqual(hidden.problems, []);
    const input = find(hidden.root, e => e.tag === 'input');
    assert.equal(input.attrs.type, 'password');
    assert.equal(input.attrs['data-mask-unless'], 'data-password-visible');
    assert.ok('data-press-root' in hidden.root.attrs);
    const eyeOff = find(hidden.root, e => e.attrs?.class === 'password-eyeOff');
    assert.equal(eyeOff.attrs['data-press'], 'toggle');
    assert.equal(eyeOff.attrs['data-press-attr'], 'data-password-visible');
    const shown = playRoot({ value: 'abc', passwordVisible: true });
    assert.equal(find(shown.root, e => e.tag === 'input').attrs.type, 'text');
    assert.equal(shown.root.attrs['data-password-visible'], true);
});

test('Play: a disabled password has a disabled input, so a press does nothing', () => {
    assert.equal(find(playRoot({ disabled: true, value: 'x' }).root, e => e.tag === 'input').attrs.disabled, true);
});

test('the export writes the type from the prop, both glyphs, and shows one by the root attributes', () => {
    const out = exported();
    assert.deepEqual(out.problems, []);
    const jsx = out.files['Password.jsx'], css = out.files['Password.css'];
    assert.match(jsx, /type=\{passwordVisible \? "text" : "password"\}/);
    assert.match(jsx, /data-password-visible=\{passwordVisible \|\| undefined\}/);
    assert.match(jsx, /className="password-eye"/);
    assert.match(jsx, /className="password-eyeOff"/);
    assert.match(css, /\.password:not\(\[data-visibility-toggle\]\) \.password-eye,/);
    assert.match(css, /\.password:not\(\[data-password-visible\]\) \.password-eye \{/);
    assert.match(css, /\.password\[data-password-visible\] \.password-eyeOff \{/);
    assert.match(css, /\.password-eye(Off)? \{[^}]*cursor: pointer/);
});
