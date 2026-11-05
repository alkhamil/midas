// An effect token: a template token of kind `effect` is a variable of type effect (a list of drop shadows), written to the root as `box-shadow`.
// The display property is `shadow` (it binds the node's `effects` variable), so canvas, Play and the export read one token. An empty list is `none`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NODE_PROPERTIES, VARIABLE_KEYS } from '../src/behavior-engine/display.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { resolveTokens, cssVarOf } from '../src/behavior-engine/tokens.js';
import { planBindTokens } from '../src/behavior-engine/bind-tokens.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { planAutoFix } from '../src/behavior-engine/auto-fix.js';
import { BASE_SNAPSHOT, planFromSnapshot } from '../src/index.js';
import ROLES from '../src/base-tokens/roles.json' with { type: 'json' };

const DROP = (opacity, y, blur, spread) => ({ type: 'drop', visible: true, color: '#000000', opacity, x: 0, y, blur, spread });
const RAISED = [DROP(0.08, 6, 16, 0), DROP(0.12, 3, 6, -4), DROP(0.05, 9, 28, 8)];

/** A template with a Variant of two modes: flat has no shadow, raised has the elevation. */
const RAISE = {
    id: 'raise', name: 'Raise',
    element: { tag: 'div', attrs: {}, disabledState: 'disabled', blockClickProps: [] },
    anatomy: [{ id: 'label', kind: 'text', typography: 'label' }],
    props: {
        variant: { source: 'variable', collection: 'Variant', modes: ['flat', 'raised'] },
        label: { source: 'literal', type: 'string', default: 'Label', node: { key: 'label', field: 'text' } },
        disabled: { source: 'literal', type: 'boolean', default: false },
    },
    tokens: { fromVariant: ['shadow', 'fg'] },
    tokenKinds: { shadow: 'effect', fg: 'color' },
    tokenRoles: { shadow: { flat: 'shadow-none', raised: 'shadow-float' }, fg: 'fg' },
    persistentStates: { disabled: { prop: 'disabled', tokens: {} } },
    previewStates: {},
    statePseudo: { disabled: ':disabled' },
    display: { root: { shadow: 'shadow' }, label: { fill: 'fg' } },
    events: [],
};
const variables = {
    collections: [{ id: 'cv', name: 'Raise Variant', modes: [{ id: 'flat', name: 'Flat' }, { id: 'raised', name: 'Raised' }] }, { id: 'sem', name: 'Semantic', modes: [{ id: 'base', name: 'Base' }] }],
    items: [
        { id: 'none', name: 'boxShadowNone', type: 'effect', collectionId: 'sem', values: { base: [] } },
        { id: 'float', name: 'boxShadowSecondary', type: 'effect', collectionId: 'sem', values: { base: RAISED } },
        { id: 'c1', name: 'a color', type: 'color', collectionId: 'sem', values: { base: '#112233' } },
        { id: 'shadow', name: 'shadow', type: 'effect', collectionId: 'cv', values: { flat: { alias: 'none' }, raised: { alias: 'float' } } },
        { id: 'fg', name: 'fg', type: 'color', collectionId: 'cv', values: { flat: { alias: 'c1' }, raised: { alias: 'c1' } } },
    ],
};

test('the display property shadow is an effect written to box-shadow and bound to the node effects variable', () => {
    assert.deepEqual(NODE_PROPERTIES.frame.shadow, { kind: 'effect', css: 'box-shadow' });
    assert.deepEqual(VARIABLE_KEYS.shadow, ['effects']);
});

test('the schema accepts the effect kind, and still refuses an unknown one', () => {
    assert.deepEqual(validateTemplateSchema(RAISE), []);
    assert.match(validateTemplateSchema({ ...RAISE, tokenKinds: { ...RAISE.tokenKinds, shadow: 'blur' } }).join('\n'), /token "shadow" has no kind \(length, ratio, color, typography or effect\)/);
});

test('an effect token resolves to the box-shadow text of its visible drop shadows, and to none for an empty list', () => {
    const binding = { variables: { variant: 'cv' } };
    const css = mode => resolveTokens(RAISE, binding, { variant: mode }, variables);
    const flat = css('flat'), raised = css('raised');
    assert.deepEqual(flat.unresolved, []);
    assert.equal(flat.vars[cssVarOf('raise', 'shadow')], 'none');
    assert.equal(raised.vars[cssVarOf('raise', 'shadow')], '0px 6px 16px 0px #00000014, 0px 3px 6px -4px #0000001f, 0px 9px 28px 8px #0000000d');
});

test('an inner shadow is inset and a hidden effect is left out', () => {
    const own = { ...variables, items: variables.items.map(i => i.id === 'float' ? { ...i, values: { base: [{ ...DROP(0.25, 1, 2, 0), type: 'inner' }, { ...DROP(0.5, 9, 9, 9), visible: false }] } } : i) };
    assert.equal(resolveTokens(RAISE, { variables: { variant: 'cv' } }, { variant: 'raised' }, own).vars['--raise-shadow'], 'inset 0px 1px 2px 0px #00000040');
});

test('an effect token whose variable is not an effect is a type mismatch, not a guess', () => {
    const wrong = { ...variables, items: variables.items.map(i => i.id === 'shadow' ? { ...i, type: 'color', values: { flat: { alias: 'c1' }, raised: { alias: 'c1' } } } : i) };
    const out = resolveTokens(RAISE, { variables: { variant: 'cv' } }, { variant: 'flat' }, wrong);
    assert.deepEqual(out.unresolved.map(u => [u.token, u.reason]), [['shadow', 'type-mismatch']]);
});

test('the bind plan writes the effect variable on the root effects key', () => {
    const root = { vars: {} };
    const { ops, problems } = planBindTokens({ template: RAISE, binding: { variables: { variant: 'cv' } }, layers: [{ key: 'root', node: root }], variables });
    assert.deepEqual(problems, []);
    assert.deepEqual(ops, [{ key: 'root', varKey: 'effects', itemId: 'shadow' }]);
});

test('the export writes box-shadow from the token on the root', () => {
    const files = generateComponent(RAISE, { version: 2, templateId: 'raise', variables: { variant: 'cv' } }, variables, 'Raise', { id: 'm', type: 'frame', layout: 'horizontal' }, () => []).files;
    assert.match(files['Raise.css'], /\.raise \{[^}]*box-shadow: var\(--raise-shadow\);/s);
});

test('the base data holds the two effects as Primitives and Semantic aliases of them, and the shadow roles point at the Semantic ones', () => {
    const of = (collection, name) => BASE_SNAPSHOT.items.find(i => i.collection === collection && i.name === name);
    assert.equal(of('Primitives', 'shadow/none').type, 'effect');
    assert.deepEqual(of('Primitives', 'shadow/none').values, { Base: { literal: [] } });
    assert.deepEqual(of('Primitives', 'shadow/secondary').values, { Base: { literal: RAISED } });
    for (const [name, primitive] of [['boxShadowNone', 'shadow/none'], ['boxShadowSecondary', 'shadow/secondary']]) {
        assert.equal(of('Semantic', name).type, 'effect');
        for (const mode of ['Light', 'Dark']) assert.deepEqual(of('Semantic', name).values[mode], { alias: { collection: 'Primitives', name: primitive } });
    }
    assert.deepEqual(ROLES['shadow-none'], { base: 'Semantic/boxShadowNone' });
    assert.deepEqual(ROLES['shadow-float'], { base: 'Semantic/boxShadowSecondary' });
    assert.equal(planFromSnapshot(BASE_SNAPSHOT).items.filter(i => i.type === 'effect').length, 4);
});

test('Auto Fix creates the effect variable of each mode as an alias of the Semantic effect, never a literal', () => {
    const plan = planAutoFix({ template: RAISE, binding: { variables: { variant: null } }, variables: { collections: [], items: [] } });
    assert.deepEqual(plan.unfixable, []);
    assert.deepEqual(plan.needsValue, []);
    const shadow = plan.plan.items.find(i => i.name === 'shadow');
    assert.ok(shadow, 'the shadow variable is planned');
    assert.equal(shadow.type, 'effect');
    assert.equal(Object.keys(shadow.values).length, 2);
    for (const value of Object.values(shadow.values)) assert.ok(value.alias, 'an alias');
    const semantic = plan.plan.items.filter(i => i.collection === 'Semantic').map(i => i.name);
    assert.ok(semantic.includes('boxShadowNone') && semantic.includes('boxShadowSecondary'), 'both Semantic effects are created');
});
