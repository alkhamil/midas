// syncInstance runs the managed text bindings, then the literal fields, then the icon pass (applyIconSlotBindings). The icon pass walks
// iconBoundKeysOf; it used to include the managed TEXT layers, replaced their colour binding with the icon size on w and h and so fixed
// both axes. midas.js needs a browser, so this replays the pass over a plain node list with the same builder-core calls and reads its source.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as core from '@midas/builder-core';
import { inputModel } from '../../../scripts/input-model.mjs';

const { TEMPLATES, applyTemplateToFrame, instanceOf, planManagedTextBindings, applyBindTokens, resolveProps, iconBoundKeysOf, iconSlotTargets, iconSlotBindings, isIconSlotVarKey, fixBoundAxes } = core;
const src = fs.readFileSync(new URL('../src/engine/midas.js', import.meta.url), 'utf8');
const at = src.indexOf('function applyIconSlotBindings(');
const pass = src.slice(at, src.indexOf('\n}\n', at));

test('the icon pass takes its layers from iconBoundKeysOf and finds each holder by its marker', () => {
    assert.ok(pass.includes('iconBoundKeysOf(template)'));
    assert.ok(pass.includes('c.behavior?.slot'));
});

const input = TEMPLATES.get('input');
const model = inputModel();
const variables = { collections: model.collections, items: model.items };
const binding = model.binding;
let seq = 0;
const idOf = key => `p-${key}-${++seq}`;
const frame = { id: 'master', name: 'Input', type: 'frame', parentId: null, x: 0, y: 0, w: 343, h: 32, fills: [], layout: 'horizontal', component: true };
const made = applyTemplateToFrame(input, { frame, children: [], binding, variables, idOf });
const props = { value: 'Hi', showCount: true, maxLength: 10, hasPrefix: true, prefixText: 'Rp', hasSuffix: true, suffixText: '.com' };
const [, ...layers] = instanceOf(input, frame, made.created, props, { id: idOf });
const itemId = name => variables.items.find(i => i.name === name)?.id ?? null;

/** syncInstance's two binding steps over the layers: the managed text bindings, then applyIconSlotBindings with setIconVars. */
function sync() {
    const managed = layers.filter(n => n.type === 'text' && n.behavior?.slot !== undefined).map(node => ({ key: node.behavior.slot, node }));
    applyBindTokens(managed, planManagedTextBindings({ template: input, binding, props: resolveProps(input, props), layers: managed, variables }).ops);
    for (const { key, kind } of iconBoundKeysOf(input)) {
        const holder = layers.find(c => (kind === 'slot' ? c.behavior?.slot : c.behavior?.part) === key);
        if (!holder) continue;
        const targets = iconSlotTargets(input, key);
        const plan = iconSlotBindings({ fg: itemId(targets.colour.name), fgDisabled: itemId(targets.disabledColour.name), size: itemId(targets.size.name), disabled: false, names: { colour: '', disabledColour: '', size: '' }, layers: [] });
        const kept = Object.fromEntries(Object.entries(holder.vars ?? {}).filter(([k]) => !isIconSlotVarKey(k)));
        holder.vars = { ...kept, ...plan.slot };
        fixBoundAxes(holder);
    }
}

test('after the whole sync the managed text layers keep their colour binding and have no width or height variable', () => {
    sync();
    for (const name of ['value', 'prefixText', 'suffixText', 'count']) {
        const n = layers.find(l => l.name === name);
        assert.ok(n.vars?.['fills.0'], `${name} keeps its colour binding`);
        assert.ok(n.vars?.typography, `${name} keeps its typography binding`);
        assert.equal(n.vars.w, undefined, `${name} has no width variable`);
        assert.equal(n.vars.h, undefined, `${name} has no height variable`);
    }
});

test('after the whole sync the sizing is hug x hug for the affixes and the counter, fill x hug for the value', () => {
    sync();
    const sizing = name => { const n = layers.find(l => l.name === name); return [n.layoutSizingH, n.layoutSizingV]; };
    for (const name of ['prefixText', 'suffixText', 'count']) assert.deepEqual(sizing(name), ['hug', 'hug'], name);
    assert.deepEqual(sizing('value'), ['fill', 'hug']);
});
