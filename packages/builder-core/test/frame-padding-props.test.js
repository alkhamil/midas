// Side-specific frame padding: an asymmetric inner (the Switch text gutters) binds its start and end separately.
// display paddingStart/paddingEnd bind padL/padR vars and emit padding-inline-start/end rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planBindTokens } from '../src/behavior-engine/bind-tokens.js';

const MINI = {
    id: 'mini',
    props: { variant: { source: 'variable', collection: 'Variant', modes: ['a'] } },
    tokens: { fromVariant: ['bg', 'padS', 'padE'] },
    tokenKinds: { bg: 'color', padS: 'length', padE: 'length' },
    tokenRoles: { bg: 'bg', padS: 'pS', padE: 'pE' },
    anatomy: [{ id: 'box', kind: 'frame' }],
    display: { box: { fill: 'bg', paddingStart: 'padS', paddingEnd: 'padE' } },
};
const binding = { version: 2, templateId: 'mini', variables: { variant: 'c' } };
const variables = () => ({
    collections: [{ id: 'c', name: 'Variant', modes: [{ id: 'm-a', name: 'a' }] }],
    items: [
        { id: 'i-bg', name: 'bg', type: 'color', collectionId: 'c', values: {} },
        { id: 'i-ps', name: 'padS', type: 'number', collectionId: 'c', values: {} },
        { id: 'i-pe', name: 'padE', type: 'number', collectionId: 'c', values: {} },
    ],
});
const layers = () => [{ key: 'box', node: { id: 'm', vars: {} } }];

test('paddingStart and paddingEnd bind padL and padR vars of their own', () => {
    const { ops, problems } = planBindTokens({ template: MINI, binding, layers: layers(), variables: variables() });
    assert.deepEqual(problems, []);
    assert.ok(ops.some(o => o.key === 'box' && o.varKey === 'padL' && o.itemId === 'i-ps'), 'paddingStart binds padL');
    assert.ok(ops.some(o => o.key === 'box' && o.varKey === 'padR' && o.itemId === 'i-pe'), 'paddingEnd binds padR');
});
