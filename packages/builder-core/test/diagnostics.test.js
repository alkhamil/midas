import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseDocument } from '../src/behavior-engine/diagnostics.js';

const num = (id, name, collectionId, values) => ({ id, name, type: 'number', collectionId, values });
const col = (id, name, collectionId, values) => ({ id, name, type: 'color', collectionId, values });
const sizeColl = { id: 'c-size', name: 'Size', modes: [{ id: 'sm', name: 'Small' }] };
const variantColl = { id: 'c-variant', name: 'Variant', modes: [{ id: 'primary', name: 'Primary' }, { id: 'danger', name: 'Danger' }] };
const sizeItems = () => [
    num('i-fs', 'fontSize', 'c-size', { sm: 14 }),
    num('i-lh', 'lineHeight', 'c-size', { sm: 1.4 }),
    num('i-px', 'paddingX', 'c-size', { sm: 12 }),
    num('i-py', 'paddingY', 'c-size', { sm: 6 }),
    num('i-gap', 'gap', 'c-size', { sm: 6 }),
    num('i-radius', 'radius', 'c-size', { sm: 6 }),
    num('i-icon', 'iconSize', 'c-size', { sm: 14 }),
];
const variantItems = () => [
    col('i-bg', 'bg', 'c-variant', { primary: '#4338ca', danger: '#dc2626' }),
    col('i-bg-hover', 'bg-hover', 'c-variant', { primary: '#3730a3', danger: '#b91c1c' }),
    col('i-bg-active', 'bg-active', 'c-variant', { primary: '#312e81', danger: '#991b1b' }),
    col('i-bg-disabled', 'bg-disabled', 'c-variant', { primary: '#a5b4fc', danger: '#fca5a5' }),
    col('i-fg', 'fg', 'c-variant', { primary: '#ffffff', danger: '#ffffff' }),
    col('i-border', 'border', 'c-variant', { primary: '#4338ca', danger: '#dc2626' }),
];

/** A document with one bound Button master and one instance; `over` replaces parts of it. */
const doc = (over = {}) => ({
    variables: {
        collections: [sizeColl, variantColl],
        items: [...sizeItems(), ...variantItems()],
        ...over.variables,
    },
    pages: [{
        nodes: [
            {
                id: 'm1', name: 'Button', type: 'frame',
                behavior: { version: 1, templateId: 'button', variables: { variant: 'c-variant', size: 'c-size' }, ...over.binding },
            },
            {
                id: 'i1', name: 'Button', type: 'frame', isInstance: true, sourceId: 'm1', parentId: null,
                behavior: { version: 1, props: { variant: 'primary', size: 'sm', ...over.props } },
            },
        ],
    }],
});

test('a complete document has no diagnostics', () => {
    assert.deepEqual(diagnoseDocument(doc()), []);
});

test('a collection that no component binds is a warning, named', () => {
    const d = doc({ variables: { collections: [sizeColl, variantColl, { id: 'c-x', name: 'Brand', modes: [] }], items: [...sizeItems(), ...variantItems()] } });
    const found = diagnoseDocument(d);
    assert.deepEqual(found, [{ severity: 'warning', code: 'unused-collection', collection: 'Brand', message: 'Unused collection "Brand": excluded from preview and code generation.' }]);
});

test('a state token missing for one mode is an error on the master, naming the token and the mode', () => {
    const items = variantItems().filter(i => !(i.name === 'bg-hover'));
    items.push(col('i-bg-hover-p', 'bg-hover', 'c-variant', { primary: '#3730a3' }));
    const found = diagnoseDocument(doc({ variables: { items: [...sizeItems(), ...items] } }));
    assert.deepEqual(found.filter(f => f.code === 'state-token-missing'), [{
        severity: 'error', code: 'state-token-missing', node: 'Button', nodeId: 'm1', state: 'hover', token: 'bg-hover', mode: 'Danger', reason: 'no-value-in-mode',
        message: 'Button: state "hover" needs token "bg-hover" in mode "Danger" (no-value-in-mode).',
    }]);
});

test('an instance with a token it cannot resolve is an error, with the reason', () => {
    const found = diagnoseDocument(doc({ props: { size: null } }));
    const fontSize = found.find(f => f.token === 'fontSize');
    assert.equal(fontSize.severity, 'error');
    assert.equal(fontSize.code, 'token-unresolved');
    assert.equal(fontSize.reason, 'no-mode-selected');
    assert.equal(fontSize.nodeId, 'i1');
});

test('an unbound variable dimension on the master is reported for its instances', () => {
    const found = diagnoseDocument(doc({ binding: { variables: { variant: 'c-variant', size: null } } }));
    assert.ok(found.some(f => f.code === 'token-unresolved' && f.reason === 'dimension-unbound' && f.nodeId === 'i1'));
});

test('the same document gives the same diagnostics, in the same order', () => {
    const d = doc({ props: { size: null } });
    assert.deepEqual(diagnoseDocument(d), diagnoseDocument(d));
});
