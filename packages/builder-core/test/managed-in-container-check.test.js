// The load rules and the editor's commit backstop (behaviorProblem) know a managed slot inside a container (the checkmark in the box): the instance's anatomy is
// checked over its children and the children of its containers, and such a layer sits inside an instance when its container does. Before, a document with a
// checked Checkbox, or any Checkbox once the glyphs were kept on the instance, failed the check, so the commit rolled the whole edit back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { behaviorProblem } from '../src/behavior-engine/document-check.js';
import { modelFor, instanceFor, BOXY } from './helpers/box-template.js';

/** A document of the model's master and an instance of it with the props. */
function documentOf(template, props, mutate = nodes => nodes) {
    const model = modelFor(template);
    const nodes = instanceFor(model, props);
    nodes[0].sourceId = model.frame.id;
    for (const n of nodes.slice(1)) if (n.sourceId === undefined) n.sourceId = undefined;
    return { variables: model.variables, pages: [{ id: 'p', name: 'Page', nodes: mutate([model.frame, ...model.created, ...nodes]) }] };
}

test('an instance with its glyph in the box passes, unchecked and checked, for Checkbox and Radio', () => {
    for (const id of ['checkbox', 'radio']) for (const props of [{}, { checked: true }, { checked: true, label: 'x' }])
        assert.equal(behaviorProblem(documentOf(TEMPLATES.get(id), props)), null, `${id} ${JSON.stringify(props)}`);
});

test('a checked instance whose glyph is shown by a switch (not kept) passes too', () => {
    assert.equal(behaviorProblem(documentOf(BOXY, { checked: true })), null);
    assert.equal(behaviorProblem(documentOf(BOXY, {})), null);
});

test('a glyph the props ask for that is missing from the box is still refused, and so is one that sits outside any instance', () => {
    const missing = documentOf(TEMPLATES.get('checkbox'), { checked: true }, nodes => nodes.filter(n => n.behavior?.slot !== 'check'));
    assert.match(behaviorProblem(missing).problem, /managed layer "check" is missing/);
    const stray = documentOf(TEMPLATES.get('checkbox'), {}, nodes => [...nodes, { id: 'p-root', name: 'Frame', type: 'frame', parentId: null }, { id: 'stray', name: 'check', type: 'frame', parentId: 'p-root', behavior: { version: 2, slot: 'check' } }]);
    assert.match(behaviorProblem(stray).problem, /outside an instance/);
});

test('a glyph in the box that the props do not ask for is refused', () => {
    const extra = documentOf(BOXY, {}, nodes => {
        const box = nodes.find(n => n.behavior?.group === 'box' && n.isInstance !== true && n.sourceId);
        return [...nodes, { id: 'extra', name: 'check', type: 'frame', parentId: box.id, behavior: { version: 2, slot: 'check' } }];
    });
    assert.match(behaviorProblem(extra).problem, /not expected/);
});
