// The export of a template that declares content `slots`: a typed `<Name>.tsx` (play-from-tsx.md 2.1 conventions: forwardRef, className merged after the
// template class, style, rest props, ref on the root) with the slot as `children: ReactNode` (one slot) or named ReactNode props (several), an element
// per slot that is emitted when its prop holds something (always, empty, with showEmpty), and the slot's own auto layout as its CSS. A template without
// slots keeps its untyped `.jsx`. Content slots only: the icon-slot rules (iconSize, fg) never reach a slot element.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { BUTTON } from '../src/templates/button.js';
import { buttonModel } from '../../../scripts/button-model.mjs';
import { inputModel } from '../../../scripts/input-model.mjs';

const model = buttonModel({ colors: ['primary'], variantModes: ['solid'] });
const variables = { collections: model.collections, items: model.items };
const HEADER = { id: 'header', name: 'Header', layout: 'horizontal' };
const BODY = { id: 'body', name: 'Body', layout: 'vertical', showEmpty: true };
const only = { id: 'content', name: 'Content', layout: 'vertical' };
const template = (...slots) => ({ ...structuredClone(BUTTON), id: 'cardtest', name: 'CardTest', slots });
const master = { id: 'm', type: 'frame', layout: 'horizontal', primaryAlign: 'center', counterAlign: 'center' };
const frames = [
    { id: 'h', parentId: 'm', type: 'frame', propBind: { slot: 'header' }, layout: 'horizontal', gap: 8, padding: 4, w: 0, h: 0, layoutSizingH: 'hug', layoutSizingV: 'hug' },
    { id: 'b', parentId: 'm', type: 'frame', propBind: { slot: 'body' }, layout: 'vertical', gap: 2, padding: 0, w: 0, h: 0, layoutSizingH: 'hug', layoutSizingV: 'hug' },
];
const kids = id => (id === 'm' ? frames : []);
const emit = (t, childrenOf = kids) => generateComponent(t, model.binding, variables, 'CardTest', master, childrenOf);
const tsxOf = (...slots) => emit(template(...slots)).files['CardTest.tsx'];

test('a template with slots is written as a .tsx and a .css, and a template without slots keeps its untyped .jsx', () => {
    assert.deepEqual(Object.keys(emit(template(HEADER)).files).sort(), ['CardTest.css', 'CardTest.tsx']);
    assert.deepEqual(Object.keys(generateComponent(TEMPLATES.get('button'), model.binding, variables, 'Button', master, () => []).files).sort(), ['Button.css', 'Button.jsx']);
    const plain = generateComponent(TEMPLATES.get('button'), model.binding, variables, 'Button', master, () => []).files['Button.jsx'];
    assert.doesNotMatch(plain, /forwardRef|ReactNode|children/);
});

test('the component follows the TSX conventions: typed props, forwardRef, className after the template class, style and rest props on the root, ref on the root', () => {
    const tsx = tsxOf(HEADER);
    assert.match(tsx, /^import \{ forwardRef \} from 'react';\nimport type \{[^}]*ReactNode[^}]*\} from 'react';\nimport '\.\/CardTest\.css';/);
    assert.match(tsx, /export type CardTestProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, [^>]*> & \{/);
    assert.match(tsx, /export const CardTest = forwardRef<HTMLButtonElement, CardTestProps>\(function CardTest\(\{ [^}]*className, style, [^}]*\.\.\.rest \}, ref\) \{/);
    assert.match(tsx, /className=\{\['cardtest', className\]\.filter\(Boolean\)\.join\(' '\)\}/);
    assert.match(tsx, /\bref=\{ref\}/);
    assert.match(tsx, /\bstyle=\{style\}/);
    assert.match(tsx, /\{\.\.\.rest\}/);
    assert.match(tsx, /className\?: string;/);
    assert.match(tsx, /style\?: CSSProperties;/);
});

test('the props are typed from the schema: a variable prop is a string, a literal its type, an enum its union, an icon a ReactNode, an event its DOM handler', () => {
    const tsx = tsxOf(HEADER);
    for (const line of ['variant?: string;', 'color?: string;', 'size?: string;', 'label?: string;', 'hasIcon?: boolean;', "iconPlacement?: 'start' | 'end';", 'icon?: ReactNode;', 'iconEnd?: ReactNode;', 'loading?: boolean;', 'disabled?: boolean;', 'onClick?: MouseEventHandler<HTMLButtonElement>;', 'onHover?: MouseEventHandler<HTMLButtonElement>;', 'onFocus?: FocusEventHandler<HTMLButtonElement>;', 'onBlur?: FocusEventHandler<HTMLButtonElement>;'])
        assert.ok(tsx.includes(line), line);
    assert.match(tsx, /label = "Button"/);
    assert.match(tsx, /iconPlacement = "start"/);
});

test('one slot is `children: ReactNode`; several are named ReactNode props with the schema id, and children is then not a prop', () => {
    const one = tsxOf(only);
    assert.match(one, /children\?: ReactNode;/);
    assert.doesNotMatch(one, /\bcontent\?:/);
    assert.match(one, /\{ [^}]*children[^}]*\}, ref\)/);
    const many = tsxOf(HEADER, BODY);
    assert.match(many, /header\?: ReactNode;/);
    assert.match(many, /body\?: ReactNode;/);
    assert.doesNotMatch(many, /children\?: ReactNode/);
    assert.match(many, /Omit<ButtonHTMLAttributes<HTMLButtonElement>, [^>]*'children'/, 'the element\'s own children is replaced');
});

test('each slot is an element of the component, after the other layers and in schema order, guarded by whether its prop holds something', () => {
    const tsx = tsxOf(HEADER, BODY);
    const label = tsx.indexOf('<span className="cardtest-label">');
    const iconEnd = tsx.indexOf('cardtest-iconEnd');
    const header = tsx.indexOf('<div className="cardtest-header">{header}</div>');
    const body = tsx.indexOf('<div className="cardtest-body">{body}</div>');
    assert.ok(label > 0 && iconEnd > label && header > iconEnd && body > header, 'label, iconEnd, header, body');
    assert.match(tsx, /\{filled\(header\) && <div className="cardtest-header">\{header\}<\/div>\}/);
});

test('a slot with showEmpty is always emitted, empty when its prop is; one without it is emitted only when its prop holds something', () => {
    const tsx = tsxOf(HEADER, BODY);
    assert.match(tsx, /^\s*<div className="cardtest-body">\{body\}<\/div>$/m, 'showEmpty: no guard');
    assert.match(tsx, /\{filled\(header\) && /, 'no showEmpty: guarded');
    assert.doesNotMatch(tsx, /filled\(body\)/);
    const allShown = tsxOf({ ...HEADER, showEmpty: true });
    assert.doesNotMatch(allShown, /filled/, 'no guard, so no helper');
});

test('filled says what ReactNode holds something: not undefined, null, a boolean or an empty string, and an array when one of its items does', () => {
    const tsx = tsxOf(HEADER);
    const body = tsx.slice(tsx.indexOf('function filled'));
    // The helper is plain TypeScript in the component's file; run it to see what it answers.
    const filled = new Function(`${body.replace('node: ReactNode', 'node').replace('): boolean', ')')}; return filled;`)();
    for (const empty of [undefined, null, false, true, '', [], [null, false, '']]) assert.equal(filled(empty), false, JSON.stringify(empty));
    for (const full of ['x', 0, [null, 'x'], {}]) assert.equal(filled(full), true, JSON.stringify(full));
});

test('the slot element is laid out by the slot frame of the master: the canvas auto layout rules, not the icon rules', () => {
    const css = emit(template(HEADER, BODY)).files['CardTest.css'];
    const rule = name => css.match(new RegExp(`\\.cardtest-${name} \\{([^}]*)\\}`))?.[1] ?? '';
    assert.match(rule('header'), /display: flex;/);
    assert.match(rule('header'), /flex-direction: row;/);
    assert.match(rule('header'), /column-gap: 8px;/);
    assert.match(rule('header'), /padding: 4px 4px 4px 4px;/);
    assert.match(rule('body'), /flex-direction: column;/);
    assert.match(rule('body'), /row-gap: 2px;/);
    assert.doesNotMatch(rule('header') + rule('body'), /icon-size|var\(--cardtest-fg|color:|width: var/);
});

test('a slot whose frame is missing from the master is laid out as its schema says, so the export still draws; Diagnostics report the missing frame', () => {
    const css = emit(template(HEADER, BODY), () => []).files['CardTest.css'];
    assert.match(css, /\.cardtest-header \{[^}]*flex-direction: row;/);
    assert.match(css, /\.cardtest-body \{[^}]*flex-direction: column;/);
});

test('Button and Input files are what they were: the slot work leaves a template without slots untouched', () => {
    const input = inputModel();
    for (const [id, m] of [['button', model], ['input', input]]) {
        const files = generateComponent(TEMPLATES.get(id), m.binding, { collections: m.collections, items: m.items }, TEMPLATES.get(id).name, master, () => []).files;
        assert.deepEqual(Object.keys(files).sort(), [`${TEMPLATES.get(id).name}.css`, `${TEMPLATES.get(id).name}.jsx`]);
        for (const text of Object.values(files)) assert.doesNotMatch(text, /cardtest|filled\(|forwardRef/);
    }
});

test('a root with no disabled attribute (a div) says disabled with aria-disabled, and the disabled state selects on it; a button keeps its attribute', () => {
    const div = emit({ ...template(HEADER), element: { tag: 'div', attrs: {}, disabledState: 'disabled', blockClickProps: [] } });
    assert.match(div.files['CardTest.tsx'], /aria-disabled=\{disabled \|\| undefined\}/);
    assert.doesNotMatch(div.files['CardTest.tsx'], / disabled=\{disabled\}/);
    assert.match(div.files['CardTest.css'], /\[aria-disabled="true"\]/);
    assert.doesNotMatch(div.files['CardTest.css'], /:disabled/);
    const button = emit(template(HEADER));
    assert.match(button.files['CardTest.tsx'], / disabled=\{disabled\}/);
    assert.match(button.files['CardTest.css'], /:disabled/);
});

test('the element type of the root is the DOM\'s for its tag: div and span by name, any other tag from HTMLElementTagNameMap', () => {
    const typeOf = tag => emit({ ...template(HEADER), element: { tag, attrs: {}, disabledState: 'disabled', blockClickProps: [] } }).files['CardTest.tsx'].match(/forwardRef<([^,]+), CardTestProps>/)[1];
    assert.equal(typeOf('div'), 'HTMLDivElement');
    assert.equal(typeOf('span'), 'HTMLSpanElement');
    assert.equal(typeOf('section'), "HTMLElementTagNameMap['section']");
});
