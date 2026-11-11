// Custom templates: a schema a designer pastes as JSON, stored in the document (`behavior: { version, templates }`), validated by the same validator as the
// built-in schemas plus the Custom rules (the id namespace, no clash), and read through one registry made of the built-in templates and the document's.
// A slot's `accepts` resolves against that registry. A document whose templates are malformed fails to open with an explicit error; nothing is repaired.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES, BUILT_IN_TEMPLATES } from '../src/behavior-engine/registry.js';
import { FORM_ITEM } from '../src/templates/form-item.js';
import { BEHAVIOR_DATA_VERSION, BehaviorDataError } from '../src/behavior-engine/data.js';
import { assertBehaviorData } from '../src/behavior-engine/document-check.js';
import { applyTemplateToFrame } from '../src/behavior-engine/template-master.js';
import { diagnoseDocument } from '../src/behavior-engine/diagnostics.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { activateDocumentTemplates, customSchemaProblems, documentTemplateProblems, parseCustomSchema } from '../src/behavior-engine/custom-templates.js';
import { formItemModel } from '../../../scripts/form-item-model.mjs';

afterEach(() => activateDocumentTemplates(undefined));

/** A valid Custom schema: FormItem's shape under a Custom id. */
const custom = (id = 'custom-card', over = {}) => ({ ...structuredClone(FORM_ITEM), id, name: 'Card', ...over });
const behaviorOf = (...schemas) => ({ version: BEHAVIOR_DATA_VERSION, templates: Object.fromEntries(schemas.map(s => [s.id, s])) });
const BUILT_INS = new Set(BUILT_IN_TEMPLATES.keys());

test('pasted text is parsed as JSON: a syntax error and a value that is not an object are reported, not thrown', () => {
    assert.deepEqual(parseCustomSchema(JSON.stringify(custom())).schema.id, 'custom-card');
    assert.match(parseCustomSchema('{ "id": ').problems[0], /^schema is not valid JSON: /);
    assert.deepEqual(parseCustomSchema('[1]').problems, ['schema must be a JSON object']);
    assert.deepEqual(parseCustomSchema('  ').problems, ['schema must be a JSON object']);
});

test('a valid Custom schema has no problems; the id is custom-<slug> and clashes with no built-in or other Custom template', () => {
    assert.deepEqual(customSchemaProblems(custom(), { builtIns: BUILT_INS, others: new Set() }), []);
    for (const bad of ['card', 'Custom-card', 'custom-', 'custom-Card', 'custom-a_b', 'custom--x']) {
        assert.match(customSchemaProblems(custom(bad), { builtIns: BUILT_INS, others: new Set() }).join('\n'), new RegExp(`id "${bad}" must be custom- and a lower case slug`), bad);
    }
    assert.match(customSchemaProblems(custom(), { builtIns: BUILT_INS, others: new Set(['custom-card']) }).join('\n'), /id "custom-card" is already a Custom template/);
    assert.match(customSchemaProblems(custom('custom-x'), { builtIns: new Set(['custom-x']), others: new Set() }).join('\n'), /id "custom-x" is a built-in template/);
});

test('the built-in validator applies: a broken schema lists its own problems under the Custom ones', () => {
    const broken = custom('custom-card', { tokens: 'none' });
    assert.match(customSchemaProblems(broken, { builtIns: BUILT_INS, others: new Set() }).join('\n'), /tokens must be an object/);
});

test('accepts resolves against the built-in templates and the other Custom templates, and itself; anything else is refused', () => {
    const ok = id => customSchemaProblems(custom('custom-card', { slots: [{ id: 'body', name: 'Body', layout: 'vertical', accepts: [id], onlyAccepts: true }] }), { builtIns: BUILT_INS, others: new Set(['custom-field']) });
    assert.deepEqual(ok('input'), []);
    assert.deepEqual(ok('custom-field'), []);
    assert.deepEqual(ok('custom-card'), []);
    assert.match(ok('select').join('\n'), /slot "body" accepts "select", which is not a registered template/);
});

test('the document\'s templates are checked as a whole: its shape, its version, each key is its schema\'s id, each schema is valid', () => {
    assert.deepEqual(documentTemplateProblems(undefined), [], 'a document with no behavior data has no Custom templates');
    assert.deepEqual(documentTemplateProblems(behaviorOf(custom(), custom('custom-field'))), []);
    assert.match(documentTemplateProblems('x').join('\n'), /behavior must be an object/);
    assert.match(documentTemplateProblems({ version: 1, templates: {} }).join('\n'), new RegExp(`behavior version 1 is not version ${BEHAVIOR_DATA_VERSION}`));
    assert.match(documentTemplateProblems({ version: BEHAVIOR_DATA_VERSION, templates: [] }).join('\n'), /templates must be an object/);
    assert.match(documentTemplateProblems({ version: BEHAVIOR_DATA_VERSION, templates: {}, extra: 1 }).join('\n'), /unknown field extra/);
    assert.match(documentTemplateProblems({ version: BEHAVIOR_DATA_VERSION, templates: { 'custom-a': custom('custom-b') } }).join('\n'), /template "custom-a" holds a schema with the id "custom-b"/);
    assert.match(documentTemplateProblems(behaviorOf(custom('custom-card', { tokens: 'none' }))).join('\n'), /template "custom-card": tokens must be an object/);
});

test('activating the document\'s templates puts them in the registry beside the built-in ones, and activating another document replaces them', () => {
    assert.deepEqual([...TEMPLATES.keys()], ['button', 'input', 'formitem', 'list', 'icon-button', 'checkbox', 'switch', 'radio', 'inputnumber', 'antd-badge', 'antd-tag', 'antd-divider', 'antd-avatar']);
    activateDocumentTemplates(behaviorOf(custom()));
    assert.deepEqual([...TEMPLATES.keys()], ['button', 'input', 'formitem', 'list', 'icon-button', 'checkbox', 'switch', 'radio', 'inputnumber', 'antd-badge', 'antd-tag', 'antd-divider', 'antd-avatar', 'custom-card']);
    assert.equal(TEMPLATES.get('custom-card').name, 'Card');
    activateDocumentTemplates(behaviorOf(custom('custom-field')));
    assert.deepEqual([...TEMPLATES.keys()], ['button', 'input', 'formitem', 'list', 'icon-button', 'checkbox', 'switch', 'radio', 'inputnumber', 'antd-badge', 'antd-tag', 'antd-divider', 'antd-avatar', 'custom-field']);
    activateDocumentTemplates(undefined);
    assert.deepEqual([...TEMPLATES.keys()], ['button', 'input', 'formitem', 'list', 'icon-button', 'checkbox', 'switch', 'radio', 'inputnumber', 'antd-badge', 'antd-tag', 'antd-divider', 'antd-avatar']);
});

test('a malformed document fails to activate with an explicit error and leaves the registry as it was', () => {
    activateDocumentTemplates(behaviorOf(custom()));
    assert.throws(() => activateDocumentTemplates({ version: 1, templates: {} }), err => err instanceof BehaviorDataError && /Cannot open this file: the custom templates are invalid: behavior version 1/.test(err.message));
    assert.ok(TEMPLATES.has('custom-card'), 'nothing was partly loaded');
});

test('a node bound to a Custom template opens only once the document\'s templates are active', () => {
    const doc = { variables: { collections: [] }, pages: [{ id: 'p', name: 'Page 1', nodes: [{ id: 'm', name: 'Card', type: 'frame', component: true, behavior: { version: BEHAVIOR_DATA_VERSION, templateId: 'custom-card', variables: {} } }] }] };
    assert.throws(() => assertBehaviorData(doc), /unknown template "custom-card"/);
    activateDocumentTemplates(behaviorOf(custom()));
    assert.doesNotThrow(() => assertBehaviorData(doc));
});

test('a Custom template goes through the generator, the Diagnostics and the export like a built-in one', () => {
    const schema = custom('custom-card', { slots: [{ id: 'body', name: 'Body', layout: 'vertical', min: 1, max: 1, accepts: ['custom-field'], onlyAccepts: true, showEmpty: true }] });
    const field = custom('custom-field');
    activateDocumentTemplates(behaviorOf(schema, field));
    const model = formItemModel();
    const variables = { collections: model.collections, items: model.items };
    const binding = { variables: { size: model.ids.size } };
    const frame = { id: 'master', name: 'Card', type: 'frame', parentId: null, fills: [] };
    const out = applyTemplateToFrame(TEMPLATES.get('custom-card'), { frame, children: [], binding, variables, idOf: key => `c-${key}` });
    assert.deepEqual(out.problems, []);
    assert.deepEqual(frame.cprops.map(p => [p.id, p.accepts, p.onlyAccepts]), [['body', ['custom-field'], true]]);
    const slot = out.created.find(n => n.propBind?.slot === 'body');
    const fieldMaster = { id: 'fm', name: 'Field', type: 'frame', component: true, parentId: null, behavior: { version: BEHAVIOR_DATA_VERSION, templateId: 'custom-field', variables: {} } };
    const buttonMaster = { id: 'bm', name: 'Btn', type: 'frame', component: true, parentId: null, behavior: { version: BEHAVIOR_DATA_VERSION, templateId: 'button', variables: {} } };
    const inst = { id: 'i', name: 'My card', type: 'frame', parentId: null, isInstance: true, sourceId: 'master' };
    const iSlot = { ...slot, id: 'i-slot', parentId: 'i', sourceId: slot.id };
    const held = of => ({ id: `h-${of}`, name: `Held ${of}`, type: 'frame', parentId: 'i-slot', isInstance: true, sourceId: of });
    const report = (...of) => diagnoseDocument({ variables, pages: [{ name: 'p', nodes: [frame, ...out.created, fieldMaster, buttonMaster, inst, iSlot, ...of.map(held)] }] }).filter(f => f.code.startsWith('slot-')).map(f => f.code);
    assert.deepEqual(report('fm'), []);
    assert.deepEqual(report('bm'), ['slot-not-accepted']);
    const code = generateComponent(TEMPLATES.get('custom-card'), binding, variables, 'Card', { id: 'm', type: 'frame', layout: 'vertical' }, () => []);
    assert.deepEqual(code.problems, []);
    assert.deepEqual(Object.keys(code.files).sort(), ['Card.css', 'Card.tsx']);
    assert.match(code.files['Card.tsx'], /children\?: ReactNode;/);
});
