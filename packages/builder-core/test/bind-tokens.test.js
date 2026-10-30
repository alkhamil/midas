import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planBindTokens, applyBindTokens } from '../src/behavior-engine/bind-tokens.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { masterLayersOf } from '../src/behavior-engine/layers.js';
import { varsWithBinding, varModesWith } from '../src/behavior-engine/edits.js';
import { setVariableBinding } from '../src/behavior-engine/binding.js';
import { setInstanceProp } from '../src/behavior-engine/instance-props.js';
import { iconSlotBindings, iconSlotTargets } from '../src/behavior-engine/icon-slot.js';
import { variableIdNamed } from '../src/behavior-engine/tokens.js';

const button = TEMPLATES.get('button');
const variant = { id: 'c-variant', name: 'Variant', modes: [{ id: 'primary' }] };
const size = { id: 'c-size', name: 'Size', modes: [{ id: 'sm' }] };
const item = (id, name, collectionId) => ({ id, name, collectionId, values: {} });
const items = [
    item('i-bg', 'button/bg', 'c-variant'), item('i-border', 'button/border', 'c-variant'), item('i-fg', 'button/fg', 'c-variant'),
    item('i-radius', 'button/radius', 'c-size'), item('i-px', 'button/paddingX', 'c-size'), item('i-py', 'button/paddingY', 'c-size'),
    item('i-gap', 'button/gap', 'c-size'), item('i-fs', 'button/fontSize', 'c-size'), item('i-lh', 'button/lineHeight', 'c-size'),
    item('i-icon', 'button/iconSize', 'c-size'), item('i-height', 'button/height', 'c-size'), item('i-card', 'card/bg', 'c-variant'),
];
const binding = { version: 2, templateId: 'button', variables: { variant: 'c-variant', size: 'c-size' } };
const variables = (over = items) => ({ collections: [variant, size], items: over });
const layers = (root = {}, label = {}) => [
    { key: 'root', node: { id: 'm', vars: root } },
    { key: 'label', node: { id: 'ml', vars: label } },
];

test('an unbound master binds every mapped property to its group variable', () => {
    const { ops, problems } = planBindTokens({ template: button, binding, layers: layers(), variables: variables() });
    assert.deepEqual(problems, []);
    assert.deepEqual(ops.filter(o => o.key === 'root').map(o => [o.varKey, o.itemId]), [
        ['fills.0', 'i-bg'], ['stroke', 'i-border'], ['radius', 'i-radius'], ['padH', 'i-px'], ['padV', 'i-py'], ['gap', 'i-gap'],
    ]);
    assert.deepEqual(ops.filter(o => o.key === 'label').map(o => [o.varKey, o.itemId]), [['fills.0', 'i-fg'], ['fontSize', 'i-fs'], ['lineHeight', 'i-lh']]);
});

test('a binding that already exists is never overwritten', () => {
    const { ops } = planBindTokens({ template: button, binding, layers: layers({ 'fills.0': 'i-card' }), variables: variables() });
    assert.equal(ops.some(o => o.key === 'root' && o.varKey === 'fills.0'), false);
    assert.equal(ops.some(o => o.key === 'root' && o.varKey === 'stroke' && o.itemId === 'i-border'), true);
});

test('a fully bound master gives no operations (idempotent)', () => {
    const root = { 'fills.0': 'i-bg', stroke: 'i-border', radius: 'i-radius', padH: 'i-px', padV: 'i-py', gap: 'i-gap' };
    const label = { 'fills.0': 'i-fg', fontSize: 'i-fs', lineHeight: 'i-lh' };
    assert.deepEqual(planBindTokens({ template: button, binding, layers: layers(root, label), variables: variables() }).ops, []);
});

test('a token with no variable in its group is a problem, not a guess', () => {
    const { ops, problems } = planBindTokens({ template: button, binding, layers: layers(), variables: variables(items.filter(i => i.name !== 'button/bg')) });
    assert.deepEqual(problems, [{ key: 'root', prop: 'fill', token: 'bg', reason: 'no-variable' }]);
    assert.equal(ops.some(o => o.varKey === 'fills.0' && o.key === 'root'), false);
});

test('a card variable is never bound to a Button property', () => {
    const { ops } = planBindTokens({ template: button, binding, layers: layers(), variables: variables(items.filter(i => i.name !== 'button/bg')) });
    assert.equal(ops.some(o => o.itemId === 'i-card'), false);
});

test('a dimension with no bound collection is a problem for its tokens', () => {
    const unbound = { ...binding, variables: { variant: null, size: 'c-size' } };
    const { problems } = planBindTokens({ template: button, binding: unbound, layers: layers(), variables: variables() });
    assert.ok(problems.some(p => p.token === 'bg' && p.reason === 'dimension-unbound'));
});

test('a binding to a variable that no longer exists is rebound, not kept', () => {
    const layers = [{ key: 'root', node: { vars: { 'fills.0': 'gone' } } }, { key: 'label', node: { vars: { 'fills.0': 'gone' } } }];
    const { ops, problems } = planBindTokens({ template: button, binding, layers, variables: variables() });
    assert.deepEqual(problems, []);
    assert.ok(ops.some(o => o.key === 'root' && o.varKey === 'fills.0' && o.itemId === 'i-bg'));
    assert.ok(ops.some(o => o.key === 'label' && o.varKey === 'fills.0' && o.itemId === 'i-fg'));
});

test('with the real Button fixture: after selecting modes, root fill, stroke and label color carry variable bindings', () => {
    const path = new URL('../../../scripts/fixtures/button-example.midas', import.meta.url);
    const doc = JSON.parse(readFileSync(path, 'utf8'));
    const all = doc.pages.flatMap(p => p.nodes);
    const master = all.find(n => n.name === 'Button');
    for (const n of all) delete n.vars;
    master.behavior.variables = { variant: 'c-variant', color: 'c-color', size: 'c-size' };
    const inst = all.find(n => n.isInstance);
    inst.varModes = { 'c-variant': 'solid', 'c-color': 'primary', 'c-size': 'lg' };
    const layers = masterLayersOf(master, id => all.filter(n => n.parentId === id));
    const { ops, problems } = planBindTokens({ template: button, binding: master.behavior, layers, variables: doc.variables });
    assert.deepEqual(problems, []);
    const ids = new Set(doc.variables.items.map(i => i.id));
    const byKey = Object.fromEntries(ops.map(o => [`${o.key}.${o.varKey}`, o.itemId]));
    assert.ok(ids.has(byKey['root.fills.0']), 'root fill is bound');
    assert.ok(ids.has(byKey['root.stroke']), 'root stroke is bound');
    assert.ok(ids.has(byKey['label.fills.0']), 'label color is bound');
    const root = { vars: undefined };
    for (const op of ops.filter(o => o.key === 'root')) root.vars = varsWithBinding(root.vars, op.varKey, op.itemId);
    assert.equal(ids.has(root.vars['fills.0']) && ids.has(root.vars.stroke), true);
});

test('auto-bind flow on the real fixture: collections, modes and hasIcon bind without the manual action', () => {
    const path = new URL('../../../scripts/fixtures/button-example.midas', import.meta.url);
    const doc = JSON.parse(readFileSync(path, 'utf8'));
    const all = doc.pages.flatMap(p => p.nodes);
    const master = all.find(n => n.name === 'Button');
    // A fresh import carries no variable bindings.
    for (const n of all) delete n.vars;
    // Bind collections, as the Behavior tab's Collection section does.
    let binding = { version: 2, templateId: 'button', variables: { variant: null, color: null, size: null } };
    for (const [prop, id] of [['variant', 'c-variant'], ['color', 'c-color'], ['size', 'c-size']])
        binding = setVariableBinding(binding, button, prop, id, doc.variables.collections);
    // Pick modes, as the Variant/Color/Size controls do.
    let modes;
    for (const [collection, mode] of [['c-variant', 'solid'], ['c-color', 'primary'], ['c-size', 'lg']])
        modes = varModesWith(modes, collection, mode);
    assert.deepEqual(modes, { 'c-variant': 'solid', 'c-color': 'primary', 'c-size': 'lg' });
    // Turn the icon on, as the hasIcon control does.
    const inst = all.find(n => n.isInstance);
    const props = setInstanceProp(button, setInstanceProp(button, inst.behavior?.props ?? {}, 'hasIcon', true), 'iconPlacement', 'start');
    assert.equal(props.hasIcon, true);
    // The token plan covers the master's root and label with no manual bind step.
    const layers = masterLayersOf(master, id => all.filter(n => n.parentId === id));
    const { ops, problems } = planBindTokens({ template: button, binding, layers, variables: doc.variables });
    assert.deepEqual(problems, []);
    const ids = new Set(doc.variables.items.map(i => i.id));
    const byKey = Object.fromEntries(ops.map(o => [`${o.key}.${o.varKey}`, o.itemId]));
    for (const key of ['root.fills.0', 'root.stroke', 'root.radius', 'root.padH', 'root.padV', 'root.gap', 'label.fills.0', 'label.fontSize', 'label.lineHeight'])
        assert.ok(ids.has(byKey[key]), `${key} is bound`);
    // The icon slot resolves its colour and size in the bound collections and binds them.
    const targets = iconSlotTargets(button, 'iconStart');
    const fg = variableIdNamed(doc.variables.items, binding.variables[targets.colour.dimension], targets.colour.name);
    const fgDisabled = variableIdNamed(doc.variables.items, binding.variables[targets.disabledColour.dimension], targets.disabledColour.name);
    const size = variableIdNamed(doc.variables.items, binding.variables[targets.size.dimension], targets.size.name);
    assert.equal(fg, 'v-fg');
    assert.equal(fgDisabled, 'v-fg-disabled');
    assert.equal(size, 's-iconSize');
    const plan = iconSlotBindings({ fg, fgDisabled, size, disabled: false, names: { colour: 'button/fg', disabledColour: 'button/fg-disabled', size: 'button/icon-size' }, layers: [{ id: 'slot', fillIndexes: [0], stroke: false }] });
    assert.deepEqual(plan.missing, []);
    assert.deepEqual(plan.slot, { w: 's-iconSize', h: 's-iconSize' });
    assert.deepEqual(plan.layers, [{ id: 'slot', vars: { 'fills.0': 'v-fg' } }]);
});

test('a bound stroke carries opacity 100: applying the bind repairs a zero-opacity paint, and a transparent variable stays transparent', () => {
    const path = new URL('../../../scripts/fixtures/button-example.midas', import.meta.url);
    const doc = JSON.parse(readFileSync(path, 'utf8'));
    const all = doc.pages.flatMap(p => p.nodes);
    const master = all.find(n => n.name === 'Button');
    const layers = masterLayersOf(master, id => all.filter(n => n.parentId === id));
    const root = layers.find(l => l.key === 'root').node;
    // A zero-opacity stroke paint, as the importer writes for a zero-opacity paint, or stale data carries.
    delete root.vars.stroke;
    root.strokeWidth = 1;
    root.strokeOpacity = 0;
    const { ops, problems } = planBindTokens({ template: button, binding: master.behavior, layers, variables: doc.variables });
    assert.deepEqual(problems, []);
    assert.ok(ops.some(o => o.key === 'root' && o.varKey === 'stroke'));
    const touched = applyBindTokens(layers, ops);
    assert.ok(touched.includes(root));
    assert.equal(root.vars.stroke, doc.variables.items.find(i => i.name === 'button/border').id);
    assert.equal(root.strokeWidth, 1);
    assert.equal(root.strokeOpacity, 1);
    // A set opacity is never repaired away.
    root.strokeOpacity = 0.5;
    applyBindTokens(layers, ops.filter(o => o.varKey === 'stroke'));
    assert.equal(root.strokeOpacity, 0.5);
    // button/border resolves transparent in solid and opaque in outlined: with opacity 100 the swatch and the canvas
    // show the resolved colour, and the solid mode stays transparent because the variable says so.
    const items = doc.variables.items;
    const border = items.find(i => i.name === 'button/border');
    assert.equal(border.values.solid, '#00000000');
    const follow = value => typeof value === 'object' && value !== null && value.alias ? follow(items.find(i => i.id === value.alias).values.default) : value;
    assert.match(follow(border.values.outlined), /^#[0-9a-f]{6}$/i);
});
