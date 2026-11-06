// The component a template is written as is named from its template name as an identifier: "Icon Button" is IconButton. Play and the export read this one name
// (before, a template name with a space was refused as "not a component name").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { componentNameOf, generateComponent } from '../src/behavior-engine/codegen.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { applyTemplateToFrame, instanceOf } from '../src/behavior-engine/template-master.js';
import { iconButtonModel } from '../../../scripts/icon-button-model.mjs';

test('the component name is the template name without separators, each word capitalised', () => {
    assert.equal(componentNameOf({ name: 'Icon Button' }), 'IconButton');
    assert.equal(componentNameOf({ name: 'Button' }), 'Button');
    assert.equal(componentNameOf({ name: 'FormItem' }), 'FormItem');
    assert.equal(componentNameOf({ name: 'my  card-list' }), 'MyCardList');
});

test('every registered template is written under a name the generator accepts', () => {
    for (const template of TEMPLATES.values()) assert.match(componentNameOf(template), /^[A-Z][A-Za-z0-9]*$/, template.id);
});

test('Play draws an Icon Button, whose template name has a space', () => {
    const template = TEMPLATES.get('icon-button');
    const model = iconButtonModel();
    const variables = { collections: model.collections, items: model.items };
    const master = { id: 'm', name: 'Icon Button', type: 'frame', parentId: null, fills: [], x: 400, y: 0 };
    const { created } = applyTemplateToFrame(template, { frame: master, children: [], binding: { variables: model.binding.variables }, variables, idOf: key => `m-${key}` });
    const instance = instanceOf(template, master, created, {}, { id: src => `i-${src}`, varModes: { [model.ids.variant]: 'outlined', [model.ids.color]: 'primary', [model.ids.type]: 'default', [model.ids.shape]: 'square', [model.ids.size]: 'md' } });
    instance[0].parentId = 'stage';
    const stage = { id: 'stage', name: 'Stage', type: 'frame', parentId: null, x: 0, y: 0, w: 300, h: 200, fills: [] };
    const { root, problems } = toDomTree({ pages: [{ id: 'p', name: 'Screens', nodes: [stage, master, ...created, ...instance] }], variables }, 'stage');
    assert.ok(root.children.some(c => c.attrs?.class === 'icon-button'), 'the instance is drawn as the template');
    assert.deepEqual(problems ?? [], []);
    assert.ok(generateComponent(template, model.binding, variables, componentNameOf(template), master, id => created.filter(n => n.parentId === id)).files['IconButton.css']);
});
