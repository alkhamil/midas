import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planBindTokens } from '../src/behavior-engine/bind-tokens.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';

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
