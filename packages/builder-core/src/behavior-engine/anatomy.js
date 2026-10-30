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

/** The managed slot defs of a template, in order. */
export function iconDefsOf(template) {
    return Array.isArray(template.icons) ? template.icons : [];
}

/** The slots one placement value shows: one slot, or several (`both` shows the start and the end slot). */
export function slotsOfValue(template, placement, value) {
    const mapped = template.props[placement]?.slots?.[String(value)];
    if (mapped === undefined) return [];
    return Array.isArray(mapped) ? mapped : [mapped];
}

/** The defs that show one anatomy slot: placement defs whose slots map to it, and fixed defs that name it. */
export function slotDefsOf(template, slot) {
    return iconDefsOf(template).filter(def => def.placement !== undefined
        ? Object.values(template.props[def.placement]?.slots ?? {}).flat().includes(slot)
        : def.slot === slot);
}

/** The placement values of one def that show a slot. */
export function placementsOfDef(template, def, slot) {
    if (def.placement === undefined) return [];
    return Object.entries(template.props[def.placement]?.slots ?? {}).filter(([, s]) => [s].flat().includes(slot)).map(([value]) => value);
}

/** The placement values that show a managed slot: `iconStart` is shown for `start` and `both` (see the template's `slots`). */
export function placementsOfSlot(template, slot) {
    return slotDefsOf(template, slot).flatMap(def => placementsOfDef(template, def, slot));
}

/** The control of a template: the text slot drawn as an input, or undefined for plain labels. */
export function controlOf(template) {
    return template.control;
}

/** The behavior data of a managed layer: its slot name, under the `behavior` key. */
/** @param {string} slot */
export function managedBehavior(slot) {
    return { version: BEHAVIOR_DATA_VERSION, slot };
}

/**
 * The operations that bring an instance's managed layers in line with its values. The label slot is not touched. A slot takes the
 * icon the instance chose: a different icon (or none, the placeholder) swaps the slot in place, keeping its position.
 * @param {TemplateSchema} template
 * @param {Record<string, unknown>} values the instance's resolved values, by prop name
 * @param {ChildLayer[]} children the instance root's children, in order
 * @returns {AnatomyOp[]}
 */
export function planAnatomy(template, values, children) {
    /** @type {{ slot: string, component: string | null }[]} */
    const wanted = [];
    for (const def of iconDefsOf(template)) {
        const slots = def.placement !== undefined
            ? (values[def.show] === true ? slotsOfValue(template, def.placement, values[def.placement]) : [])
            : (values[def.show] === true && def.slot ? [def.slot] : []);
        for (const slot of slots) {
            if (wanted.some(w => w.slot === slot)) continue;
            if (!template.anatomy.some(s => s.id === slot && s.managed)) throw new Error(`${template.id} has no managed slot "${slot}"`);
            wanted.push({ slot, component: typeof values[def.component] === 'string' ? values[def.component] : null });
        }
    }
    const want = new Set(wanted.map(w => w.slot));
    /** @type {AnatomyOp[]} */
    const ops = [];
    /** @type {ChildLayer[]} */
    const kept = [];
    for (const c of children) {
        const isWanted = c.slot !== null && want.has(c.slot) && !kept.some(k => k.slot === c.slot);
        if (c.slot === null || isWanted) kept.push(c);
        else ops.push({ op: 'remove', id: c.id });
    }
    if (!wanted.length) return ops;
    const textIndex = template.anatomy.findIndex(s => s.kind === 'text');
    const slotIndex = slot => template.anatomy.findIndex(s => s.id === slot);
    const queue = [...wanted].sort((a, b) => slotIndex(a.slot) - slotIndex(b.slot));
    // A slot anatomically before the label goes first; one after it goes last. Slots are placed in anatomy order.
    const afters = queue.filter(w => slotIndex(w.slot) > textIndex);
    const working = [...kept];
    let missing = queue.filter(w => !working.some(c => c.slot === w.slot)).length;
    let front = 0, placedAfter = 0;
    for (const w of queue) {
        const at = working.findIndex(c => c.slot === w.slot);
        const finalLength = working.length + missing;
        const index = slotIndex(w.slot) < textIndex ? front++ : finalLength - afters.length + placedAfter++;
        if (at === -1) {
            ops.push(w.component ? { op: 'insert', slot: w.slot, index, component: w.component } : { op: 'insert', slot: w.slot, index });
            working.splice(index, 0, { id: `new-${w.slot}`, slot: w.slot });
            missing--;
        }
        else {
            if (at !== index) { ops.push({ op: 'move', id: working[at].id, index }); const [moved] = working.splice(at, 1); working.splice(index, 0, moved); }
            if ((working[index].component ?? null) !== w.component) ops.push({ op: 'swap', id: working[index].id, component: w.component });
        }
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
    const values = resolveProps(template, stored || {});
    return { ops: planAnatomy(template, values, children) };
}
