import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseDocument } from '../src/behavior-engine/diagnostics.js';

const num = (id, name, collectionId, values) => ({ id, name, type: 'number', collectionId, values });
const col = (id, name, collectionId, values) => ({ id, name, type: 'color', collectionId, values });
const sizeColl = { id: 'c-size', name: 'Size', modes: [{ id: 'sm', name: 'Small' }, { id: 'lg', name: 'Large' }] };
const variantColl = { id: 'c-variant', name: 'Variant', modes: [{ id: 'primary', name: 'Primary' }, { id: 'danger', name: 'Danger' }] };
const sizeItems = () => [
    num('i-fs', 'button/fontSize', 'c-size', { sm: 14, lg: 18 }),
    num('i-lh', 'button/lineHeight', 'c-size', { sm: 20, lg: 27 }),
    num('i-px', 'button/paddingX', 'c-size', { sm: 12, lg: 16 }),
    num('i-py', 'button/paddingY', 'c-size', { sm: 6, lg: 8 }),
    num('i-gap', 'button/gap', 'c-size', { sm: 6, lg: 8 }),
    num('i-radius', 'button/radius', 'c-size', { sm: 6, lg: 8 }),
    num('i-icon', 'button/iconSize', 'c-size', { sm: 14, lg: 16 }),
];
const variantItems = () => [
    col('i-bg', 'button/bg', 'c-variant', { primary: '#4338ca', danger: '#dc2626' }),
    col('i-bg-hover', 'button/bg-hover', 'c-variant', { primary: '#3730a3', danger: '#b91c1c' }),
    col('i-bg-active', 'button/bg-active', 'c-variant', { primary: '#312e81', danger: '#991b1b' }),
    col('i-bg-disabled', 'button/bg-disabled', 'c-variant', { primary: '#a5b4fc', danger: '#fca5a5' }),
    col('i-fg', 'button/fg', 'c-variant', { primary: '#ffffff', danger: '#ffffff' }),
    col('i-fg-disabled', 'button/fg-disabled', 'c-variant', { primary: '#e0e7ff', danger: '#fee2e2' }),
    col('i-border', 'button/border', 'c-variant', { primary: '#4338ca', danger: '#dc2626' }),
    col('i-border-focus', 'button/border-focus', 'c-variant', { primary: '#818cf8', danger: '#f87171' }),
];

/**
 * A document with one bound Button master (root and label bound to every token), its instance and the instance's label. Instance layers
 * carry the bindings sync copies from the master.
 * `over` replaces parts: `variables`, `binding`, `props`, `instance` (fields of the instance root), `label` (fields of the instance label).
 */
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
                behavior: { version: 2, templateId: 'button', variables: { variant: 'c-variant', size: 'c-size' }, ...over.binding },
                vars: { fill: 'i-bg', stroke: 'i-border', radius: 'i-radius', padH: 'i-px', padV: 'i-py', gap: 'i-gap' },
            },
            { id: 'mt', name: 'Label', type: 'text', parentId: 'm1', vars: { fill: 'i-fg', fontSize: 'i-fs', lineHeight: 'i-lh' } },
            {
                id: 'i1', name: 'Button', type: 'frame', isInstance: true, sourceId: 'm1', parentId: null,
                behavior: { version: 2, props: { ...over.props } }, vars: { fill: 'i-bg' }, ...over.instance,
            },
            { id: 'il', name: 'Label', type: 'text', parentId: 'i1', sourceId: 'mt', vars: { fill: 'i-fg' }, ...over.label },
        ],
        ...over.page,
    }],
});

test('a complete document has no diagnostics', () => {
    assert.deepEqual(diagnoseDocument(doc()), []);
});

test('a collection that no component binds is a warning, named', () => {
    const d = doc({ variables: { collections: [sizeColl, variantColl, { id: 'c-x', name: 'Brand', modes: [] }] } });
    assert.deepEqual(diagnoseDocument(d), [{ severity: 'warning', code: 'unused-collection', collection: 'Brand', message: 'Unused collection "Brand": excluded from preview and code generation.' }]);
});

test('a variable with no value in one mode is an error on the master, naming the variable and the mode', () => {
    const items = variantItems().map(i => (i.name === 'button/bg-hover' ? { ...i, values: { primary: '#3730a3' } } : i));
    const found = diagnoseDocument(doc({ variables: { items: [...sizeItems(), ...items] } }));
    assert.deepEqual(found.filter(f => f.severity === 'error'), [{
        severity: 'error', code: 'variable-missing-in-mode', node: 'Button', nodeId: 'm1', variable: 'button/bg-hover', mode: 'Danger',
        message: 'Button: variable "button/bg-hover" has no value in mode "Danger" of "Variant".',
    }]);
});

test('a variable missing from its collection is an error on the master, naming the variable and the collection', () => {
    const items = variantItems().filter(i => i.name !== 'button/bg-hover');
    const found = diagnoseDocument(doc({ variables: { items: [...sizeItems(), ...items] } }));
    assert.deepEqual(found.filter(f => f.severity === 'error'), [{
        severity: 'error', code: 'variable-missing', node: 'Button', nodeId: 'm1', variable: 'button/bg-hover', collection: 'Variant',
        message: 'Button: variable "button/bg-hover" is missing from collection "Variant".',
    }]);
});

test('an instance with a token it cannot resolve is an error, with the reason', () => {
    const d = doc({ variables: { collections: [{ ...sizeColl, modes: [] }, variantColl] } });
    const found = diagnoseDocument(d);
    const fontSize = found.find(f => f.token === 'fontSize');
    assert.equal(fontSize.severity, 'error');
    assert.equal(fontSize.code, 'token-unresolved');
    assert.equal(fontSize.reason, 'no-mode-selected');
    assert.equal(fontSize.nodeId, 'i1');
});

test('an instance resolves its modes from its own Appearance modes, not from props', () => {
    const items = sizeItems().map(i => (i.name === 'button/fontSize' ? { ...i, values: { sm: 14 } } : i));
    const d = doc({ variables: { items: [...items, ...variantItems()] }, instance: { varModes: { 'c-size': 'lg' } } });
    const found = diagnoseDocument(d);
    assert.deepEqual(found.map(f => f.code), ['variable-missing-in-mode'], 'the missing Large value is reported once, on the master');
    assert.equal(found[0].mode, 'Large');
});

test('an unbound variable dimension on the master is reported for its instances', () => {
    const found = diagnoseDocument(doc({ binding: { variables: { variant: 'c-variant', size: null } } }));
    assert.ok(found.some(f => f.code === 'token-unresolved' && f.reason === 'dimension-unbound' && f.nodeId === 'i1'));
});

test('a layer the user rebound by hand while disabled is a warning, and the rebinding is kept', () => {
    const found = diagnoseDocument(doc({ props: { disabled: true }, instance: { vars: { fill: 'i-fg' } } }));
    assert.deepEqual(found.filter(f => f.severity === 'warning' && f.code === 'rebound-by-hand'), [{
        severity: 'warning', code: 'rebound-by-hand', node: 'Button', nodeId: 'i1', layer: 'root', prop: 'fill', state: 'disabled',
        message: 'Button: root fill was set by hand, so state "disabled" does not change it.',
    }]);
});

test('a layer bound to the disabled variable while disabled is not reported', () => {
    const found = diagnoseDocument(doc({ props: { disabled: true }, instance: { vars: { fill: 'i-bg-disabled' } }, label: { vars: { fill: 'i-fg-disabled' } } }));
    assert.deepEqual(found, []);
});

test('a master token that is not bound is a warning, naming the layer, the property and the token', () => {
    const d = doc();
    d.pages[0].nodes[0].vars = { stroke: 'i-border', radius: 'i-radius', padH: 'i-px', padV: 'i-py', gap: 'i-gap' };
    const found = diagnoseDocument(d);
    assert.deepEqual(found.filter(f => f.code === 'unbound-token'), [{
        severity: 'warning', code: 'unbound-token', node: 'Button', nodeId: 'm1', layer: 'root', prop: 'fill', token: 'bg',
        message: 'Button: root fill is not bound to "button/bg".',
    }]);
});

test('loading is an info note: stored and generated, not drawn', () => {
    const found = diagnoseDocument(doc({ props: { loading: true } }));
    assert.deepEqual(found, [{ severity: 'info', code: 'loading-not-drawn', node: 'Button', nodeId: 'i1', message: 'Button: loading is stored and generated, but has no visual yet.' }]);
});

test('the same document gives the same diagnostics, in the same order', () => {
    const d = doc({ props: { disabled: true }, instance: { vars: { fill: 'i-fg' } } });
    assert.deepEqual(diagnoseDocument(d), diagnoseDocument(d));
});

