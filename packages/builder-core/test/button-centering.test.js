// Button vertical layout: the height is the Size token, the content centres on one line, and the vertical padding is an explicit
// zero token per size. Runs on the Auto Fix output (Primitives → Semantic → component), so the numbers are the ones a file gets.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    TEMPLATES, createBinding, planAutoFix, applyAutoFix, planFromSnapshot, applyBasePlan, BASE_SNAPSHOT,
    planBindTokens, applyBindTokens, masterLayersOf, generateComponent,
} from '../src/index.js';
import { restOf } from '../src/behavior-engine/tokens.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { BUTTON } from '../src/templates/button.js';

let n = 0;
const uid = () => `c${++n}`;
const button = TEMPLATES.get('button');
const SIZES = ['xs', 'sm', 'md', 'lg', 'xl'];
const HEIGHT = { xs: 16, sm: 24, md: 32, lg: 40, xl: 48 };
const PADDING_X = { xs: 7, sm: 7, md: 15, lg: 15, xl: 15 };

/** The Button after one Auto Fix click on an empty file with the base generated. The master is what the generator makes: its content centred on the cross axis (the template's rootAlign). */
function autoFixedButton() {
    const store = { collections: [], items: [] };
    applyBasePlan(store, planFromSnapshot(BASE_SNAPSHOT), uid);
    const nodes = [];
    const root = {
        id: 'btn', name: 'Button', type: 'frame', component: true, layout: 'horizontal', counterAlign: 'center', x: 0, y: 0, w: 200, h: 40,
        stroke: '#000000', strokeWidth: 1, strokeAlign: 'inside', behavior: null, vars: {},
    };
    nodes.push(root, { id: 'btn-label', name: 'Label', type: 'text', parentId: 'btn', text: 'Button', vars: {} });
    root.behavior = createBinding(button, store.collections);
    const childrenOf = id => nodes.filter(x => x.parentId === id);
    const layers = () => masterLayersOf(root, childrenOf);
    applyAutoFix(store, root.behavior, planAutoFix({ template: button, binding: root.behavior, variables: store, layers: layers() }), uid);
    const bound = planBindTokens({ template: button, binding: root.behavior, layers: layers(), variables: store });
    applyBindTokens(layers(), bound.ops);
    return { store, root, childrenOf };
}

/** The CSS block of one size mode, by its name (the first variant and colour that has it). Selectors carry mode ids. */
function sizeBlock(fixed, css, size) {
    const sizes = fixed.store.collections.find(c => c.name === 'Button Size');
    const id = sizes.modes.find(m => m.name === size).id;
    const match = new RegExp(`\\[data-size="${id}"\\] \\{\\n([\\s\\S]*?)\\n\\}`).exec(css);
    assert.ok(match, `a ${size} block exists`);
    return match[1];
}

const tokenPx = (block, name) => {
    const match = new RegExp(`--button-${name}: (-?[\\d.]+)px;`).exec(block);
    return match ? Number(match[1]) : null;
};

/** Generates the Button from an Auto Fix output, optionally with its icon slots shown. */
function exportOf(fixed, extra = {}) {
    const root = { ...fixed.root, ...extra };
    return generateComponent(button, root.behavior, fixed.store, 'Button', root, fixed.childrenOf);
}

test('the root is border-box, centres its content on the cross axis and takes its height from the Size token', () => {
    const { files } = exportOf(autoFixedButton());
    const root = /\.button \{\n([\s\S]*?)\n\}/.exec(files['Button.css'])[1];
    assert.match(root, /\n {2}box-sizing: border-box;/);
    assert.match(root, /\n {2}height: var\(--button-height\);/);
    assert.match(root, /\n {2}align-items: center;/);
    assert.match(root, /\n {2}padding-block: max\(0px, calc\(var\(--button-padding-y\) - 1px\)\);/);
    assert.match(root, /\n {2}border-width: 1px;/);
});

test('each of the five sizes has its height token and a zero vertical padding; horizontal padding excludes the 1px border', () => {
    const fixed = autoFixedButton();
    const { files } = exportOf(fixed);
    for (const size of SIZES) {
        const block = sizeBlock(fixed, files['Button.css'], size);
        assert.equal(tokenPx(block, 'height'), HEIGHT[size], `${size}: height is the Size token`);
        assert.equal(tokenPx(block, 'padding-y'), 0, `${size}: vertical padding is zero`);
        assert.equal(tokenPx(block, 'padding-x'), PADDING_X[size], `${size}: horizontal padding excludes the border`);
    }
});

test('the vertical padding of every Button size is an explicit axis token that resolves to a zero Primitive through Semantic', () => {
    const { store } = autoFixedButton();
    const size = store.collections.find(c => c.name === 'Button Size');
    const paddingY = store.items.find(i => i.collectionId === size.id && i.name === 'paddingY');
    for (const mode of size.modes) {
        const rest = restOf(paddingY, mode.name, store.items, store.collections);
        assert.ok(rest?.trail.includes('Semantic'), `${mode.name} reaches Semantic`);
        assert.equal(typeof paddingY.values[mode.id].alias, 'string', `${mode.name} is an alias, never a literal`);
        assert.equal(rest.literal, 0, `${mode.name} resolves to a zero Primitive step`);
    }
});

test('the label and both icon slots share one centre line: the root centres them, the slots carry no vertical offset', () => {
    const { files } = exportOf(autoFixedButton());
    const css = files['Button.css'];
    for (const slot of ['button-iconStart', 'button-iconEnd', 'button-label']) {
        const block = new RegExp(`\\.${slot} \\{([\\s\\S]*?)\\}`).exec(css)[1];
        assert.doesNotMatch(block, /margin|align-self|top:|position:|padding/, `${slot} has no vertical offset of its own`);
    }
    const icon = new RegExp('\\.button-iconStart \\{([\\s\\S]*?)\\}').exec(css)[1];
    assert.match(icon, /width: var\(--button-icon-size\);/);
    assert.match(icon, /height: var\(--button-icon-size\);/);
});

test('the codegen renders the icon slots inside the root: start before the label, end after it, both around it', () => {
    const source = exportOf(autoFixedButton()).files['Button.jsx'];
    const at = name => source.indexOf(name);
    assert.ok(at('className="button-iconStart"') > -1 && at('className="button-iconEnd"') > -1, 'both slots are written');
    assert.ok(at('button-iconStart') < at('button-label'), 'the start icon comes before the label');
    assert.ok(at('button-label') < at('button-iconEnd'), 'the end icon comes after the label');
    assert.match(source, /iconPlacement === "start"/);
    assert.match(source, /iconPlacement === "end"/);
});

test('the padding token is the content inset: the 1px stroke is not added to the padding (antd lineWidth is subtracted in the token)', () => {
    const { store } = autoFixedButton();
    const size = store.collections.find(c => c.name === 'Button Size');
    const paddingX = store.items.find(i => i.collectionId === size.id && i.name === 'paddingX');
    const md = size.modes.find(m => m.name === 'md');
    const rest = restOf(paddingX, md.name, store.items, store.collections);
    assert.equal(rest.literal, 15, 'antd paddingInline = paddingContentHorizontal 16 minus lineWidth 1');
});

test('the schema refuses a root alignment other than start, center or end', () => {
    assert.deepEqual(validateTemplateSchema(BUTTON), []);
    assert.match(validateTemplateSchema({ ...BUTTON, rootAlign: 'middle' }).join('\n'), /rootAlign "middle" must be start, center or end/);
});
