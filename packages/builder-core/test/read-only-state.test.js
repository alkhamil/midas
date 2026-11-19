// The Input's state model: Disabled and Read only are both non-interactive and both draw the disabled look; neither can be clicked or focused (no focus state, no
// caret) on the canvas, in Play or in the export. Read only is not focusable here, on purpose (antd's is; the canvas is the source of truth). Disabled shows the
// placeholder while there is no value and Read only the value; a value still beats the placeholder. `readOnly` is a persistent state that is the disabled state
// turned on by another prop (`as`), so every surface reads one rule: stateOn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { stateOn } from '../src/behavior-engine/display.js';
import { activeStateOf, previewOf } from '../src/behavior-engine/preview.js';
import { planStateBindings } from '../src/behavior-engine/state-bindings.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { applyTemplateToFrame, instanceOf } from '../src/behavior-engine/template-master.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { inputModel } from '../../../scripts/input-model.mjs';

const input = TEMPLATES.get('input');
const model = inputModel();
const variables = { collections: model.collections, items: model.items };

test('Read only is an inert persistent state: it blocks the interaction like disabled, with its own background and no disabled attribute', () => {
    assert.deepEqual(input.persistentStates.readOnly, { prop: 'readOnly', as: 'disabled', inert: true, tokens: { bg: 'bg-disabled', 'glyph-fg': 'glyph-fg-disabled' } });
    assert.equal(input.statePseudo.readOnly, '[readonly]');
    assert.deepEqual(validateTemplateSchema(input), []);
    assert.equal(stateOn(input, 'disabled', { disabled: true }), true);
    assert.equal(stateOn(input, 'disabled', { readOnly: true }), false, 'read only is not the disabled state: it has no disabled attribute');
    assert.equal(stateOn(input, 'disabled', { disabled: false, readOnly: false }), false);
    assert.equal(stateOn(input, 'readOnly', { readOnly: true }), true, 'a state is on by its own prop');
});

test('the validator holds an alias to the rules: it names another persistent state, itself not an alias, and adds no tokens of its own', () => {
    const withAs = as => ({ ...structuredClone(input), persistentStates: { ...structuredClone(input.persistentStates), readOnly: { prop: 'readOnly', as, tokens: {} } } });
    assert.match(validateTemplateSchema(withAs('nope')).join('\n'), /persistent state "readOnly" is an alias of "nope", which is not a persistent state/);
    assert.match(validateTemplateSchema(withAs('readOnly')).join('\n'), /persistent state "readOnly" is an alias of "readOnly", which is itself an alias|alias of itself/);
    const own = withAs('disabled');
    own.persistentStates.readOnly.tokens = { bg: 'bg-disabled' };
    assert.match(validateTemplateSchema(own).join('\n'), /persistent state "readOnly" is an alias and takes no tokens of its own/);
});

test('Read only draws what Disabled draws: the same state and the same variables on the canvas', () => {
    const modes = { variant: 'outlined', status: 'default', size: 'md' };
    // Its overrides are the disabled background and glyphs, without the disabled text colour.
    const readOnlyOverrides = activeStateOf(input, { readOnly: true }, 'default').overrides, disabledOverrides = activeStateOf(input, { disabled: true }, 'default').overrides;
    assert.equal(readOnlyOverrides.bg, disabledOverrides.bg);
    assert.equal(readOnlyOverrides['glyph-fg'], disabledOverrides['glyph-fg']);
    assert.equal(readOnlyOverrides.fg, undefined, 'the text colour is not overridden');
    const look = props => previewOf(input, model.binding, modes, variables, resolveProps(input, props), 'default').vars;
    // Read only looks like disabled, except the value text: the background and the glyphs are the disabled ones, the text keeps the rest colour.
    for (const v of ['--input-bg', '--input-glyph-fg']) {
        assert.equal(look({ readOnly: true })[v], look({ disabled: true })[v], `${v} is the disabled one`);
        assert.notEqual(look({ readOnly: true })[v], look({})[v], `${v} is not the rest look`);
    }
    assert.equal(look({ readOnly: true })['--input-fg'], look({})['--input-fg'], 'the text keeps the rest colour');
    assert.notEqual(look({ disabled: true })['--input-fg'], look({})['--input-fg'], 'disabled changes the text');
    const layers = [{ key: 'root', instance: { id: 'i', vars: { 'fills.0': 'rest-bg' } }, master: { vars: { 'fills.0': 'rest-bg' } } }];
    const ops = props => planStateBindings({ template: input, binding: model.binding, props: resolveProps(input, props), layers, variables }).ops;
    assert.ok(ops({ readOnly: true }).length > 0, 'it binds the variables of its background');
});

test('the export: the disabled attribute is the disabled prop alone; read only has its own rule on the control, and the guards exclude it', () => {
    const { files } = generateComponent(input, model.binding, variables, 'Input', { id: 'm', type: 'frame', layout: 'horizontal' }, () => []);
    assert.match(files['Input.jsx'], /disabled=\{disabled\}/);
    assert.doesNotMatch(files['Input.jsx'], /disabled=\{disabled \|\| readOnly\}/, 'read only is not the disabled attribute');
    assert.match(files['Input.css'], /:has\(:disabled\)/);
    assert.match(files['Input.css'], /:has\(\[readonly\]\)/, 'read only draws its own look on the control attribute');
    assert.match(files['Input.css'], /:not\(:has\(\[readonly\]\)\)/, 'the interaction guards exclude read only');
});

/** An Input master and an instance of it with `props`, as Play reads them. */
function inputInstance(props) {
    const master = { id: 'master', name: 'Input', type: 'frame', parentId: null, fills: [] };
    const created = applyTemplateToFrame(input, { frame: master, children: [], binding: { variables: model.binding.variables }, variables, idOf: key => `m-${key}` }).created;
    const [root, ...copies] = instanceOf(input, master, created, props, { id: src => `i-${src}`, varModes: { [model.ids.variant]: 'outlined', [model.ids.status]: 'default', [model.ids.size]: 'md' } });
    const frame = { ...root, id: 'inst', x: 0, y: 0, w: 200, h: 32 };
    const kids = copies.map(n => (n.parentId === root.id ? { ...n, parentId: 'inst' } : n));
    return { pages: [{ id: 'p', name: 'Screens', nodes: [master, ...created, frame, ...kids] }], variables };
}
const controlOf = (doc) => { const find = el => (el.tag === 'input' ? el : (el.children ?? []).map(find).find(Boolean)); return find(toDomTree(doc, 'inst').root); };

test('Play: the input is disabled for Disabled and for Read only, and not otherwise; the value stays', () => {
    assert.equal(controlOf(inputInstance({ disabled: true, value: 'x' })).attrs.disabled, true);
    assert.equal(controlOf(inputInstance({ readOnly: true, value: 'x' })).attrs.disabled, undefined, 'read only has no disabled attribute');
    assert.equal(controlOf(inputInstance({ readOnly: true, value: 'x' })).attrs.value, 'x', 'Read only shows the value');
    assert.equal(controlOf(inputInstance({ value: 'x' })).attrs.disabled, undefined);
});

test('Disabled shows the placeholder while there is no value and Read only the value; a value beats the placeholder in both', () => {
    assert.equal(controlOf(inputInstance({ disabled: true, placeholder: 'Name' })).attrs.placeholder, 'Name');
    assert.equal(controlOf(inputInstance({ readOnly: true, value: 'Ana', placeholder: 'Name' })).attrs.value, 'Ana');
    assert.equal(controlOf(inputInstance({ readOnly: true, value: 'Ana', placeholder: 'Name' })).attrs.placeholder, undefined, 'the value beats the placeholder');
    assert.equal(controlOf(inputInstance({ disabled: true, value: 'Ana', placeholder: 'Name' })).attrs.placeholder, undefined);
});
