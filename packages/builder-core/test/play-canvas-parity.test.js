// Canvas = Play: for Checkbox, Radio and Switch in every state, each box and handle the canvas draws has the size and colour in Play (the stylesheet the export
// writes, evaluated per element) that its bound variables give on the canvas. The canvas side is the node's bound variables resolved in the instance's modes and
// state; the Play side is the real Play tree and its stylesheet. A size or colour that the stylesheet overrides after its token rule shows up as a difference.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { cssVarOf } from '../src/behavior-engine/tokens.js';
import { previewOf } from '../src/behavior-engine/preview.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { modelFor, instanceFor } from './helpers/box-template.js';
import { computed, elementsOf } from './helpers/play-compute.js';

const STATES = {
    checkbox: { unchecked: {}, checked: { checked: true }, indeterminate: { indeterminate: true }, disabled: { disabled: true }, 'disabled+checked': { disabled: true, checked: true } },
    radio: { unchecked: {}, checked: { checked: true }, disabled: { disabled: true }, 'disabled+checked': { disabled: true, checked: true } },
    switch: { unchecked: {}, checked: { checked: true }, disabled: { disabled: true }, 'disabled+checked': { disabled: true, checked: true } },
};

/** The instance's mode id per dimension: the default mode of each collection, as the Design System picks it. */
function modesOf(model) {
    return Object.fromEntries(Object.entries(model.binding.variables).map(([prop, id]) => {
        const collection = model.variables.collections.find(c => c.id === id), wanted = model.template.props[prop].defaultMode;
        return [prop, (collection.modes.find(m => m.id === wanted || m.name === wanted) ?? collection.modes[0]).id];
    }));
}

/** What the canvas node says its size and colour are: the token each bound variable names, resolved in the instance's modes and state, as a CSS value. */
function canvasOf(model, node, tokens) {
    const item = id => model.variables.items.find(i => i.id === id);
    const value = key => (node.vars?.[key] ? tokens[cssVarOf(model.template.id, item(node.vars[key]).name)] : undefined);
    return { width: value('w'), height: value('h'), fill: value('fills.0') };
}

for (const id of ['checkbox', 'radio', 'switch']) {
    for (const [state, props] of Object.entries(STATES[id])) {
        test(`${id} ${state}: every box and handle has in Play the size and colour its canvas node is bound to`, () => {
            const model = modelFor(TEMPLATES.get(id));
            const modes = modesOf(model);
            const nodes = instanceFor(model, props);
            const instance = nodes[0];
            instance.varModes = Object.fromEntries(Object.entries(model.binding.variables).map(([prop, collectionId]) => [collectionId, modes[prop]]));
            const { root, styles, problems } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, ...nodes] }], variables: model.variables }, instance.id);
            assert.deepEqual(problems, []);
            // The canvas draws the tokens of the state: the rest tokens with the swaps of the persistent states that hold.
            const { vars: shown } = previewOf(model.template, model.binding, modes, model.variables, props, 'default');
            const cases = [instance, ...model.created.filter(n => n.behavior?.group !== undefined)];
            for (const node of cases) {
                const key = node === instance ? 'root' : node.behavior.group;
                const element = elementsOf(root).find(({ el }) => (key === 'root' ? el === root : el.attrs?.class === `${id}-${key}`));
                assert.ok(element, `${id}: Play draws ${key}`);
                const play = computed(styles, element.chain);
                const canvas = canvasOf(model, node === instance ? model.frame : node, shown);
                for (const [name, want] of [['width', canvas.width], ['height', canvas.height], ['background-color', canvas.fill]]) {
                    if (want !== undefined) assert.equal(play[name], want, `${id} ${state}: ${key} ${name}`);
                }
            }
        });
    }
}
