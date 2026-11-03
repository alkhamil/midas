// The export of a slot that repeats (`repeat` names a number prop): the component draws the slot's children `n` times in one slot element, `n` being the
// prop clamped to a whole number of 0 or more (a value that is not finite is the schema's default for the prop, 0 when it has none). With no copies the slot
// is empty: its element follows showEmpty. The generated markup gives no element an id (nor does Play), so copies never share one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';

const list = TEMPLATES.get('list');
const emit = (template = list) => generateComponent(template, { variables: {} }, { collections: [], items: [] }, 'List', { id: 'm', type: 'frame', layout: 'vertical' }, () => []);
const withSlot = over => ({ ...structuredClone(list), slots: [{ ...list.slots[0], ...over }] });

test('a List is List.tsx with itemCount typed as a number, 3 by default, and the item copies in one slot element', () => {
    const { files, problems } = emit();
    assert.deepEqual(problems, []);
    assert.deepEqual(Object.keys(files).sort(), ['List.css', 'List.tsx']);
    const tsx = files['List.tsx'];
    assert.match(tsx, /^import \{ Fragment, forwardRef \} from 'react';/);
    assert.match(tsx, /itemCount\?: number;/);
    assert.match(tsx, /itemCount = 3/);
    assert.match(tsx, /children\?: ReactNode;/);
    assert.match(tsx, /const itemCopies = filled\(children\) \? copies\(itemCount, 3\) : 0;/);
    assert.match(tsx, /<div className="list-item">\{Array\.from\(\{ length: itemCopies \}, \(_, i\) => <Fragment key=\{i\}>\{children\}<\/Fragment>\)\}<\/div>/, 'showEmpty: the element is always there');
});

test('a number prop whose default is null is typed number | null, and its fallback is 0', () => {
    const tsx = emit({ ...structuredClone(list), props: { ...list.props, itemCount: { source: 'literal', type: 'number', default: null } } }).files['List.tsx'];
    assert.match(tsx, /itemCount\?: number \| null;/);
    assert.match(tsx, /copies\(itemCount, 0\)/);
});

test('copies clamps to a whole number of 0 or more; a value that is not finite is the schema default', () => {
    const tsx = emit().files['List.tsx'];
    const body = tsx.slice(tsx.indexOf('function copies'));
    const copies = new Function(`${body.replace(/count: number \| null \| undefined, fallback: number\): number/, 'count, fallback)')}; return copies;`)();
    assert.equal(copies(3, 3), 3);
    assert.equal(copies(0, 3), 0);
    assert.equal(copies(2.9, 3), 2);
    assert.equal(copies(-4, 3), 0);
    for (const bad of [NaN, Infinity, -Infinity, null, undefined]) assert.equal(copies(bad, 3), 3, String(bad));
});

test('a repeating slot without showEmpty has no element at all when there are no copies; with showEmpty the element stays, empty', () => {
    assert.match(emit(withSlot({ showEmpty: false })).files['List.tsx'], /\{itemCopies > 0 && <div className="list-item">/);
    assert.doesNotMatch(emit().files['List.tsx'], /itemCopies > 0 &&/);
});

test('a slot that does not repeat is exactly what it was: no Fragment, no copies helper', () => {
    const plain = emit(withSlot({ repeat: undefined })).files['List.tsx'];
    assert.doesNotMatch(plain, /Fragment|copies/);
    assert.match(plain, /^import \{ forwardRef \} from 'react';/);
});

test('the generated markup gives no element an id, so repeated copies share none', () => {
    const { files } = emit();
    assert.doesNotMatch(files['List.tsx'], /\bid=|data-node-id/);
    assert.doesNotMatch(files['List.css'], /#\w/);
});
