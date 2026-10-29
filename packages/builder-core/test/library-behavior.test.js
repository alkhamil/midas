import assert from 'node:assert/strict';
import { test } from 'node:test';
import { transformSync } from 'esbuild';
import { behaviorFor, buildPropsMap, libraryPackage, RUNTIME } from '../src/index.js';

const set = (name, axes) => {
    const holder = { id: 's', name, componentSet: true, cprops: [] };
    const combos = Object.entries(axes).reduce((acc, [k, vals]) => acc.flatMap(a => vals.map(v => ({ ...a, [k]: v }))), [{}]);
    const kids = combos.map((variant, i) => ({ id: `v${i}`, parentId: 's', component: true, variant, name: Object.entries(variant).map(([k, v]) => `${k}=${v}`).join(', ') }));
    return { name, exportName: name.replace(/\s+/g, ''), props: buildPropsMap(holder, kids).props };
};
const valid = (file, code) => assert.doesNotThrow(() => transformSync(code, { loader: file.endsWith('.tsx') ? 'tsx' : 'ts', jsx: 'automatic' }), `${file} is valid`);

test('behaviorFor: a Checkbox keeps its checked state, is controlled or not, and answers to the keyboard', () => {
    const b = behaviorFor(set('Checkbox', { State: ['Default', 'Hover', 'Focus', 'Disabled'], Checked: ['Unchecked', 'Checked', 'Indeterminate'] }));
    assert.equal(b.kit, 'kit');
    const tsx = b.files['src/behavior/Checkbox.tsx'];
    assert.match(tsx, /onCheckedChange/);
    assert.match(tsx, /useControllable/);
    assert.match(tsx, /role|'checkbox'/);
    assert.match(b.files['dist/behavior/Checkbox.d.ts'], /export declare function Checkbox\(props: CheckboxProps\)/);
    assert.match(b.files['dist/behavior/Checkbox.d.ts'], /onCheckedChange\?: \(checked: boolean\) => void/);
    assert.ok(b.props.some(p => p.name === 'checked' && p.type === 'boolean'), 'the documented props are the ones a developer uses');
    for (const [f, code] of Object.entries(b.files)) if (f.startsWith('src/')) valid(f, code);
});

test('behaviorFor: any component with a State gets hover / pressed / focus / disabled, one without stays as drawn', () => {
    const badge = behaviorFor(set('Chip', { State: ['Default', 'Hover', 'Pressed'], Tone: ['Soft', 'Solid'] }));
    assert.equal(badge.kit, 'generic');
    assert.match(badge.files['src/behavior/Chip.tsx'], /const STATES = \["default","hover","pressed"\]/);
    assert.ok(badge.props.some(p => p.name === 'disabled'));
    assert.equal(behaviorFor(set('Pagination', { Position: ['First', 'Middle', 'Last'] })), null);
});

const withText = (name, axes, texts) => {
    const holder = { id: 's', name, componentSet: true, cprops: texts.map((t, i) => ({ id: `c${i}`, name: t, type: 'text', def: '' })) };
    const combos = Object.entries(axes).reduce((acc, [k, vals]) => acc.flatMap(x => vals.map(v => ({ ...x, [k]: v }))), [{}]);
    const kids = combos.map((variant, i) => ({ id: `v${i}`, parentId: 's', component: true, variant }));
    return { name, exportName: name.replace(/\s+/g, ''), props: buildPropsMap(holder, kids).props };
};

test('behaviorFor: text fields become real inputs, a Select opens a list, a form item takes the control as children', () => {
    const field = behaviorFor(withText('Text Field', { State: ['Default', 'Focus', 'Error'], Value: ['Empty', 'Filled'] }, ['Value', 'Placeholder']));
    assert.equal(field.kit, 'kit');
    assert.deepEqual([...field.inputs.layers], ['Value', 'Placeholder']);
    assert.equal(field.inputs.tag, 'input');
    assert.match(field.files['src/behavior/TextField.tsx'], /inputProps/);
    assert.match(field.files['dist/behavior/TextField.d.ts'], /onValueChange\?: \(value: string\) => void/);
    assert.equal(behaviorFor(withText('Textarea', { State: ['Default'], Value: ['Empty'] }, ['Value', 'Placeholder'])).inputs.tag, 'textarea');

    const select = behaviorFor(withText('Select', { Mode: ['Single', 'Multiple'], State: ['Default', 'Open'], Value: ['Empty', 'Filled'] }, ['Value', 'Placeholder']));
    assert.equal(select.kit, 'kit');
    assert.match(select.files['src/behavior/Select.tsx'], /role: 'listbox'/);
    assert.match(select.files['src/behavior/Select.tsx'], /createPortal/, 'the list is not clipped by a parent');
    assert.ok(select.props.some(p => p.name === 'options' && p.ts === 'SelectOption[]' && Array.isArray(p.demo)), 'the documentation passes options to the preview');

    const item = behaviorFor(withText('Form Item', { State: ['Default', 'Error'], Control: ['Text Field', 'Select'] }, ['Label']));
    assert.deepEqual([...item.slot], ['TextField', 'Textarea', 'Select']);
    assert.ok(item.props.some(p => p.name === 'children'));
    for (const b of [field, select, item]) for (const [f, code] of Object.entries(b.files)) if (f.startsWith('src/')) valid(f, code);
});

test('libraryPackage: the exported components are the ones with behaviour, the runtime is part of the package', () => {
    const states = ['Default', 'Hover'];
    const comp = (id, name) => ({ id, name, set: true, nodes: [
        { id, parentId: null, type: 'frame', componentSet: true, name, cprops: [] },
        ...states.flatMap((s, i) => [{ id: `${id}${i}`, parentId: id, type: 'frame', component: true, name: `State=${s}`, variant: { State: s }, layout: 'horizontal', w: 40, h: 20, fill: '#FFF' }]),
    ] });
    const out = libraryPackage({ components: [comp('a', 'Button'), comp('b', 'Panel')], variables: { collections: [], items: [] } });
    assert.ok('src/behavior/runtime.tsx' in out.files && out.files['src/behavior/runtime.tsx'] === RUNTIME);
    assert.ok('src/behavior/Button.tsx' in out.files, 'a Button is pressable');
    assert.match(out.files['src/behavior/index.ts'], /export \{ Button \} from '\.\/Button'/);
    assert.match(out.files['src/index.ts'], /export \* from '\.\/behavior'/);
    assert.ok(!/export \* from '\.\/components'/.test(out.files['src/index.ts']), 'the drawn views are not exported next to the working components');
    assert.equal(out.components.find(c => c.exportName === 'Button').interactive, true);
    assert.ok(out.classes.length > 0);
    for (const [f, code] of Object.entries(out.files)) if (/^src\/.*\.tsx?$/.test(f)) valid(f, code);
});
