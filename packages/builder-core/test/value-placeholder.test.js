// The value wins over the placeholder. With a value the placeholder is hidden; with none the placeholder shows and the value layer is hidden
// and takes no space. A schema-level rule on the control, the reverse of `hideWhenEmpty`: `hidePlaceholderWhenFilled`. All four combinations
// (value and placeholder, each filled or empty) on the canvas (layer visibility from the props), in Play and in the export.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { INPUT } from '../src/templates/input.js';
import { partWrites } from '../src/behavior-engine/display.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { applyTemplateToFrame, instanceOf } from '../src/behavior-engine/template-master.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { inputModel } from '../../../scripts/input-model.mjs';

const input = TEMPLATES.get('input');
const model = inputModel();
const variables = { collections: model.collections, items: model.items };
let seq = 0;
const idOf = key => `vp-${key}-${++seq}`;

/** The four combinations: value and placeholder, each filled or empty, with what shows. */
const COMBOS = [
    { name: 'both filled', value: 'Hello', placeholder: 'Search', valueShown: true, placeholderShown: false },
    { name: 'value filled, placeholder empty', value: 'Hello', placeholder: '', valueShown: true, placeholderShown: false },
    { name: 'value empty, placeholder filled', value: '', placeholder: 'Search', valueShown: false, placeholderShown: true },
    { name: 'both empty', value: '', placeholder: '', valueShown: false, placeholderShown: false },
];

test('the Input declares the rule on its control, and the placeholder part shows for its own text, not for the value', () => {
    assert.equal(INPUT.control.hideWhenEmpty, true);
    assert.equal(INPUT.control.hidePlaceholderWhenFilled, true);
    assert.deepEqual(INPUT.parts.find(p => p.id === 'placeholder').shownWhen, { prop: 'placeholder', empty: false });
    assert.deepEqual(validateTemplateSchema(INPUT), []);
});

for (const combo of COMBOS) {
    test(`canvas, ${combo.name}: the value layer is ${combo.valueShown ? 'shown' : 'hidden'} and the placeholder layer is ${combo.placeholderShown ? 'shown' : 'hidden'}`, () => {
        const props = resolveProps(input, { value: combo.value, placeholder: combo.placeholder });
        const writes = partWrites(input, props).filter(w => w.field === 'visible');
        const visible = key => writes.find(w => w.key === key)?.value;
        assert.equal(visible('label'), combo.valueShown, 'the value layer');
        assert.equal(visible('placeholder'), combo.placeholderShown, 'the placeholder layer');
        const frame = { id: 'master', name: 'Input', type: 'frame', parentId: null, fills: [] };
        const made = applyTemplateToFrame(input, { frame, children: [], binding: model.binding, variables, idOf });
        const copies = instanceOf(input, frame, made.created, { value: combo.value, placeholder: combo.placeholder }, { id: idOf });
        const layer = name => copies.find(c => c.name === name);
        assert.equal(layer('label').visible !== false, combo.valueShown, 'the instance\'s value layer');
        assert.equal(layer('placeholder').visible !== false, combo.placeholderShown, 'the instance\'s placeholder layer');
    });

    test(`Play, ${combo.name}: the input holds the value, and the placeholder only while the value is empty and the placeholder has text`, () => {
        const frame = { id: 'master', name: 'Input', type: 'frame', parentId: null, x: 0, y: 0, w: 200, h: 32, fills: [], layout: 'horizontal', component: true };
        const made = applyTemplateToFrame(input, { frame, children: [], binding: model.binding, variables, idOf });
        const copies = instanceOf(input, frame, made.created, { value: combo.value, placeholder: combo.placeholder }, { id: idOf });
        const { root, problems } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [frame, ...made.created, ...copies] }], variables }, copies[0].id);
        assert.deepEqual(problems, []);
        const el = root.children.find(c => c.tag === 'input');
        assert.equal(el.attrs.value, combo.value);
        assert.equal(el.attrs.placeholder, combo.placeholderShown ? combo.placeholder : undefined);
    });
}

test('Play never shows the placeholder over a value, even if the placeholder layer was left visible', () => {
    const frame = { id: 'master', name: 'Input', type: 'frame', parentId: null, x: 0, y: 0, w: 200, h: 32, fills: [], layout: 'horizontal', component: true };
    const made = applyTemplateToFrame(input, { frame, children: [], binding: model.binding, variables, idOf });
    const copies = instanceOf(input, frame, made.created, { value: 'Hello', placeholder: 'Search' }, { id: idOf });
    copies.find(c => c.name === 'placeholder').visible = true;
    const { root } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [frame, ...made.created, ...copies] }], variables }, copies[0].id);
    assert.equal(root.children.find(c => c.tag === 'input').attrs.placeholder, undefined, 'the value wins');
});

/** The generated Input source, for a template. */
function sourceOf(template) {
    const frame = { id: 'master', name: 'Input', type: 'frame', parentId: null, fills: [] };
    const made = applyTemplateToFrame(template, { frame, children: [], binding: model.binding, variables, idOf });
    return generateComponent(template, model.binding, variables, 'Input', frame, id => made.created.filter(c => c.parentId === id)).files['Input.jsx'];
}

test('the export passes the placeholder only while the value is empty', () => {
    assert.match(sourceOf(input), /<input className="input-label" value=\{value\} placeholder=\{String\(value \?\? ""\) === "" \? placeholder : undefined\}/);
});

test('without the rule the export passes the placeholder plainly: the rule is the schema\'s, not the engine\'s', () => {
    const plain = structuredClone(INPUT);
    delete plain.control.hidePlaceholderWhenFilled;
    assert.match(sourceOf(plain), /placeholder=\{placeholder\}/);
});

test('hidePlaceholderWhenFilled must be a boolean and needs a placeholder prop that writes a part of the template', () => {
    const notBoolean = structuredClone(INPUT);
    notBoolean.control.hidePlaceholderWhenFilled = 'yes';
    assert.match(validateTemplateSchema(notBoolean).join('\n'), /control hidePlaceholderWhenFilled must be a boolean/);
    const noPlaceholder = structuredClone(INPUT);
    delete noPlaceholder.control.placeholder;
    assert.match(validateTemplateSchema(noPlaceholder).join('\n'), /control hidePlaceholderWhenFilled needs a placeholder prop/);
    const noPart = structuredClone(INPUT);
    noPart.parts = noPart.parts.filter(p => p.id !== 'placeholder');
    assert.match(validateTemplateSchema(noPart).join('\n'), /control hidePlaceholderWhenFilled names the placeholder layer "placeholder", which is not a part of the template/);
    const hideNotBoolean = structuredClone(INPUT);
    hideNotBoolean.control.hideWhenEmpty = 'yes';
    assert.match(validateTemplateSchema(hideNotBoolean).join('\n'), /control hideWhenEmpty must be a boolean/);
});
