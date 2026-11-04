import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { previewOf } from '../src/behavior-engine/preview.js';
import { planBindTokens, applyBindTokens } from '../src/behavior-engine/bind-tokens.js';
import { applyTemplateToFrame, masterLayersByKey } from '../src/behavior-engine/template-master.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { INPUT } from '../src/templates/input.js';
import { setInstanceProp } from '../src/behavior-engine/instance-props.js';
import { counterLabel } from '../src/behavior-engine/display.js';
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

const MODES = { 'c-variant': 'outlined', 'c-status': 'default', 'c-size': 'md' };

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
    assert.match(validateTemplateSchema(badMaxlength).join('\n'), /control maxlength "disabled" is not a number prop/);
});

test('codegen writes a span root with data modes, an input with its props, and affix spans', () => {
    const { files } = generateComponent(INPUT, model.binding, variables, 'Input', master(), childrenOf(master(), valueText()));
    const jsx = files['Input.jsx'];
    assert.match(jsx, /<span/);
    assert.match(jsx, /className="input"/);
    assert.match(jsx, /data-variant=\{variant\}/);
    assert.match(jsx, /data-status=\{status\}/);
    assert.match(jsx, /data-size=\{size\}/);
    assert.match(jsx, /<input className="input-label" value=\{value\} placeholder=\{String\(value \?\? ""\) === "" && readOnly !== true \? placeholder : undefined\} readOnly=\{readOnly\} maxLength=\{maxLength\} minLength=\{minLength\} disabled=\{disabled \|\| readOnly\} \/>/);
    assert.ok(jsx.includes('{((hasPrefix === true) && (prefixKind === "text") && (String(prefixText ?? "") !== "")) && <span className="input-prefixText">{prefixText}</span>}'), 'the prefix text is shown with its switch, the Text kind and a non-empty text');
    assert.ok(jsx.includes('{((hasSuffix === true) && (suffixKind === "text") && (String(suffixText ?? "") !== "")) && <span className="input-suffixText">{suffixText}</span>}'), 'the suffix text is shown with its switch, the Text kind and a non-empty text');
    assert.match(jsx, /\{allowClear && value !== '' && <span className="input-clear">\{clearIcon\}<\/span>\}/);
    assert.match(jsx, /\{showCount && <span className="input-count">\{value\.length\}\{maxLength != null \? ` \/ \$\{maxLength\}` : ''\}<\/span>\}/);
});

test('the outline follows the outline-width variable, and vanishes when it no longer exceeds the border', () => {
    const sized = (token, value) => ({
        collections: model.collections,
        items: model.items.map(i => i.name === token
            ? { ...i, values: Object.fromEntries(model.collections.find(c => c.name === 'Input Size').modes.map(m => [m.id, value])) }
            : i),
    });
    const gen = vars => generateComponent(INPUT, model.binding, vars, 'Input', master(), childrenOf(master(), valueText())).files['Input.css'];
    assert.match(gen(sized('outlineWidth', 3)), /\.input \{\n(?:.*\n)*?\s*outline: 3px solid var\(--input-outline-color\);\n\s*outline-offset: -1px;/);
    assert.match(gen(sized('borderWidth', 2)), /\.input \{\n(?:.*\n)*?\s*outline: none;/);
});

test('the border follows its variable in every combo, and no other state touches the border width', () => {
    const { files } = generateComponent(INPUT, model.binding, variables, 'Input', master(), childrenOf(master(), valueText()));
    assert.match(files['Input.css'], /--input-border-width: 1px;/);
    for (const m of files['Input.css'].matchAll(/^([^{]+)\{([^}]*)\}/gm)) {
        const [sel, body] = [m[1], m[2]];
        if ((/:(hover|active)|:disabled|\[data-blocked\]/.test(sel)) && !/:focus/.test(sel)) {
            assert.doesNotMatch(body, /border-width|--input-border-width/, `a non-focus state must not touch the border width: ${sel.trim()}`);
        }
    }
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

test('Play draws a span root with the input, and a bound inside stroke draws on the host with no inline colour', () => {
    const { root, styles } = toDomTree({ pages: [{ id: 'p', name: 'Screens', nodes: [master(), instance()] }], variables }, 'i1');
    assert.equal(root.tag, 'span');
    assert.equal(root.attrs.class, 'input');
    assert.equal(root.attrs['data-variant'], 'outlined');
    const input = root.children.find(c => c.tag === 'input');
    assert.equal(input.attrs.class, 'input-label');
    assert.equal(input.attrs.value, '');
    assert.equal(root.style.borderWidth, '1px');
    assert.equal(root.style.borderStyle, 'solid');
    assert.equal(root.style.borderColor, undefined);
    assert.match(styles, /\.input-label::placeholder \{\n  color: var\(--input-placeholder\);\n\}/);
});

test('Play draws the clear icon from its managed slot, kept and hidden while the value is empty, and the count from its node', () => {
    const doc = nodes => ({ pages: [{ id: 'p', name: 'Screens', nodes }], variables });
    // The instance's copies, as the engine writes them: the clear icon's slot layer (shown while its value is set) and the count part.
    const clearSlot = visible => ({ id: 'i1-clear', name: 'clear', type: 'frame', parentId: 'i1', x: 0, y: 0, w: 14, h: 14, visible, layout: 'none', fills: [], behavior: { version: 2, slot: 'clear' } });
    const count = visible => ({
        id: 'i1-count', name: 'count', type: 'text', parentId: 'i1', x: 0, y: 0, w: 20, h: 20, text: '2 / 20', visible, fills: solid('#8c8297'), fontSize: 14,
        vars: labelVars, sourceId: 'm-count', behavior: { version: 2, part: 'count' },
    });
    const shown = toDomTree(doc([master(), instance({}, { value: 'hi', allowClear: true, showCount: true, maxLength: 20 }), clearSlot(true), count(true)]), 'i1').root;
    const icon = shown.children.find(c => c.nodeId === 'i1-clear');
    assert.ok(icon && icon.attrs['data-role'] === 'clear' && icon.attrs.hidden === false, 'the clear icon is drawn with a value');
    assert.equal(icon.style.cursor, undefined, 'the cursor comes from the class');
    assert.match(toDomTree(doc([master(), instance({}, { value: 'hi', allowClear: true }), clearSlot(true)]), 'i1').styles, /\.input-clear \{[^}]*cursor: pointer;/, 'the clear icon has the hand cursor, as a button does');
    assert.ok(shown.children.some(c => c.nodeId === 'i1-count' && c.text === '2 / 20'));
    // With an empty value the clear layer is hidden on the canvas; Play keeps it, hidden, so typing shows it.
    const hidden = toDomTree(doc([master(), instance({}, { value: '', allowClear: true }), clearSlot(false), count(false)]), 'i1').root;
    const kept = hidden.children.find(c => c.nodeId === 'i1-clear');
    assert.ok(kept && kept.attrs.hidden === true, 'the clear icon is kept and hidden with an empty value');
    assert.ok(!hidden.children.some(c => c.nodeId === 'i1-count'), 'the count is absent when its node is hidden');
    const off = toDomTree(doc([master(), instance({}, { disabled: true })]), 'i1').root;
    assert.equal(off.children.find(c => c.tag === 'input').attrs.disabled, true);
    assert.equal(off.children.some(c => c.attrs?.['data-role'] === 'clear'), false, 'no clear icon without Allow Clear');
});

test('a new, a matched and a rebound master carry identical placeholder and count bindings', () => {
    let n = 0;
    const idOf = key => `n-${key}-${++n}`;
    const blankFrame = () => ({ id: `f-${++n}`, name: 'Input', type: 'frame', parentId: null, component: true, layout: 'horizontal', gap: 0, padding: 0, x: 0, y: 0, w: 200, h: 40, fills: [], layoutSizingH: 'hug', layoutSizingV: 'hug' });
    const textLayer = frame => ({ id: `t-${++n}`, name: 'Value', type: 'text', parentId: frame.id, text: 'hello', x: 0, y: 0, w: 60, h: 20, fills: [], fontFamily: 'Inter', fontSize: 14, fontWeight: 400, fontStyle: 'normal', lineHeight: 1.4, letterSpacing: 0, textAlign: 'left', textDecoration: 'none', textCase: 'none', direction: 'auto', autoW: true, layoutSizingH: 'hug', layoutSizingV: 'hug' });
    const varsByName = nodes => Object.fromEntries(nodes.filter(l => l.vars).map(l => [l.name, l.vars]));
    // Create: the generator on an empty frame.
    const created = applyTemplateToFrame(INPUT, { frame: blankFrame(), children: [], binding: model.binding, variables, idOf });
    const createdVars = varsByName(created.created);
    assert.deepEqual(createdVars.placeholder, { 'fills.0': 'v-placeholder', typography: 's-placeholderTypography' });
    assert.deepEqual(createdVars.count, { 'fills.0': 'v-placeholder', typography: 's-countTypography' });
    // The typography lives in the Size collection, the color in the Variant collection.
    const collectionOf = id => variables.collections.find(c => c.id === variables.items.find(i => i.id === id).collectionId).name;
    assert.equal(collectionOf('s-placeholderTypography'), 'Input Size');
    assert.equal(collectionOf('s-countTypography'), 'Input Size');
    assert.equal(collectionOf('v-placeholder'), 'Input Variant');
    // Bind-frame: the generator on a frame that already holds a text layer.
    const frame2 = blankFrame(), existing = [textLayer(frame2)];
    const bound = applyTemplateToFrame(INPUT, { frame: frame2, children: existing, binding: model.binding, variables, idOf });
    const createdVars2 = varsByName(bound.created);
    assert.deepEqual(createdVars2.placeholder, createdVars.placeholder);
    assert.deepEqual(createdVars2.count, createdVars.count);
    // The pre-existing text layer is matched as the label and bound the same way.
    const labelHit = bound.matched.find(m => m.key === 'label');
    assert.deepEqual(existing.find(e => e.id === labelHit.nodeId).vars, createdVars.label);
    // Bind-component: the generator's layer list over an unbound master, then the bind plan.
    const frame3 = blankFrame();
    const made = applyTemplateToFrame(INPUT, { frame: frame3, children: [], binding: model.binding, variables, idOf });
    const nodes = [frame3, ...made.created];
    for (const node of nodes) delete node.vars;
    const layers = masterLayersByKey(INPUT, frame3, nodes);
    assert.deepEqual(layers.map(l => l.key).sort(), ['count', 'label', 'placeholder', 'prefixText', 'root', 'suffixText']);
    const planned = planBindTokens({ template: INPUT, binding: model.binding, layers, variables });
    assert.deepEqual(planned.problems, []);
    applyBindTokens(layers, planned.ops);
    assert.deepEqual(varsByName(nodes.filter(x => x !== frame3)), createdVars);
});

test('binding an auto-layout frame to Input takes the fixed 343px width; rebinding keeps the designer width', () => {
    let n = 0;
    const blankFrame = () => ({ id: `f-${++n}`, name: 'Input', type: 'frame', parentId: null, component: true, layout: 'horizontal', gap: 0, padding: 0, x: 0, y: 0, w: 200, h: 40, fills: [], layoutSizingH: 'hug', layoutSizingV: 'hug' });
    const frame = blankFrame();
    const first = applyTemplateToFrame(INPUT, { frame, children: [], binding: model.binding, variables, idOf: k => `n-${k}-${++n}` });
    assert.equal(frame.w, 343, 'a fresh bind takes the template width even when the frame already lays out');
    assert.equal(frame.layoutSizingH, 'fixed');
    assert.equal(frame.layout, 'horizontal', 'the frame keeps its own layout');
    frame.w = 500;
    frame.layoutSizingH = 'hug';
    applyTemplateToFrame(INPUT, { frame, children: first.created, binding: model.binding, variables, idOf: k => `n-${k}-${++n}` });
    assert.equal(frame.w, 500, 'regenerate keeps the designer width');
    assert.equal(frame.layoutSizingH, 'hug');
});

test('binding covers collections, stroke and state modes; the border follows the Status mode through the Variant alias', () => {
    const bare = master({ vars: undefined });
    const bareText = valueText({ vars: undefined });
    const { ops, problems } = planBindTokens({ template: INPUT, binding: model.binding, layers: [{ key: 'root', node: bare }, { key: 'label', node: bareText }], variables });
    assert.deepEqual(problems, []);
    assert.ok(ops.some(o => o.key === 'root' && o.varKey === 'stroke' && o.itemId === 'v-border'));
    const at = (preview, combo = { size: 'md', variant: 'outlined', status: 'default' }) =>
        previewOf(INPUT, model.binding, combo, variables, { value: '', placeholder: '', maxLength: null, minLength: null, allowClear: false, showCount: false, hasIcon: false, iconPlacement: 'start', icon: null, iconEnd: null, hasPrefix: false, hasSuffix: false, prefixText: '', suffixText: '', disabled: false, readOnly: false }, preview).vars;
    assert.equal(at('default')['--input-border'], '#d9d9d9');
    assert.equal(at('default', { size: 'md', variant: 'outlined', status: 'error' })['--input-border'], '#ff4d4f');
    assert.equal(at('hover')['--input-border'], '#4096ff');
    assert.equal(at('focus')['--input-border'], '#4096ff');
    assert.equal(at('focus-visible')['--input-outline-color'], '#4096ff33');
    assert.equal(at('default')['--input-bg'], '#ffffff');
});

test('a limit is a whole number, 0 or more, or nothing; minLength is never above maxLength', () => {
    assert.equal(setInstanceProp(INPUT, {}, 'maxLength', 5).maxLength, 5);
    assert.equal(setInstanceProp(INPUT, { maxLength: 5 }, 'maxLength', null).maxLength, null);
    assert.throws(() => setInstanceProp(INPUT, {}, 'maxLength', '5'), /Prop "maxLength" on input: expects a whole number/);
    assert.throws(() => setInstanceProp(INPUT, {}, 'maxLength', -1), /expects a whole number/);
    assert.throws(() => setInstanceProp(INPUT, {}, 'minLength', 1.5), /expects a whole number/);
    assert.deepEqual(setInstanceProp(INPUT, { maxLength: 5 }, 'minLength', 3), { maxLength: 5, minLength: 3 });
    assert.throws(() => setInstanceProp(INPUT, { maxLength: 5 }, 'minLength', 6), /Prop "minLength" on input is more than "maxLength"/);
    assert.throws(() => setInstanceProp(INPUT, { minLength: 3 }, 'maxLength', 2), /Prop "minLength" on input is more than "maxLength"/);
});

test('schema: a number prop has a whole-number default or null, and atMost names a number prop', () => {
    const badDefault = structuredClone(INPUT);
    badDefault.props.maxLength.default = '';
    assert.match(validateTemplateSchema(badDefault).join('\n'), /prop "maxLength" is a number but its default is not a whole number, 0 or more, or null/);
    const badBound = structuredClone(INPUT);
    badBound.props.minLength.atMost = 'value';
    assert.match(validateTemplateSchema(badBound).join('\n'), /prop "minLength" atMost must name a number prop/);
});

test('Play carries the limits as native attributes; the counter reads n / max only when there is a maximum', () => {
    const { root } = toDomTree({ pages: [{ id: 'p', name: 'Screens', nodes: [master(), instance({}, { maxLength: 5, minLength: 3 })] }], variables }, 'i1');
    const input = root.children.find(c => c.tag === 'input');
    assert.equal(input.attrs.maxLength, '5');
    assert.equal(input.attrs.minLength, '3');
    const open = toDomTree({ pages: [{ id: 'p', name: 'Screens', nodes: [master(), instance()] }], variables }, 'i1').root.children.find(c => c.tag === 'input');
    assert.equal(open.attrs.maxLength, undefined);
    assert.equal(open.attrs.minLength, undefined);
    assert.equal(counterLabel('abc', null), '3');
    assert.equal(counterLabel('abc', 5), '3 / 5');
    assert.equal(counterLabel('abc', 0), '3 / 0');
});
