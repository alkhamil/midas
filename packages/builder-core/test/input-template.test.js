import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { previewOf } from '../src/behavior-engine/preview.js';
import { planBindTokens } from '../src/behavior-engine/bind-tokens.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { INPUT } from '../src/templates/input.js';
import { inputModel } from '../../../scripts/input-model.mjs';

test('the Input schema is valid and registered', () => {
    assert.deepEqual(validateTemplateSchema(INPUT), []);
    assert.equal(TEMPLATES.get('input'), INPUT);
});

const model = inputModel({});
const variables = { collections: model.collections, items: model.items };
const solid = fill => [{ type: 'solid', color: fill, opacity: 1, visible: true }];
const rootVars = { 'fills.0': 'v-bg', stroke: 'v-border', radius: 's-radius', padH: 's-paddingX', padV: 's-paddingY', gap: 's-gap' };
const labelVars = { 'fills.0': 'v-fg', fontSize: 's-fontSize', lineHeight: 's-lineHeight' };

function master(over = {}) {
    return {
        id: 'm', name: 'Input', type: 'frame', parentId: null, component: true, layout: 'horizontal', gap: 8, padding: 12,
        x: 0, y: 0, w: 200, h: 40, fills: solid('#ffffff'), radius: 6, stroke: '#000000', strokeWidth: 1, strokeAlign: 'inside',
        behavior: { version: 2, templateId: 'input', variables: model.binding.variables }, vars: rootVars, ...over,
    };
}

function valueText(over = {}) {
    return {
        id: 'm-value', name: 'Value', type: 'text', parentId: 'm', text: '', x: 12, y: 8, w: 120, h: 24,
        fills: solid('#18181b'), fontSize: 14, vars: labelVars, ...over,
    };
}

const MODES = { 'c-variant': 'outlined', 'c-status': 'default', 'c-size': 'middle' };

function instance(over = {}, props = {}, varModes = MODES) {
    return {
        id: 'i1', name: 'Search', type: 'frame', parentId: null, x: 0, y: 0, w: 200, h: 40, isInstance: true, sourceId: 'm',
        behavior: { version: 2, props }, varModes, fills: solid('#ffffff'), radius: 6,
        stroke: '#000000', strokeWidth: 1, strokeAlign: 'inside', vars: rootVars, ...over,
    };
}

function childrenOf(masterNode, text) {
    return id => (id === masterNode.id ? [text] : []);
}

test('control extras must name props of the right type', () => {
    const badReadonly = structuredClone(INPUT);
    badReadonly.control.readonly = 'value';
    assert.match(validateTemplateSchema(badReadonly).join('\n'), /control readonly "value" is not a boolean prop/);
    const badMaxlength = structuredClone(INPUT);
    badMaxlength.control.maxlength = 'disabled';
    assert.match(validateTemplateSchema(badMaxlength).join('\n'), /control maxlength "disabled" is not a string prop/);
    const badClear = structuredClone(INPUT);
    badClear.control.clear = 'value';
    assert.match(validateTemplateSchema(badClear).join('\n'), /control clear "value" is not a boolean prop/);
});

test('codegen writes a span root with data modes, an input with its props, and addon spans', () => {
    const { files } = generateComponent(INPUT, model.binding, variables, 'Input', master(), childrenOf(master(), valueText()));
    const jsx = files['Input.jsx'];
    assert.match(jsx, /<span/);
    assert.match(jsx, /className="input"/);
    assert.match(jsx, /data-variant=\{variant\}/);
    assert.match(jsx, /data-status=\{status\}/);
    assert.match(jsx, /data-size=\{size\}/);
    assert.match(jsx, /<input className="input-label" value=\{value\} placeholder=\{placeholder\} readOnly=\{readOnly\} maxLength=\{maxLength\} disabled=\{disabled\} \/>/);
    assert.ok(jsx.includes('{((hasPrefix === true) && (String(prefixText ?? "") !== "")) && <span className="input-prefixText">{prefixText}</span>}'), 'the prefix text is shown with its switch and a non-empty text');
    assert.ok(jsx.includes('{((hasSuffix === true) && (String(suffixText ?? "") !== "")) && <span className="input-suffixText">{suffixText}</span>}'), 'the suffix text is shown with its switch and a non-empty text');
    assert.match(jsx, /\{allowClear && value !== '' && <span className="input-clear">×<\/span>\}/);
    assert.match(jsx, /\{showCount && <span className="input-count">\{value\.length\}\{maxLength \? ` \/ \$\{maxLength\}` : ''\}<\/span>\}/);
});

test('codegen writes the border from the variable, the placeholder rule, and status selectors guarded on the wrapper', () => {
    const { files } = generateComponent(INPUT, model.binding, variables, 'Input', master(), childrenOf(master(), valueText()));
    const css = files['Input.css'];
    assert.match(css, /\.input \{\n(?:.*\n)*?\s*border-color: var\(--input-border\);\n/);
    assert.match(css, /\.input-label::placeholder \{\n  color: var\(--input-placeholder\);\n\}/);
    assert.match(css, /\[data-status="error"\]/);
    assert.match(css, /:hover:not\(:has\(:disabled\)\)/);
    assert.match(css, /:has\(:focus-visible\):not\(:has\(:disabled\)\)/);
    assert.match(css, /:focus-within:not\(:has\(:disabled\)\)/);
    assert.match(css, /:has\(:disabled\) \{/);
});

test('Play draws a span root with the input, and a bound inside stroke emits no inline border', () => {
    const { root, styles } = toDomTree({ pages: [{ id: 'p', name: 'Screens', nodes: [master(), instance()] }], variables }, 'i1');
    assert.equal(root.tag, 'span');
    assert.equal(root.attrs.class, 'input');
    assert.equal(root.attrs['data-variant'], 'outlined');
    const input = root.children.find(c => c.tag === 'input');
    assert.equal(input.attrs.class, 'input-label');
    assert.equal(input.attrs.value, '');
    assert.equal(root.style.borderWidth, '0px');
    assert.equal(root.style.borderStyle, undefined);
    assert.equal(root.style.borderColor, undefined);
    assert.match(styles, /\.input-label::placeholder \{\n  color: var\(--input-placeholder\);\n\}/);
});

test('Play draws the clear and count parts from their nodes, and only the ones whose node is visible', () => {
    const doc = nodes => ({ pages: [{ id: 'p', name: 'Screens', nodes }], variables });
    // The instance's copies of the clear and count parts, as the engine writes them from the props (see partWrites).
    const part = (name, visible, text) => ({
        id: `i1-${name}`, name, type: 'text', parentId: 'i1', x: 0, y: 0, w: 20, h: 20, text, visible, fills: solid('#8c8297'), fontSize: 14,
        vars: labelVars, sourceId: `m-${name}`, behavior: { version: 2, part: name },
    });
    const shown = toDomTree(doc([master(), instance({}, { value: 'hi', allowClear: true, showCount: true, maxLength: '20' }), part('clear', true, '×'), part('count', true, '2 / 20')]), 'i1').root;
    assert.ok(shown.children.some(c => c.nodeId === 'i1-clear' && c.text === '×'));
    assert.ok(shown.children.some(c => c.nodeId === 'i1-count' && c.text === '2 / 20'));
    const hidden = toDomTree(doc([master(), instance({}, { value: '', allowClear: true }), part('clear', false, '×'), part('count', false, '0')]), 'i1').root;
    // The clear is kept while allowClear is on, hidden while the value is empty (Play shows it as the value is typed); the count is absent.
    const kept = hidden.children.find(c => c.nodeId === 'i1-clear');
    assert.ok(kept && kept.attrs.hidden === true, 'the clear is kept and hidden with an empty value');
    assert.ok(!hidden.children.some(c => c.nodeId === 'i1-count'), 'the count is absent when its node is hidden');
    const off = toDomTree(doc([master(), instance({}, { disabled: true })]), 'i1').root;
    assert.equal(off.children.find(c => c.tag === 'input').attrs.disabled, true);
});

test('binding covers collections, stroke and state modes; the border follows the Status mode through the Variant alias', () => {
    const bare = master({ vars: undefined });
    const bareText = valueText({ vars: undefined });
    const { ops, problems } = planBindTokens({ template: INPUT, binding: model.binding, layers: [{ key: 'root', node: bare }, { key: 'label', node: bareText }], variables });
    assert.deepEqual(problems, []);
    assert.ok(ops.some(o => o.key === 'root' && o.varKey === 'stroke' && o.itemId === 'v-border'));
    const at = (preview, combo = { size: 'middle', variant: 'outlined', status: 'default' }) =>
        previewOf(INPUT, model.binding, combo, variables, { value: '', placeholder: '', maxLength: '', allowClear: false, showCount: false, hasPrefix: false, hasSuffix: false, prefixIcon: null, suffixIcon: null, prefixText: '', suffixText: '', disabled: false, readOnly: false }, preview).vars;
    assert.equal(at('default')['--input-border'], '#d9d9d9');
    assert.equal(at('default', { size: 'middle', variant: 'outlined', status: 'error' })['--input-border'], '#ff4d4f');
    assert.equal(at('hover')['--input-border'], '#4096ff');
    assert.equal(at('focus')['--input-border'], '#4096ff');
    assert.equal(at('focus-visible')['--input-outline-color'], '#4096ff33');
    assert.equal(at('default')['--input-bg'], '#ffffff');
});
