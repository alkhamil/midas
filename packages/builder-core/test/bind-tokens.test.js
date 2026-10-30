import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planBindTokens } from '../src/behavior-engine/bind-tokens.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { masterLayersOf } from '../src/behavior-engine/layers.js';
import { varsWithBinding } from '../src/behavior-engine/edits.js';

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
        ['fill', 'i-bg'], ['stroke', 'i-border'], ['radius', 'i-radius'], ['padH', 'i-px'], ['padV', 'i-py'], ['gap', 'i-gap'],
    ]);
    assert.deepEqual(ops.filter(o => o.key === 'label').map(o => [o.varKey, o.itemId]), [['fill', 'i-fg'], ['fontSize', 'i-fs'], ['lineHeight', 'i-lh']]);
});

test('a binding that already exists is never overwritten', () => {
    const { ops } = planBindTokens({ template: button, binding, layers: layers({ fill: 'i-card' }), variables: variables() });
    assert.equal(ops.some(o => o.key === 'root' && o.varKey === 'fill'), false);
    assert.equal(ops.some(o => o.key === 'root' && o.varKey === 'stroke' && o.itemId === 'i-border'), true);
});

test('a fully bound master gives no operations (idempotent)', () => {
    const root = { fill: 'i-bg', stroke: 'i-border', radius: 'i-radius', padH: 'i-px', padV: 'i-py', gap: 'i-gap' };
    const label = { fill: 'i-fg', fontSize: 'i-fs', lineHeight: 'i-lh' };
    assert.deepEqual(planBindTokens({ template: button, binding, layers: layers(root, label), variables: variables() }).ops, []);
});

test('a token with no variable in its group is a problem, not a guess', () => {
    const { ops, problems } = planBindTokens({ template: button, binding, layers: layers(), variables: variables(items.filter(i => i.name !== 'button/bg')) });
    assert.deepEqual(problems, [{ key: 'root', prop: 'fill', token: 'bg', reason: 'no-variable' }]);
    assert.equal(ops.some(o => o.varKey === 'fill' && o.key === 'root'), false);
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
    const layers = [{ key: 'root', node: { vars: { fill: 'gone' } } }, { key: 'label', node: { vars: { fill: 'gone' } } }];
    const { ops, problems } = planBindTokens({ template: button, binding, layers, variables: variables() });
    assert.deepEqual(problems, []);
    assert.ok(ops.some(o => o.key === 'root' && o.varKey === 'fill' && o.itemId === 'i-bg'));
    assert.ok(ops.some(o => o.key === 'label' && o.varKey === 'fill' && o.itemId === 'i-fg'));
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
    assert.ok(ids.has(byKey['root.fill']), 'root fill is bound');
    assert.ok(ids.has(byKey['root.stroke']), 'root stroke is bound');
    assert.ok(ids.has(byKey['label.fill']), 'label color is bound');
    const root = { vars: undefined };
    for (const op of ops.filter(o => o.key === 'root')) root.vars = varsWithBinding(root.vars, op.varKey, op.itemId);
    assert.equal(ids.has(root.vars.fill) && ids.has(root.vars.stroke), true);
});
