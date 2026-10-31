// Input visual parity with antd: one box owns every box visual. The wrapper (`.input`) owns border, radius,
// background, padding, gap and all interactive/status visuals; the inner control (`.input-label`) owns text only:
// transparent background, no border, no outline and no shadow in every state. Focus and hover styles are emitted on
// the wrapper (`:has(:focus-visible)` with a `:focus-within` fallback), never on the input.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { previewOf } from '../src/behavior-engine/preview.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { INPUT } from '../src/templates/input.js';
import { inputModel } from '../../../scripts/input-model.mjs';

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

function childrenOf(masterNode, text) {
    return id => (id === masterNode.id ? [text] : []);
}

const cssOf = () => generateComponent(INPUT, model.binding, variables, 'Input', master(), childrenOf(master(), valueText())).files['Input.css'];

test('a control schema may name the wrapper as its focus target; anything else is refused', () => {
    assert.deepEqual(validateTemplateSchema(INPUT), []);
    assert.equal(INPUT.focusTarget, 'wrapper');
    const bad = structuredClone(INPUT);
    bad.focusTarget = 'input';
    assert.match(validateTemplateSchema(bad).join('\n'), /focusTarget "input" must be "wrapper"/);
    const noControl = structuredClone(INPUT);
    delete noControl.control;
    noControl.focusTarget = 'wrapper';
    assert.match(validateTemplateSchema(noControl).join('\n'), /focusTarget needs a control/);
});

test('the inner input owns text only: transparent, no border, outline or shadow', () => {
    const css = cssOf();
    const rule = /\.input-label \{(?<body>[^}]*)\}/.exec(css)?.groups?.body ?? '';
    for (const decl of ['background: transparent', 'border: none', 'outline: none', 'box-shadow: none', 'padding: 0', 'margin: 0', 'border-radius: 0', 'appearance: none', 'font: inherit']) {
        assert.ok(rule.includes(decl), `.input-label sets ${decl}`);
    }
    assert.ok(rule.includes('color: var(--input-fg)'), 'text colour comes from the text token');
    assert.ok(!/border-width|border-color|border-style/.test(rule), 'no border width, colour or style on the input');
});

test('no state selector targets the inner input: exactly one element carries a border', () => {
    const css = cssOf();
    assert.ok(!/\.input-label:(?!:placeholder)/.test(css), 'no hover, focus or disabled rule on the input');
    assert.ok(/\.input \{[^}]*border-width: 1px/.test(css), 'the wrapper carries the border');
});

test('hover and focus styles are emitted on the wrapper, never on the input', () => {
    const css = cssOf();
    const combo = '.input[data-variant="outlined"][data-status="default"][data-size="middle"]';
    assert.ok(css.includes(`${combo}:hover:not(:has(:disabled))`), 'hover on the wrapper, guarded');
    assert.ok(css.includes(`${combo}:has(:focus-visible):not(:has(:disabled))`), 'focus-visible reaches the wrapper');
    assert.ok(css.includes(`${combo}:focus-within:not(:has(:disabled))`), 'focus-within fallback on the wrapper');
    assert.ok(!css.includes(`${combo}:focus-visible:not(:disabled)`), 'no dead focus-visible rule on the wrapper');
    assert.ok(!css.includes(`${combo}:focus:not(:disabled)`), 'no dead focus rule on the wrapper');
});

test('the disabled wrapper reflects the inner input state, with no ring', () => {
    const css = cssOf();
    const combo = '.input[data-variant="outlined"][data-status="default"][data-size="middle"]';
    assert.ok(css.includes(`${combo}:has(:disabled)`), 'disabled shows on the wrapper');
    assert.ok(!new RegExp(combo.replace(/[[\]]/g, '\\$&') + ':disabled[^:]').test(css), 'no dead disabled rule on the wrapper');
});

test('wrapper height and font metrics differ per Size mode', () => {
    const css = cssOf();
    const varsOf = size => Object.fromEntries([...css.matchAll(new RegExp(`\\.input\\[data-variant="outlined"\\]\\[data-status="default"\\]\\[data-size="${size}"\\] \\{([^}]*)\\}`, 'g'))].flatMap(m => [...m[1].matchAll(/--input-([a-z-]+): ([^;]+);/g)].map(x => [x[1], x[2]])));
    const large = varsOf('large'), middle = varsOf('middle'), small = varsOf('small');
    assert.ok(large.height && middle.height && small.height, 'height is set per size');
    assert.ok(new Set([large.height, middle.height, small.height]).size === 3, 'heights differ');
    assert.ok(new Set([large['font-size'], middle['font-size'], small['font-size']]).size >= 2, 'font sizes differ');
    assert.ok(new Set([large['line-height'], middle['line-height'], small['line-height']]).size >= 2, 'line heights differ');
});

test('status switches the wrapper colours and focus keeps the status colour', () => {
    const css = cssOf();
    const errorBase = /\.input\[data-variant="outlined"\]\[data-status="error"\]\[data-size="middle"\] \{([^}]*)\}/.exec(css)?.[1] ?? '';
    assert.ok(errorBase.includes('--input-border: #ff4d4f'), 'error border on the wrapper');
    const vars = (preview, combo) => previewOf(INPUT, model.binding, combo, variables, { value: '', placeholder: '', maxLength: '', allowClear: false, showCount: false, hasIcon: false, iconPlacement: 'start', prefixIcon: null, suffixIcon: null, addonBefore: '', addonAfter: '', disabled: false, readOnly: false }, preview).vars;
    const combo = { size: 'middle', variant: 'outlined', status: 'error' };
    assert.equal(vars('focus', combo)['--input-border'], '#ff4d4f', 'focus keeps the error border');
    assert.equal(vars('focus-visible', combo)['--input-outline-color'], '#ff4d4f33', 'the ring keeps the error colour');
});

test('the prefix icon and the text share the wrapper vertical center line', () => {
    const centered = master({ counterAlign: 'center' });
    const { files } = generateComponent(INPUT, model.binding, variables, 'Input', centered, childrenOf(centered, valueText()));
    assert.ok(/\.input \{[^}]*align-items: center/.test(files['Input.css']), 'codegen centers the wrapper children');
    const inst = {
        id: 'i1', name: 'Search', type: 'frame', parentId: null, x: 0, y: 0, w: 200, h: 40, isInstance: true, sourceId: 'm',
        behavior: { version: 2, props: {} }, varModes: { 'c-variant': 'outlined', 'c-status': 'default', 'c-size': 'middle' },
        fills: solid('#ffffff'), radius: 6, stroke: '#000000', strokeWidth: 1, strokeAlign: 'inside', vars: rootVars,
    };
    const { root } = toDomTree({ pages: [{ id: 'p', name: 'Screens', nodes: [centered, valueText(), inst] }], variables }, 'i1');
    assert.equal(root.style.alignItems, 'center', 'Play centers the wrapper children');
});
