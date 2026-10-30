import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseDocument } from '../src/behavior-engine/diagnostics.js';
import { buttonModel } from '../../../scripts/button-model.mjs';

const model = buttonModel({
    colors: ['primary', 'danger'],
    variantModes: ['solid', 'outlined'],
    sizeModes: [{ id: 'sm', name: 'Small' }, { id: 'lg', name: 'Large' }],
    sizeValues: {
        fontSize: { sm: 14, lg: 18 }, lineHeight: { sm: 1.5, lg: 1.5 }, paddingX: { sm: 12, lg: 16 }, paddingY: { sm: 6, lg: 8 },
        gap: { sm: 6, lg: 8 }, radius: { sm: 6, lg: 8 }, iconSize: { sm: 14, lg: 16 },
    },
});
const { collections } = model;
const sizeColl = collections.find(c => c.name === 'Size');
const sizeItems = () => model.items.filter(i => i.name.startsWith('button/') && i.collectionId === sizeColl.id);
const variantItems = () => model.items.filter(i => i.collectionId === model.ids.variant);

/**
 * A document with one bound Button master (root and label bound to the Variant and Size tokens), its instance and the instance's label.
 * Instance layers carry the bindings sync copies from the master.
 * `over` replaces parts: `variables`, `binding`, `props`, `instance` (fields of the instance root), `label` (fields of the instance label).
 */
const doc = (over = {}) => ({
    variables: {
        collections,
        items: model.items,
        ...over.variables,
    },
    pages: [{
        nodes: [
            {
                id: 'm1', name: 'Button', type: 'frame',
                behavior: { version: 2, templateId: 'button', variables: { variant: model.ids.variant, color: model.ids.color, size: sizeColl.id }, ...over.binding },
                vars: { 'fills.0': 'v-bg', stroke: 'v-border', radius: 's-radius', padH: 's-paddingX', padV: 's-paddingY', gap: 's-gap', minW: 's-height' },
            },
            { id: 'mt', name: 'Label', type: 'text', parentId: 'm1', vars: { 'fills.0': 'v-fg', fontSize: 's-fontSize', lineHeight: 's-lineHeight' } },
            {
                id: 'i1', name: 'Button', type: 'frame', isInstance: true, sourceId: 'm1', parentId: null,
                behavior: { version: 2, props: { ...over.props } }, vars: { 'fills.0': 'v-bg' }, ...over.instance,
            },
            { id: 'il', name: 'Label', type: 'text', parentId: 'i1', sourceId: 'mt', vars: { 'fills.0': 'v-fg' }, ...over.label },
        ],
        ...over.page,
    }],
});

test('a complete document has no diagnostics', () => {
    assert.deepEqual(diagnoseDocument(doc()), []);
});

test('a binding to a variable that no longer exists is unbound, naming the token', () => {
    const stale = doc({});
    const master = stale.pages[0].nodes.find(n => n.id === 'm1');
    master.vars = { fill: 'gone', stroke: 'gone' };
    const found = diagnoseDocument(stale).filter(f => f.code === 'unbound-token');
    assert.ok(found.some(f => f.nodeId === 'm1' && f.prop === 'fill'));
    assert.ok(found.some(f => f.nodeId === 'm1' && f.prop === 'stroke'));
});

test('a collection no template needs is ignored: diagnostics never scans unrelated collections', () => {
    const d = doc({ variables: { collections: [...collections, { id: 'c-x', name: 'Brand', modes: [] }] } });
    assert.deepEqual(diagnoseDocument(d), []);
});

test('a variable with no value in one mode is an error on the master, naming the variable and the mode', () => {
    const items = variantItems().map(i => (i.name === 'button/bg-hover' ? { ...i, values: { outlined: '#ffffff' } } : i));
    const found = diagnoseDocument(doc({ variables: { items: [...model.items.filter(i => !variantItems().includes(i)), ...items] } }));
    assert.deepEqual(found.filter(f => f.severity === 'error'), [{
        severity: 'error', code: 'variable-missing-in-mode', node: 'Button', nodeId: 'm1', variable: 'button/bg-hover', mode: 'Solid',
        message: 'Button: variable "button/bg-hover" has no value in mode "Solid" of "Variant".',
    }]);
});

test('a variable missing from its collection is an error on the master, naming the variable and the collection', () => {
    const items = variantItems().filter(i => i.name !== 'button/bg-hover');
    const found = diagnoseDocument(doc({ variables: { items: [...model.items.filter(i => !variantItems().includes(i)), ...items] } }));
    assert.deepEqual(found.filter(f => f.severity === 'error'), [{
        severity: 'error', code: 'variable-missing', node: 'Button', nodeId: 'm1', variable: 'button/bg-hover', collection: 'Variant',
        message: 'Button: variable "button/bg-hover" is missing from collection "Variant".',
    }]);
});

test('an instance with a token it cannot resolve is an error, with the reason', () => {
    const d = doc({ variables: { collections: collections.map(c => (c.id === sizeColl.id ? { ...c, modes: [] } : c)) } });
    const found = diagnoseDocument(d);
    const fontSize = found.find(f => f.token === 'fontSize');
    assert.equal(fontSize.severity, 'error');
    assert.equal(fontSize.code, 'token-unresolved');
    assert.equal(fontSize.reason, 'no-mode-selected');
    assert.equal(fontSize.nodeId, 'i1');
});

test('an instance resolves its modes from its own Appearance modes, not from props', () => {
    const items = sizeItems().map(i => (i.name === 'button/fontSize' ? { ...i, values: { sm: 14 } } : i));
    const d = doc({ variables: { items: [...model.items.filter(i => !sizeItems().includes(i)), ...items] }, instance: { varModes: { [sizeColl.id]: 'lg' } } });
    const found = diagnoseDocument(d);
    assert.deepEqual(found.map(f => f.code), ['variable-missing-in-mode'], 'the missing Large value is reported once, on the master');
    assert.equal(found[0].mode, 'Large');
});

test('an unbound dimension is reported once, on the master, naming the collection', () => {
    const found = diagnoseDocument(doc({ binding: { variables: { variant: model.ids.variant, color: model.ids.color, size: null } } }));
    assert.deepEqual(found, [{ severity: 'error', code: 'dimension-unbound', node: 'Button', nodeId: 'm1', dimension: 'size', collection: 'Size',
        message: 'Button: no "Size" collection is bound for "size".' }]);
});

test('a bound collection that does not exist is reported on the master, naming it', () => {
    const found = diagnoseDocument(doc({ binding: { variables: { variant: model.ids.variant, color: model.ids.color, size: 'c-gone' } } }));
    assert.deepEqual(found.filter(f => f.code === 'collection-missing'), [{ severity: 'error', code: 'collection-missing', node: 'Button', nodeId: 'm1', dimension: 'size', collection: 'c-gone',
        message: 'Button: collection "c-gone" bound for "size" does not exist.' }]);
});

test('a layer the user rebound by hand while disabled is a warning, and the rebinding is kept', () => {
    const found = diagnoseDocument(doc({ props: { disabled: true }, instance: { vars: { 'fills.0': 'v-fg' } } }));
    assert.deepEqual(found.filter(f => f.severity === 'warning' && f.code === 'rebound-by-hand'), [{
        severity: 'warning', code: 'rebound-by-hand', node: 'Button', nodeId: 'i1', layer: 'root', prop: 'fill', state: 'disabled',
        message: 'Button: root fill was set by hand, so state "disabled" does not change it.',
    }]);
});

test('a layer bound to the disabled variable while disabled is not reported', () => {
    const found = diagnoseDocument(doc({ props: { disabled: true }, instance: { vars: { 'fills.0': 'v-bg-disabled' } }, label: { vars: { 'fills.0': 'v-fg-disabled' } } }));
    assert.deepEqual(found, []);
});

test('a master token that is not bound is a warning, naming the layer, the property and the token', () => {
    const d = doc();
    d.pages[0].nodes[0].vars = { stroke: 'v-border', radius: 's-radius', padH: 's-paddingX', padV: 's-paddingY', gap: 's-gap', minW: 's-height' };
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
    const d = doc({ props: { disabled: true }, instance: { vars: { 'fills.0': 'v-fg' } } });
    assert.deepEqual(diagnoseDocument(d), diagnoseDocument(d));
});
