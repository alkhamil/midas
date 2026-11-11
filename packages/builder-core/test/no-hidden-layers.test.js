// The no-hidden-layers rule, over every registered template: a master or an instance never
// contains a hidden layer, an opacity-0 layer, or a fixed zero-size layer. Any optional
// part or slot layer is added while its condition holds and removed when it does not, so
// toggling a prop on and back off restores the default tree (the text and icon choices live
// in props, not in layers).
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { planInstanceAnatomy } from '../src/behavior-engine/anatomy.js';
import { canvasPartsOf, partWrites } from '../src/behavior-engine/display.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { slotShown, slotWanted } from '../src/behavior-engine/template-master.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

/** A layer that can never draw: hidden, transparent, or fixed at zero size with no bound size token to resolve it (a hug layer waits for content instead). */
const isDead = n => n.visible === false || n.opacity === 0 || (n.w === 0 && n.h === 0 && n.layoutSizingH === 'fixed' && n.layoutSizingV === 'fixed' && !n.vars?.w && !n.vars?.h);
/** A layer hidden only by live typing: its prop switch is on (the anatomy wants it) but its value gate is empty (nothing drawn yet),
 * so Play can show it as the value is typed without a re-sync; the export renders it conditionally instead. */
const liveTypingHidden = (template, props, n) => {
    const slot = n.behavior?.slot;
    if (n.visible !== false || slot === undefined) return false;
    const resolved = resolveProps(template, props);
    return slotWanted(template, slot, resolved) === true && slotShown(template, slot, resolved) === false;
};
const deadOf = (template, props, nodes) => nodes.filter(n => isDead(n) && !liveTypingHidden(template, props, n)).map(n => n.name ?? n.id);

/** The instance children as the anatomy planner sees them, with each layer's container. */
function asChildren(root, nodes) {
    const kids = nodes.filter(n => n.parentId === root.id);
    const groups = new Map(kids.filter(c => c.behavior?.group !== undefined).map(c => [c.id, c.behavior.group]));
    return nodes.filter(n => n !== root).map(n => {
        const holder = n.parentId === root.id ? null : groups.get(n.parentId);
        return { id: n.id, slot: n.behavior?.slot ?? n.propBind?.slot ?? null, name: n.name, component: null, ...(holder == null ? {} : { parent: holder }) };
    });
}

function planOf(model, props, nodes) {
    return planInstanceAnatomy({ binding: model.binding, masterRoot: { isAutoLayout: true }, masterTree: [{ id: 'x', type: model.created.some(n => n.type === 'text') ? 'text' : 'frame' }], stored: props, children: asChildren(nodes[0], nodes) });
}

/** Every literal boolean or enum prop of the template, with one on-value each (every enum option). */
function toggles(template) {
    const out = [];
    for (const [prop, def] of Object.entries(template.props)) {
        if (def.source !== 'literal') continue;
        if (def.type === 'boolean' && def.default !== true) out.push({ [prop]: true });
        if (def.type === 'enum') for (const option of def.options) if (option !== def.default) out.push({ [prop]: option });
    }
    return out;
}

for (const template of TEMPLATES.values()) {
    test(`${template.id}: the generated master holds no dead layer`, () => {
        const model = modelFor(template);
        assert.deepEqual(deadOf(template, {}, [model.frame, ...model.created]), [], 'no hidden, opacity-0 or fixed zero-size layer');
    });

    test(`${template.id}: the default instance holds no dead layer and the plan converges`, () => {
        const model = modelFor(template);
        const nodes = instanceFor(model, {});
        assert.deepEqual(deadOf(template, {}, nodes), [], 'no hidden, opacity-0 or fixed zero-size layer');
        assert.deepEqual(planOf(model, {}, nodes).ops, [], 'nothing to add, move or remove');
    });

    test(`${template.id}: toggling an optional prop on adds only conditional layers, and off removes them again`, () => {
        const model = modelFor(template);
        const keysOf = nodes => new Set(nodes.slice(1).map(n => n.behavior?.slot ?? n.propBind?.slot ?? n.behavior?.part ?? n.name));
        const base = new Set(keysOf(instanceFor(model, {})));
        for (const on of toggles(template)) {
            const nodes = instanceFor(model, on);
            assert.deepEqual(deadOf(template, on, nodes), [], `no dead layer with ${JSON.stringify(on)}`);
            assert.deepEqual(planOf(model, on, nodes).ops, [], `the plan converges with ${JSON.stringify(on)}`);
            const added = [...keysOf(nodes)].filter(k => !base.has(k));
            for (const key of added) {
                const slot = template.anatomy.find(s => s.id === key);
                const part = (template.parts ?? []).find(p => p.id === key);
                const content = (template.slots ?? []).find(s => s.id === key);
                assert.ok(slot?.managed || content?.shownWhen !== undefined || (part && part.shownWhen !== undefined), `${template.id} ${key} is a managed slot or a conditional part`);
            }
            // Toggling back off removes exactly the managed layers the toggle added (parts never reach the plan: instanceOf shows they are gone).
            const off = instanceFor(model, {});
            for (const key of added) assert.ok(!keysOf(off).has(key), `${template.id} ${key} is removed when toggled off`);
            const { ops } = planOf(model, {}, nodes);
            for (const key of added) {
                if (!template.anatomy.some(s => s.id === key && (s.managed || s.kind === 'icon'))) continue;
                assert.ok(ops.some(op => op.op === 'remove' && nodes.find(n => n.id === op.id)?.behavior?.slot === key), `${template.id} ${key} is planned for removal`);
            }
        }
    });
}
