// Conformance for typography: every text part of every registered template declares a typography role, that role is a
// typography token of the template, and Auto Fix binds it to a whole Semantic style per Size mode with no diagnostics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { planAutoFix, applyAutoFix } from '../src/behavior-engine/auto-fix.js';
import { diagnoseDocument } from '../src/behavior-engine/diagnostics.js';
import { applyBasePlan, planFromSnapshot, BASE_SNAPSHOT } from '../src/index.js';

const textParts = template => [
    ...template.anatomy.filter(slot => slot.kind === 'text' || slot.kind === 'control'),
    ...(template.parts ?? []).filter(part => part.kind === 'text'),
];

test('every text part of every registered template declares a typography role', () => {
    for (const template of TEMPLATES.values()) {
        for (const part of textParts(template)) {
            assert.equal(typeof part.typography, 'string', `${template.id}.${part.id} declares no typography role`);
        }
    }
});

test('every declared role is a typography token of the template, and its tokens are of kind typography', () => {
    for (const template of TEMPLATES.values()) {
        const fromSize = template.tokens.fromSize ?? [];
        for (const part of textParts(template)) {
            const token = `${part.typography}Typography`;
            assert.ok(fromSize.includes(token), `${template.id}.${part.id} needs token ${token} in fromSize`);
            assert.equal(template.tokenKinds[token], 'typography', `${token} is typography`);
            assert.ok(template.display[part.id]?.typography === token, `${template.id}.${part.id} is displayed through ${token}`);
        }
    }
});

test('no template keeps a standalone fontSize or lineHeight token', () => {
    for (const template of TEMPLATES.values()) {
        const names = Object.values(template.tokens).flat();
        assert.equal(names.includes('fontSize') || names.includes('lineHeight'), false, template.id);
    }
});

test('Auto Fix on every registered template creates typography variables aliasing Semantic styles, with zero errors', () => {
    let n = 0;
    const uid = () => `u${++n}`;
    const base = { collections: [], items: [] };
    applyBasePlan(base, planFromSnapshot(BASE_SNAPSHOT), uid);
    for (const template of TEMPLATES.values()) {
        const store = structuredClone(base);
        const binding = { version: 2, templateId: template.id, variables: Object.fromEntries(Object.keys(template.props).filter(p => template.props[p].source === 'variable').map(p => [p, null])) };
        applyAutoFix(store, binding, planAutoFix({ template, binding, variables: store, layers: [] }), uid);
        const doc = { variables: store, pages: [{ name: 'p', nodes: [{ id: 'm', name: 'M', component: true, behavior: binding }] }] };
        assert.deepEqual(diagnoseDocument(doc).filter(f => f.severity === 'error'), [], template.id);
        const typography = store.items.filter(i => i.type === 'typography' && store.collections.find(c => c.id === i.collectionId)?.name.endsWith(' Size'));
        assert.equal(typography.length, Object.values(template.tokenKinds).filter(k => k === 'typography').length, `${template.id} typography variables`);
        for (const item of typography) {
            for (const value of Object.values(item.values)) {
                const target = store.items.find(i => i.id === value.alias);
                assert.ok(target && target.type === 'typography', `${item.name} is a whole alias to a typography item`);
                assert.equal(store.collections.find(c => c.id === target.collectionId).name, 'Semantic', `${item.name} aliases Semantic`);
            }
        }
    }
});

test('a master text with no typography binding is a warning that names the text part and its role', async () => {
    const { buttonModel } = await import('../../../scripts/button-model.mjs');
    const { diagnoseDocument } = await import('../src/behavior-engine/diagnostics.js');
    const model = buttonModel({ colors: ['primary'], variantModes: ['solid'] });
    const size = model.collections.find(c => c.name === 'Button Size');
    const doc = { variables: { collections: model.collections, items: model.items }, pages: [{ nodes: [
        { id: 'm1', name: 'Button', type: 'frame', behavior: { version: 2, templateId: 'button', variables: { variant: model.ids.variant, color: model.ids.color, size: size.id } }, vars: { 'fills.0': 'v-bg' } },
        { id: 'mt', name: 'Label', type: 'text', parentId: 'm1', vars: { 'fills.0': 'v-fg' } },
    ] }] };
    const found = diagnoseDocument(doc).filter(f => f.prop === 'typography');
    assert.equal(found.length, 1);
    assert.equal(found[0].severity, 'warning');
    assert.equal(found[0].message, 'Button: text label is not bound to label.');
});
