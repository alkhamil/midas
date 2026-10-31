import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { TEMPLATES, BEHAVIOR_DATA_VERSION } from '../src/index.js';
import { BUTTON } from '../src/templates/button.js';
import { buttonModel } from '../../../scripts/button-model.mjs';

const model = buttonModel({ colors: ['primary'], variantModes: ['solid'], sizeModes: [{ id: 'sm', name: 'Small' }] });
const variables = { collections: model.collections, items: model.items };
// A control template: the label slot is an input holding the value prop, with the placeholder prop beside it.
const controlled = () => {
    const schema = structuredClone(BUTTON);
    schema.id = 'input';
    schema.name = 'Input';
    schema.props.value = { source: 'literal', type: 'string', default: '' };
    schema.props.placeholder = { source: 'literal', type: 'string', default: '' };
    schema.control = { slot: 'label', value: 'value', placeholder: 'placeholder' };
    return schema;
};
const master = template => ({
    id: 'm', name: 'Input', type: 'frame', parentId: null, component: true,
    layout: 'horizontal', gap: 6, padding: 12, fills: [],
    behavior: { version: BEHAVIOR_DATA_VERSION, templateId: template.id, variables: model.binding.variables },
});
const labelLayer = (parentId, over = {}) => ({ id: `${parentId}-label`, name: 'label', type: 'text', parentId, text: 'Name', x: 0, y: 0, w: 80, h: 20, fills: [], ...over });
const doc = nodes => ({ pages: [{ id: 'p', name: 'Screens', nodes }], variables });

test('a control names a text slot and its value and placeholder string props', () => {
    assert.deepEqual(validateTemplateSchema(controlled()).filter(p => p.includes('control')), []);
    const badSlot = controlled();
    badSlot.control.slot = 'missing';
    assert.match(validateTemplateSchema(badSlot).join('\n'), /control slot "missing" is not a text or control anatomy slot/);
    const iconSlot = controlled();
    iconSlot.control.slot = 'iconStart';
    assert.match(validateTemplateSchema(iconSlot).join('\n'), /control slot "iconStart" is not a text or control anatomy slot/);
    const badValue = controlled();
    badValue.control.value = 'disabled';
    assert.match(validateTemplateSchema(badValue).join('\n'), /control value "disabled" is not a string prop/);
    const badPlaceholder = controlled();
    badPlaceholder.control.placeholder = 'missing';
    assert.match(validateTemplateSchema(badPlaceholder).join('\n'), /control placeholder "missing" is not a string prop/);
});

test('the component renders a control slot as an input, not a span', () => {
    const template = controlled();
    const { files } = generateComponent(template, model.binding, variables, 'Input', master(template), () => []);
    assert.match(files['Input.jsx'], /<input className="input-label" value=\{value\} placeholder=\{placeholder\} disabled=\{disabled\} \/>/);
    assert.doesNotMatch(files['Input.jsx'], /<span className="input-label">/);
});

test('a control without a placeholder omits the attribute', () => {
    const template = controlled();
    delete template.props.placeholder;
    delete template.control.placeholder;
    assert.deepEqual(validateTemplateSchema(template).filter(p => p.includes('control')), []);
    const { files } = generateComponent(template, model.binding, variables, 'Input', master(template), () => []);
    assert.match(files['Input.jsx'], /<input className="input-label" value=\{value\} disabled=\{disabled\} \/>/);
});

test('Play draws a control slot as an input holding the value, while the canvas keeps the text layer', async () => {
    const { toDomTree } = await import('../src/prototype/dom-tree.js');
    const template = controlled();
    TEMPLATES.set(template.id, template);
    try {
        const m = master(template);
        const inst = {
            id: 'i', name: 'Name', type: 'frame', parentId: null, x: 0, y: 0, w: 140, h: 40,
            isInstance: true, sourceId: 'm',
            behavior: { version: BEHAVIOR_DATA_VERSION, props: { label: 'Name', value: 'Ada', placeholder: 'Type a name' } },
        };
        const { root } = toDomTree(doc([m, labelLayer('m', { layoutSizingH: 'fill' }), labelLayer('i', { layoutSizingH: 'fill' }), inst]), 'i');
        const input = root.children.find(c => c.attrs?.class === 'input-label');
        assert.equal(input.tag, 'input');
        assert.deepEqual([input.attrs.value, input.attrs.placeholder], ['Ada', 'Type a name']);
        const canvas = toDomTree(doc([m, labelLayer('m')]), 'm');
        assert.equal(canvas.root.children[0].tag, 'span');
    } finally {
        TEMPLATES.delete(template.id);
    }
});
