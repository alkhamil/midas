// The Input's sides in Play and in the export: prefix and suffix are the only side slots, each off, Text or Icon. Four combinations (Text or
// Icon on the prefix or the suffix) and both off, as pure functions of the props: the Play descriptor tree and the generated source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { applyTemplateToFrame, instanceOf } from '../src/behavior-engine/template-master.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { inputModel } from '../../../scripts/input-model.mjs';

const input = TEMPLATES.get('input');
const model = inputModel();
const variables = { collections: model.collections, items: model.items };
let seq = 0;
const idOf = key => `x-${key}-${++seq}`;
const SIDES = ['prefixIcon', 'prefixText', 'clear', 'suffixText', 'suffixIcon'];

/** A master the generator built, and the nodes of an instance of it with these props. */
function nodesFor(props) {
    const frame = { id: 'master', name: 'Input', type: 'frame', parentId: null, x: 0, y: 0, w: 220, h: 32, fills: [], layout: 'horizontal', gap: 0, padding: 0, component: true };
    const made = applyTemplateToFrame(input, { frame, children: [], binding: model.binding, variables, idOf });
    const copies = instanceOf(input, frame, made.created, props, { id: idOf });
    return { frame, made, nodes: [frame, ...made.created, ...copies], root: copies[0] };
}

/** The layers Play draws in the instance, in order, by slot name: a layer drawn from the template has its class, an affix or a part its node's name. */
function playClasses(props) {
    const { nodes, root } = nodesFor(props);
    const { root: dom, problems } = toDomTree({ pages: [{ id: 'p', name: 'Screens', nodes }], variables }, root.id);
    assert.deepEqual(problems, []);
    const nameOf = id => nodes.find(n => n.id === id)?.name;
    return dom.children.map(c => c.attrs?.class?.replace(/^input-/, '') ?? nameOf(c.nodeId)).filter(Boolean);
}
const sidesOf = classes => classes.filter(c => SIDES.includes(c));

/** The generated files of the Input. */
function filesOf() {
    const { frame, made } = nodesFor({});
    const out = generateComponent(input, model.binding, variables, 'Input', frame, id => made.created.filter(c => c.parentId === id));
    assert.deepEqual(out.problems, []);
    return out.files;
}

const REMEMBERED = { prefixText: 'Rp', prefixIcon: 'check', suffixText: '.com', suffixIcon: 'check' };

for (const [name, props, expected] of [
    ['prefix Text', { hasPrefix: true, prefixKind: 'text', prefixText: 'Rp' }, ['prefixText']],
    ['prefix Icon', { hasPrefix: true, prefixKind: 'icon', prefixIcon: 'check' }, ['prefixIcon']],
    ['suffix Text', { hasSuffix: true, suffixKind: 'text', suffixText: '.com' }, ['suffixText']],
    ['suffix Icon', { hasSuffix: true, suffixKind: 'icon', suffixIcon: 'check' }, ['suffixIcon']],
    ['both sides off, with Icon kept', { prefixKind: 'icon', suffixKind: 'icon', ...REMEMBERED }, []],
    ['both sides off, with Text kept', { ...REMEMBERED }, []],
]) {
    test(`Play draws ${name}: ${expected.join(', ') || 'no side layer'}`, () => {
        assert.deepEqual(sidesOf(playClasses(props)), expected);
    });
}

test('Play draws the sides in the anatomy order: prefix first, then the value, the clear before the suffix, the suffix icon last', () => {
    const classes = playClasses({ hasPrefix: true, prefixKind: 'icon', prefixIcon: 'check', hasSuffix: true, suffixKind: 'icon', suffixIcon: 'check', allowClear: true, value: 'Hi', showCount: true });
    assert.deepEqual(classes.filter(c => c === 'value' || SIDES.includes(c) || c === 'count'), ['prefixIcon', 'value', 'count', 'clear', 'suffixIcon']);
    const text = playClasses({ hasPrefix: true, prefixKind: 'text', prefixText: 'Rp', hasSuffix: true, suffixKind: 'text', suffixText: '.com', allowClear: true, value: 'Hi' });
    assert.deepEqual(text.filter(c => c === 'value' || SIDES.includes(c)), ['prefixText', 'value', 'clear', 'suffixText']);
});

test('a side holds Text or Icon, never both: the kind picks the layer and the other content stays out of Play', () => {
    const both = { hasPrefix: true, prefixText: 'Rp', prefixIcon: 'check' };
    assert.deepEqual(sidesOf(playClasses({ ...both, prefixKind: 'text' })), ['prefixText']);
    assert.deepEqual(sidesOf(playClasses({ ...both, prefixKind: 'icon' })), ['prefixIcon']);
});

test('a Text side with no text draws nothing, and an Icon side draws its slot', () => {
    assert.deepEqual(sidesOf(playClasses({ hasPrefix: true, prefixKind: 'text' })), []);
    assert.deepEqual(sidesOf(playClasses({ hasPrefix: true, prefixKind: 'icon' })), ['prefixIcon']);
});

test('the export has typed props with their defaults: the switch off, the kind Text, the text empty, the icon none', () => {
    const jsx = filesOf()['Input.jsx'];
    for (const side of ['prefix', 'suffix']) {
        const Side = side[0].toUpperCase() + side.slice(1);
        assert.ok(jsx.includes(`has${Side} = false, ${side}Kind = "text", ${side}Text = "", ${side}Icon = null`), `${side} props and defaults`);
    }
    for (const gone of ['hasIcon', 'iconPlacement', 'iconEnd', ' icon = ']) assert.ok(!jsx.includes(gone), `no ${gone}`);
});

test('the export draws each side under its switch and its kind, in the anatomy order', () => {
    const jsx = filesOf()['Input.jsx'];
    assert.ok(jsx.includes('{hasPrefix && prefixKind === "icon" && <span className="input-prefixIcon">{prefixIcon}</span>}'));
    assert.ok(jsx.includes('{((hasPrefix === true) && (prefixKind === "text") && (String(prefixText ?? "") !== "")) && <span className="input-prefixText">{prefixText}</span>}'));
    assert.ok(jsx.includes('{((hasSuffix === true) && (suffixKind === "text") && (String(suffixText ?? "") !== "")) && <span className="input-suffixText">{suffixText}</span>}'));
    assert.ok(jsx.includes('{hasSuffix && suffixKind === "icon" && <span className="input-suffixIcon">{suffixIcon}</span>}'));
    const at = name => jsx.indexOf(`className="${name}"`);
    const order = ['input-prefixIcon', 'input-prefixText', 'input-value', 'input-count', 'input-clear', 'input-suffixText', 'input-suffixIcon'].map(at);
    assert.ok(order.every(i => i > -1), 'every side layer is written');
    assert.deepEqual([...order].sort((a, b) => a - b), order, 'in the anatomy order');
});

test('the export sizes the side icons by the icon size token, and the clear icon by its own smaller token', () => {
    const css = filesOf()['Input.css'];
    for (const [slot, token] of [['prefixIcon', 'icon-size'], ['suffixIcon', 'icon-size'], ['clear', 'clear-icon-size']]) {
        const block = new RegExp(`\\.input-${slot} \\{([^}]*)\\}`).exec(css)?.[1] ?? '';
        assert.match(block, new RegExp(`width: var\\(--input-${token}\\);`), `${slot} width`);
        assert.match(block, new RegExp(`height: var\\(--input-${token}\\);`), `${slot} height`);
    }
});
