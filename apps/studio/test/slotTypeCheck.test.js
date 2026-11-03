// The generated .tsx of a template with content slots, type-checked by the TypeScript compiler (strict, react-jsx) against the real @types/react: the
// emitter's output compiles with no error, and the check fails on a type error (so it measures something). In memory: nothing is written to disk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateComponent, TEMPLATES } from '@midas/builder-core';
import { buttonModel } from '../../../scripts/button-model.mjs';
import { formItemModel } from '../../../scripts/form-item-model.mjs';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const here = path.dirname(fileURLToPath(import.meta.url));

/** The compiler's messages for source files held in memory (next to this test, so `react` and its types resolve from the workspace). */
function typeErrors(files) {
    const virtual = new Map(Object.entries(files).map(([name, text]) => [path.join(here, '__generated__', name), text]));
    virtual.set(path.join(here, '__generated__', 'css.d.ts'), "declare module '*.css';\n");
    const options = { strict: true, noEmit: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, target: ts.ScriptTarget.ES2022, lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'], skipLibCheck: true, types: [] };
    const host = ts.createCompilerHost(options);
    const { fileExists, readFile, getSourceFile } = host;
    host.fileExists = f => virtual.has(path.normalize(f)) || fileExists(f);
    const { directoryExists } = host;
    host.directoryExists = d => path.normalize(d) === path.join(here, '__generated__') || !!directoryExists?.(d);
    host.readFile = f => virtual.get(path.normalize(f)) ?? readFile(f);
    host.getSourceFile = (f, lang, ...rest) => (virtual.has(path.normalize(f)) ? ts.createSourceFile(f, virtual.get(path.normalize(f)), lang) : getSourceFile(f, lang, ...rest));
    const program = ts.createProgram([...virtual.keys()], options, host);
    return ts.getPreEmitDiagnostics(program).map(d => `${d.file ? path.basename(d.file.fileName) : ''}:${d.file ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : 0} ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
}

const button = buttonModel({ colors: ['primary'], variantModes: ['solid'] });
const formItem = formItemModel();
const master = { id: 'm', type: 'frame', layout: 'vertical' };

/** The .tsx a template generates, by file name. */
function tsxOf(template, model, name) {
    const { files, problems } = generateComponent(template, model.binding, { collections: model.collections, items: model.items }, name, master, () => []);
    assert.deepEqual(problems, []);
    return { [`${name}.tsx`]: files[`${name}.tsx`] };
}
const card = (...slots) => ({ ...structuredClone(TEMPLATES.get('button')), id: 'cardtest', name: 'CardTest', element: { tag: 'div', attrs: {}, disabledState: 'disabled', blockClickProps: ['disabled'] }, slots });
const SINGLE = { id: 'content', name: 'Content', layout: 'vertical' };
const HEADER = { id: 'header', name: 'Header', layout: 'horizontal' };
const BODY = { id: 'body', name: 'Body', layout: 'vertical', showEmpty: true };

test('the check measures something: a type error in a generated file is reported', () => {
    const files = tsxOf(TEMPLATES.get('formitem'), formItem, 'FormItem');
    assert.deepEqual(typeErrors(files), []);
    const broken = { 'FormItem.tsx': files['FormItem.tsx'].replace('style?: CSSProperties;', 'style?: number;') };
    assert.ok(typeErrors(broken).length > 0, 'a wrong type for a prop the root uses fails the check');
    assert.ok(typeErrors({ 'FormItem.tsx': files['FormItem.tsx'] + "\nexport const bad: number = 'x';\n" }).some(e => /not assignable to type 'number'/.test(e)));
});

test('FormItem compiles under strict', () => {
    assert.deepEqual(typeErrors(tsxOf(TEMPLATES.get('formitem'), formItem, 'FormItem')), []);
});

test('a template with a single slot, and one with several named slots, compile under strict (Button\'s icons, spinner, events and wave included)', () => {
    assert.deepEqual(typeErrors(tsxOf(card(SINGLE), button, 'CardTest')), []);
    assert.deepEqual(typeErrors(tsxOf(card(HEADER, BODY), button, 'CardTest')), []);
});

test('a consumer\'s use of the component type-checks: slots as children or named props, className, style, ref, and rest props; a wrong prop does not', () => {
    const single = tsxOf(card(SINGLE), button, 'CardTest');
    const multi = tsxOf(card(HEADER, BODY), button, 'CardTest');
    const use = (file, jsx) => ({ ...file, 'use.tsx': `import { createRef } from 'react';\nimport { CardTest } from './CardTest';\nconst ref = createRef<HTMLDivElement>();\nexport const x = ${jsx};\n` });
    assert.deepEqual(typeErrors(use(single, `<CardTest ref={ref} className="a" style={{ color: 'red' }} id="i" label="L" size="md"><b>child</b></CardTest>`)), []);
    assert.deepEqual(typeErrors(use(multi, `<CardTest header={<i />} body="text" data-x="y" />`)), []);
    assert.ok(typeErrors(use(multi, `<CardTest header={{}} />`)).length > 0, 'an object is not a ReactNode');
    assert.ok(typeErrors(use(single, `<CardTest nope="x" />`)).length > 0, 'an unknown prop is refused');
    assert.ok(typeErrors(use(multi, `<CardTest>child</CardTest>`)).length > 0, 'children is not a prop of a template with several slots');
});

/** The List's .tsx (it has no variables). */
const listTsx = () => {
    const { files, problems } = generateComponent(TEMPLATES.get('list'), { variables: {} }, { collections: [], items: [] }, 'List', master, () => []);
    assert.deepEqual(problems, []);
    return { 'List.tsx': files['List.tsx'] };
};

test('List compiles under strict, with itemCount typed number', () => {
    const files = listTsx();
    assert.deepEqual(typeErrors(files), []);
    assert.match(files['List.tsx'], /itemCount\?: number;/);
});

test('the List check measures something: a wrong itemCount type inside the component is reported', () => {
    const broken = { 'List.tsx': listTsx()['List.tsx'].replace('itemCount?: number;', 'itemCount?: string;') };
    assert.ok(typeErrors(broken).some(e => /not assignable to parameter of type/.test(e) || /string/.test(e)), 'string cannot be the count');
    assert.ok(typeErrors({ 'List.tsx': listTsx()['List.tsx'].replace('Math.max(0, Math.floor(n))', "Math.max(0, Math.floor('n'))") }).length > 0);
});

test('a consumer\'s use of List type-checks: itemCount as a number, children, className, ref; a string, null or an unknown prop does not', () => {
    const use = jsx => ({ ...listTsx(), 'use.tsx': `import { createRef } from 'react';\nimport { List } from './List';\nconst ref = createRef<HTMLDivElement>();\nexport const x = ${jsx};\n` });
    assert.deepEqual(typeErrors(use(`<List itemCount={5} className="a" ref={ref} style={{ gap: 4 }}><b>row</b></List>`)), []);
    assert.deepEqual(typeErrors(use(`<List><b>row</b></List>`)), [], 'itemCount is optional: the schema default');
    assert.ok(typeErrors(use(`<List itemCount="5" />`)).length > 0, 'a string is not a count');
    assert.ok(typeErrors(use(`<List itemCount={null} />`)).length > 0, 'the default is 3, so null is not a count');
    assert.ok(typeErrors(use(`<List items={3} />`)).length > 0);
});

test('a consumer\'s use of FormItem type-checks: required, layout, labelWidth, labelGap; a wrong layout, a string width or an unknown prop does not', () => {
    const files = tsxOf(TEMPLATES.get('formitem'), formItem, 'FormItem');
    const use = jsx => ({ ...files, 'use.tsx': `import { FormItem } from './FormItem';\nexport const x = ${jsx};\n` });
    assert.deepEqual(typeErrors(use(`<FormItem label="Email" required layout="horizontal" labelWidth={96} labelGap={12}><input /></FormItem>`)), []);
    assert.deepEqual(typeErrors(use(`<FormItem labelWidth={null} />`)), [], 'none is hug');
    assert.ok(typeErrors(use(`<FormItem layout="diagonal" />`)).length > 0);
    assert.ok(typeErrors(use(`<FormItem labelWidth="wide" />`)).length > 0);
    assert.ok(typeErrors(use(`<FormItem labelGap={null} />`)).length > 0, 'the gap has a default, so none is not a gap');
    assert.ok(typeErrors(use(`<FormItem gap={4} />`)).length > 0, 'there is no gap token or prop but labelGap');
});
