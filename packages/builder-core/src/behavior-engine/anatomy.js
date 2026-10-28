// Anatomy sync (stage 6). A template's managed slots (icon layers) exist as layers only on instances, and only as many as the
// instance's values ask for. The planner is pure: it returns the operations that make an instance's child layers match its
// values. The editor applies them inside one transaction. Running it again on the result gives no operations.
import { TEMPLATES } from './registry.js';
import { BEHAVIOR_DATA_VERSION } from './data.js';
import { resolveProps } from './instance-props.js';

/** @typedef {import('../templates/schema.js').TemplateSchema} TemplateSchema */
/** @typedef {{ id: string, slot: string | null, component?: string | null }} ChildLayer  an instance's child, in order; slot is its managed slot marker; component is the icon component the slot shows (null for the placeholder) */
/**
 * @typedef {{ op: 'remove', id: string }
 *   | { op: 'move', id: string, index: number }
 *   | { op: 'insert', slot: string, index: number, component?: string }
 *   | { op: 'swap', id: string, component: string | null }} AnatomyOp
 */

/** The managed slot each icon placement uses. Removals come first in a plan; moves and inserts give the final index in the child list. */
export const SLOT_OF_PLACEMENT = { start: 'iconStart', end: 'iconEnd' };

/** The behavior data of a managed layer: its slot name, under the `behavior` key. */
/** @param {string} slot */
export function managedBehavior(slot) {
    return { version: BEHAVIOR_DATA_VERSION, slot };
}

/**
 * The operations that bring an instance's managed layers in line with its values. The label slot is not touched. A slot takes the
 * icon the instance chose: a different icon (or none, the placeholder) swaps the slot in place, keeping its position.
 * @param {TemplateSchema} template
 * @param {{ hasIcon: boolean, iconPlacement: string, icon?: string | null }} values the instance's resolved values
 * @param {ChildLayer[]} children the instance root's children, in order
 * @returns {AnatomyOp[]}
 */
function planAnatomy(template, values, children) {
    const managed = template.anatomy.filter(s => s.managed).map(s => s.id);
    const want = values.hasIcon ? SLOT_OF_PLACEMENT[/** @type {'start' | 'end'} */ (values.iconPlacement)] : null;
    const icon = want && typeof values.icon === 'string' ? values.icon : null;
    if (want && !managed.includes(want)) throw new Error(`${template.id} has no managed slot "${want}"`);
    /** @type {AnatomyOp[]} */
    const ops = [];
    /** @type {ChildLayer[]} */
    const kept = [];
    for (const c of children) {
        const isWanted = c.slot !== null && c.slot === want && !kept.some(k => k.slot === want);
        if (c.slot === null || isWanted) kept.push(c);
        else ops.push({ op: 'remove', id: c.id });
    }
    if (!want) return ops;
    const placed = kept.find(c => c.slot === want);
    const finalLength = kept.length + (placed ? 0 : 1);
    const index = want === SLOT_OF_PLACEMENT.start ? 0 : finalLength - 1;
    if (!placed) ops.push(icon ? { op: 'insert', slot: want, index, component: icon } : { op: 'insert', slot: want, index });
    else {
        if (kept.indexOf(placed) !== index) ops.push({ op: 'move', id: placed.id, index });
        if ((placed.component ?? null) !== icon) ops.push({ op: 'swap', id: placed.id, component: icon });
    }
    return ops;
}

/**
 * The plan for one instance, from its master's binding and label and the instance's stored props. An unbound master (or one
 * whose template is unknown) has no managed layers, so every managed layer goes; this needs no label. A bound master whose
 * label cannot be resolved gets no operations and the reason.
 * @param {{
 *   binding: any, masterRoot: { isAutoLayout: boolean }, masterTree: { id: string, type: string }[],
 *   stored: Record<string, string | boolean | null> | undefined, children: ChildLayer[]
 * }} input
 * @returns {{ ops: AnatomyOp[], reason?: string }}
 */
export function planInstanceAnatomy({ binding, masterRoot, masterTree, stored, children }) {
    const template = binding && 'templateId' in binding ? TEMPLATES.get(binding.templateId) : undefined;
    if (!template) return { ops: children.filter(c => c.slot !== null).map(c => /** @type {AnatomyOp} */ ({ op: 'remove', id: c.id })) };
    // The label slot: the master's first text layer inside its root auto layout (tree is depth first). Nothing is guessed.
    if (!masterRoot.isAutoLayout) return { ops: [], reason: 'the master is not an auto layout frame' };
    if (!masterTree.some(n => n.type === 'text')) return { ops: [], reason: 'the master has no text layer' };
    const values = /** @type {{ hasIcon: boolean, iconPlacement: string }} */ (resolveProps(template, stored || {}));
    return { ops: planAnatomy(template, values, children) };
}
