// Builds template masters and their instances through the part generator (builder-core), for the fixture scripts: no template part is
// written by hand. A master is a frame the generator completes; an instance is a copy of that master's layers for the instance's props,
// with the icons the props place in its managed slots.
import { applyTemplateToFrame, instanceOf } from '../packages/builder-core/src/behavior-engine/template-master.js';
import { iconSlotBindings, iconSlotTargets } from '../packages/builder-core/src/behavior-engine/icon-slot.js';

/**
 * A master: `frame` becomes the component, and the generator gives it the layers its template needs (each bound to its variables).
 * Returns the master and its layers, the frame first. A problem the generator reports is an error: no fixture is written half built.
 * @param {{ template: any, frame: any, binding: { variables: Record<string, string> }, variables: { collections: any[], items: any[] } }} opts
 */
export function generatedMaster({ template, frame, binding, variables }) {
    const { created, problems } = applyTemplateToFrame(template, { frame, children: [], binding, variables, idOf: key => `${frame.id}-${key}` });
    if (problems.length) throw new Error(`${frame.name}: the generator reports ${problems.map(p => p.reason).join(', ')}`);
    return [frame, ...created];
}

/**
 * An instance of a master for these props: copies of the master's layers with the visibility and text the props say, the root at (x, y)
 * under `parentId`. The copies' ids follow the master's: the root is `id`, a layer `<id>-<key>`, and a managed slot `<id>-<slot>`.
 * @param {{ template: any, master: any[], props: Record<string, unknown>, id: string, varModes?: Record<string, string>, x?: number, y?: number, parentId?: string | null, name?: string }} opts
 */
export function generatedInstance({ template, master, props, id, varModes = {}, x = 0, y = 0, parentId = null, name = null }) {
    const [root, ...layers] = master;
    const idFor = src => {
        if (typeof src === 'object') return `${id}-${src.name}`;
        if (src === root.id) return id;
        return `${id}-${src.slice(root.id.length + 1)}`;
    };
    const copies = instanceOf(template, root, layers, props, { id: idFor, varModes });
    copies[0] = { ...copies[0], x, y, parentId, ...(name ? { name } : {}) };
    return copies;
}

/** An icon component in a file's Components page: a frame named Icon/<name> holding its path. */
export function iconComponent(id, name, x, filled) {
    // An auto layout frame, so its path is laid out by it (an instance's children are, never positioned by hand).
    const root = { id, name: `Icon/${name}`, type: 'frame', parentId: null, x, y: 40, w: 24, h: 24, component: true, layout: 'horizontal', gap: 0, padding: 0, layoutSizingH: 'fixed', layoutSizingV: 'fixed', fills: [], clip: false, stroke: '#000000', strokeWidth: 0, radius: 0, opacity: 1, visible: true, locked: false, rotation: 0, version: 0 };
    const path = {
        id: `${id}-path`, name, type: 'path', parentId: id, x: 0, y: 0, w: 24, h: 24, pathW: 24, pathH: 24, closed: filled,
        points: filled ? [{ x: 4, y: 4 }, { x: 20, y: 12 }, { x: 4, y: 20 }] : [{ x: 4, y: 12 }, { x: 20, y: 12 }],
        fills: filled ? [{ type: 'solid', color: '#20202a', opacity: 1, visible: true }] : [], stroke: '#20202a', strokeWidth: filled ? 0 : 2,
        rotation: 0, opacity: 1, visible: true, locked: false, clip: false, radius: 0, version: 0,
    };
    return [root, path];
}

/** The nested instance a managed slot holds: the icon's own copy, with the engine's icon slot bindings (fill, stroke and size). */
function iconInstance(slotId, componentId, components, disabled, template, fg, fgDisabled, size) {
    const copies = components.filter(c => c.id === componentId || c.parentId === componentId);
    const map = new Map(copies.map(c => [c.id, `${slotId}-ic-${c.id}`]));
    const layers = copies.map(c => ({
        id: map.get(c.id), fillIndexes: (c.fills || []).flatMap((f, i) => (f.visible !== false ? [i] : [])), stroke: !!c.stroke && c.strokeWidth > 0,
    }));
    const names = Object.fromEntries(Object.entries(iconSlotTargets(template)).map(([role, target]) => [role, target.name]));
    const plan = iconSlotBindings({ fg, fgDisabled, size, disabled, names, layers });
    const nodes = copies.map(c => {
        const bound = plan.layers.find(l => l.id === map.get(c.id)).vars;
        const isRoot = c.id === componentId;
        return {
            ...c, id: map.get(c.id), parentId: isRoot ? slotId : map.get(c.parentId), component: false, isInstance: isRoot, sourceId: c.id,
            overrides: {}, version: 0, ...(isRoot ? { x: 0, y: 0, layoutSizingH: 'fill', layoutSizingV: 'fill' } : {}),
            ...(Object.keys(bound).length ? { vars: bound } : {}),
        };
    });
    return { nodes, slotVars: plan.slot };
}

/**
 * Puts an icon component in each managed slot the instance shows and names one: the slot holds the icon's instance, filling it. A slot
 * with no icon chosen keeps its box and draws nothing (the editor's rule). `picks` names the slot and the icon component for each.
 * Returns the copies with the icon nodes added.
 * @param {{ slot: string, component: string | null }[]} picks
 * @param {any[]} components the icon components the picks name
 */
export function withIcons(copies, picks, id, components, template, disabled, fg, fgDisabled, size) {
    const nested = [];
    for (const { slot, component } of picks) {
        const layer = copies.find(c => c.behavior?.slot === slot);
        if (!layer || !component) continue;
        const content = iconInstance(layer.id, component, components, disabled, template, fg, fgDisabled, size);
        Object.assign(layer, { layout: 'horizontal', padding: 0, gap: 0, padT: 0, padR: 0, padB: 0, padL: 0, fills: [], clip: true, vars: content.slotVars });
        nested.push(...content.nodes);
    }
    return [...copies, ...nested];
}
