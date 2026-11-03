import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { BUTTON } from '../src/templates/button.js';
import { buttonModel } from '../../../scripts/button-model.mjs';
import { planAutoFix, applyAutoFix } from '../src/behavior-engine/auto-fix.js';
import { previewOf, canvasColorsOf } from '../src/behavior-engine/preview.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { variableValue } from '../src/behavior-engine/variable-value.js';
import { splitColor } from '../src/behavior-engine/tokens.js';
import { diagnoseDocument } from '../src/behavior-engine/diagnostics.js';
import { BASE_SNAPSHOT, planFromSnapshot, applyBasePlan, createBinding } from '../src/index.js';
import { INPUT } from '../src/templates/input.js';
import { inputModel } from '../../../scripts/input-model.mjs';

const button = TEMPLATES.get('button');
const model = buttonModel({ colors: ['primary', 'danger'], variantModes: ['solid'] });
const css = generateComponent(button, model.binding, { collections: model.collections, items: model.items }, 'Button', { id: 'm', type: 'frame', layout: 'horizontal', primaryAxisAlign: 'center', counterAxisAlign: 'center' }, () => []).files['Button.css'];

test('the outline includes the border: no gap, so the ring starts back at the border inner edge', () => {
    assert.match(css, /\.button \{\n(?:.*\n)*?\s*outline: 2px solid var\(--button-outline-color\);\n\s*outline-offset: -1px;/);
});

test('the offset follows the master border width; a border as wide as the outline shows no ring', () => {
    const imodel = inputModel({});
    const variables = { collections: imodel.collections, items: imodel.items };
    const styled = master => generateComponent(INPUT, imodel.binding, variables, 'Input', master, () => []).files['Input.css'];
    assert.match(styled({ id: 'm', type: 'frame', layout: 'horizontal' }), /\.input \{\n(?:.*\n)*?\s*outline: 2px solid var\(--input-outline-color\);\n\s*outline-offset: -1px;/);
    assert.match(styled({ id: 'm', type: 'frame', layout: 'horizontal', strokeWidth: 1 }), /\s*outline-offset: -1px;/);
    const thick = styled({ id: 'm', type: 'frame', layout: 'horizontal', strokeWidth: 2 });
    assert.match(thick, /\.input \{\n(?:.*\n)*?\s*outline: none;/);
    assert.doesNotMatch(thick, /outline: 2px/, 'no ring is drawn when the border already spans the outline width');
});

test('the canvas draws no outline for focus: the border recolor only, never outline geometry', () => {
    assert.equal(canvasColorsOf(button, model.binding, { size: 'sm', variant: 'solid', color: 'primary' }, { collections: model.collections, items: model.items }, resolveProps(button, {}), 'focus'), null);
    const imodel = inputModel({});
    const drawn = canvasColorsOf(INPUT, imodel.binding, { variant: 'outlined', status: 'default', size: 'md' }, { collections: imodel.collections, items: imodel.items }, resolveProps(INPUT, {}), 'focus');
    assert.deepEqual(Object.keys(drawn ?? {}), ['stroke']);
});

test('focus sets the outline colour for keyboard focus only, and only while the Button is not disabled', () => {
    assert.match(css, /\.button\[data-variant="solid"\]\[data-color="primary"\]\[data-size="sm"\] \{\n(?:.*\n)*?\s*--button-outline-color: #00000000;/);
    assert.match(css, /\.button\[data-variant="solid"\]\[data-color="primary"\]\[data-size="sm"\]:focus-visible:not\(:disabled\):not\(\[data-blocked\]\) \{\n\s*--button-outline-color: var\(--button-outline-color-active\);\n\}/);
    assert.doesNotMatch(css, /:focus(?!-visible)/);
});

test('a disabled Button never shows the outline: its disabled block holds no outline colour', () => {
    const disabled = css.match(/\[data-size="sm"\]:disabled \{\n([^}]*)\}/);
    assert.ok(disabled, 'expected a disabled block');
    assert.doesNotMatch(disabled[1], /outline/);
});

test('the outline is a width and an offset, in px; a template may have none, and a malformed one is refused', () => {
    const bad = structuredClone(BUTTON);
    bad.outline = { width: '2', offset: 1 };
    assert.match(validateTemplateSchema(bad).join('\n'), /outline width must be a number of px, 0 or more/);
    const missing = structuredClone(BUTTON);
    delete missing.outline;
    assert.deepEqual(validateTemplateSchema(missing), [], 'no outline is a template with no focus ring');
    missing.outline = 'thick';
    assert.match(validateTemplateSchema(missing).join('\n'), /outline must be an object/);
});
// Outline and ring like antd (H): the rest colour is always transparent; the interaction colour is a variable.
let hid = 0;
const hidOf = () => `h${++hid}`;
/** A store with base variables and one template fixed: the Auto Fix end state, not a hand fixture. */
function fixedStore(templateId) {
    const store = { collections: [], items: [] };
    applyBasePlan(store, planFromSnapshot(BASE_SNAPSHOT), hidOf);
    const template = TEMPLATES.get(templateId);
    const binding = createBinding(template, store.collections);
    applyAutoFix(store, binding, planAutoFix({ template, binding, variables: store, layers: [] }), hidOf);
    return { store, binding };
}
/** The resolved alpha of a variable in every mode of its collection. */
function alphasOf(store, varName) {
    const item = store.items.find(i => i.name === varName);
    assert.ok(item, `expected ${varName}`);
    const coll = store.collections.find(c => c.id === item.collectionId);
    return coll.modes.map(m => {
        const text = variableValue(store, item, () => m.id);
        const split = typeof text === 'string' && splitColor(text);
        assert.ok(split, `${varName} resolves to a colour in mode ${m.name}`);
        return split.alpha;
    });
}

test('outline-color resolves to alpha 0 in every mode of Button and Input', () => {
    const btn = fixedStore('button');
    assert.deepEqual(alphasOf(btn.store, 'outline-color'), [0, 0, 0, 0, 0, 0]);
    const inp = fixedStore('input');
    assert.deepEqual(alphasOf(inp.store, 'outline-color'), [0, 0, 0]);
});

test('outline-color aliases Semantic: never a literal, never another component variable', () => {
    for (const templateId of ['button', 'input']) {
        const { store } = fixedStore(templateId);
        const item = store.items.find(i => i.name === 'outline-color');
        const coll = store.collections.find(c => c.id === item.collectionId);
        for (const m of coll.modes) {
            const target = store.items.find(i => i.id === item.values[m.id]?.alias);
            assert.ok(target, `outline-color aliases in mode ${m.name}`);
            assert.equal(store.collections.find(c => c.id === target.collectionId).name, 'Semantic');
        }
    }
});

test('the rest ring is transparent; focus-visible switches to the active colour variable', () => {
    const { store, binding } = fixedStore('button');
    const nodes = [{ id: 'm', name: 'B', type: 'frame', component: true, layout: 'horizontal', behavior: binding, vars: {} }];
    const css = generateComponent(TEMPLATES.get('button'), binding, store, 'Button', nodes[0], () => []).files['Button.css'];
    assert.match(css, /--button-outline-color: #[0-9a-f]{6}00;/);
    assert.match(css, /:focus-visible:not\(:disabled\):not\(\[data-blocked\]\) \{\n\s*--button-outline-color: var\(--button-outline-color-active\);\n\}/);
});

test('the ring animates; reduced motion removes transitions and the wave', () => {
    const { store, binding } = fixedStore('button');
    const nodes = [{ id: 'm', name: 'B', type: 'frame', component: true, layout: 'horizontal', behavior: binding, vars: {} }];
    const css = generateComponent(TEMPLATES.get('button'), binding, store, 'Button', nodes[0], () => []).files['Button.css'];
    assert.match(css, /transition: outline-color 0\.2s cubic-bezier\(0\.645, 0\.045, 0\.355, 1\), outline-offset 0\.2s cubic-bezier\(0\.645, 0\.045, 0\.355, 1\);/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?transition: none;[\s\S]*?\.button\[data-wave-on\]::after \{[\s\S]*?animation: none;/);
});

test('a missing outline-color-active is an error; an opaque outline-color warns and Auto Fix repairs it', () => {
    const bare = buttonModel({ colors: ['primary'], variantModes: ['solid'] });
    const docOf = store => ({ variables: store, pages: [{ name: 'p', nodes: [{ id: 'm', name: 'B', type: 'frame', component: true, behavior: bare.binding }] }] });
    const missing = diagnoseDocument(docOf({ collections: bare.collections, items: bare.items.filter(i => i.name !== 'outline-color-active') }));
    assert.ok(missing.some(f => f.code === 'variable-missing' && f.variable === 'outline-color-active'), 'missing active is an error');
    const literal = { collections: structuredClone(bare.collections), items: structuredClone(bare.items) };
    literal.items.find(i => i.name === 'outline-color').values.solid = '#d9d9d9';
    assert.ok(diagnoseDocument(docOf(literal)).some(f => f.code === 'component-not-semantic' && f.variable === 'outline-color'), 'a literal rest is a provenance error');
    const murky = { collections: structuredClone(bare.collections), items: structuredClone(bare.items) };
    const opaque = bare.ids.primitives;
    murky.items.push(
        { id: 'p-opaque', name: 'opaque', type: 'color', collectionId: opaque, values: { base: '#d9d9d9' } },
        { id: 'sem-opaque', name: 'fx-opaque', type: 'color', collectionId: bare.ids.semantic, values: { base: { alias: 'p-opaque' } } },
    );
    murky.items.find(i => i.name === 'outline-color').values.solid = { alias: 'sem-opaque' };
    const warned = diagnoseDocument(docOf(murky));
    assert.ok(warned.some(f => f.code === 'outline-not-transparent' && f.severity === 'warning'), 'opaque rest warns');
    const binding = structuredClone(bare.binding);
    applyAutoFix(murky, binding, planAutoFix({ template: TEMPLATES.get('button'), binding, variables: murky, layers: [] }), hidOf);
    assert.deepEqual(diagnoseDocument(docOf(murky)).filter(f => f.code === 'outline-not-transparent'), []);
});

test('interaction is schema data: bad values and a mismatched focus pairing are refused', () => {
    assert.deepEqual(validateTemplateSchema(BUTTON), []);
    assert.deepEqual(validateTemplateSchema(INPUT), []);
    assert.equal(BUTTON.interaction.focus, 'outline');
    assert.equal(BUTTON.interaction.wave, true);
    assert.equal(INPUT.interaction.focus, 'halo');
    assert.equal(INPUT.interaction.wave, false);
    const bad = structuredClone(BUTTON);
    bad.interaction = { focus: 'glow', wave: false };
    assert.match(validateTemplateSchema(bad).join('\n'), /interaction focus "glow" must be "outline" or "halo"/);
    const haloNoSwitch = structuredClone(INPUT);
    delete haloNoSwitch.previewStates.focus['outline-color'];
    assert.match(validateTemplateSchema(haloNoSwitch).join('\n'), /halo focus must switch outline-color/);
    const outlineSwitch = structuredClone(BUTTON);
    outlineSwitch.statePseudo.hover = ':focus';
    outlineSwitch.previewStates.hover['outline-color'] = 'outline-color-active';
    assert.match(validateTemplateSchema(outlineSwitch).join('\n'), /outline focus must not switch outline-color on :focus/);
});

test('the input halo uses the default, error and warning colours', () => {
    const imodel = inputModel({});
    const halo = status => previewOf(INPUT, imodel.binding, { variant: 'outlined', status, size: 'md' }, { collections: imodel.collections, items: imodel.items }, { value: '', placeholder: '', maxLength: '', allowClear: false, showCount: false, hasIcon: false, iconPlacement: 'start', icon: null, iconEnd: null, hasPrefix: false, hasSuffix: false, prefixText: '', suffixText: '', disabled: false, readOnly: false }, 'focus-visible').vars['--input-outline-color'];
    assert.equal(halo('default'), '#4096ff33');
    assert.equal(halo('error'), '#ff4d4f33');
    assert.equal(halo('warning'), '#faad1433');
});

test('wave-color is created per variant and follows the button colour', () => {
    const { store } = fixedStore('button');
    const wave = store.items.find(i => i.name === 'wave-color');
    assert.ok(wave, 'wave-color exists');
    const bg = store.items.find(i => i.name === 'bg');
    const border = store.items.find(i => i.name === 'border');
    const modeOf = (variant, color) => coll => {
        const id = name => coll.modes.find(m => m.name === name)?.id ?? coll.modes[0].id;
        return coll.name === 'Button Variant' ? id(variant) : coll.name === 'Button Color' ? id(color) : coll.modes[0].id;
    };
    const solidPrimary = modeOf('solid', 'primary');
    assert.equal(variableValue(store, wave, solidPrimary), variableValue(store, bg, solidPrimary));
    const outlinedDefault = modeOf('outlined', 'default');
    assert.equal(variableValue(store, wave, outlinedDefault), variableValue(store, border, outlinedDefault));
    assert.ok(splitColor(variableValue(store, wave, solidPrimary)).alpha > 0, 'the wave colour is visible');
});
