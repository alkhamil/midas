// Anatomy sync (stage 6). A template's managed slots (icon layers) exist as layers only on instances, and only as many as the
// instance's values ask for. The planner is pure: it returns the operations that make an instance's child layers match its
// values. The editor applies them inside one transaction. Running it again on the result gives no operations.
import { TEMPLATES } from './registry.js';
import { BEHAVIOR_DATA_VERSION } from './data.js';
import { resolveProps } from './instance-props.js';
import { conditionHolds } from './display.js';
import { iconRoleOf } from './icon-set.js';

/** @typedef {import('../templates/schema.js').TemplateSchema} TemplateSchema */
/** @typedef {{ id: string, slot: string | null, name?: string, component?: string | null, parent?: string }} ChildLayer  an instance's child, in order; slot is its managed slot marker; name is its layer name (an anatomy slot's id for the layers the anatomy names); component is the icon component the slot shows (null for the placeholder); parent is the container group the layer hangs under, absent for a direct child */
/**
 * @typedef {{ op: 'remove', id: string }
 *   | { op: 'move', id: string, index: number }
 *   | { op: 'insert', slot: string, index: number, component?: string, parent?: string }
 *   | { op: 'swap', id: string, component: string | null }} AnatomyOp
 */

/**
 * Where a managed slot that follows the label goes among the layers: just before the first layer the anatomy puts after it (the Input's
 * clear icon before its suffix text), or last when there is none. A layer the anatomy does not name (a part, the label's own layer) does
 * not move the slot. Used by the editor's plan and by the generator, so both draw one order.
 * @param {TemplateSchema} template
 * @param {string} slot the managed slot's id
 * @param {{ slot?: string | null, name?: string }[]} layers the layers the slot goes among, in order, without the slot itself
 * @returns {number}
 */
/** The containers of the anatomy a content slot is (`box`: one, or several of which one exists at a time, like a Card's cover above or below its head). */
export const boxesOf = slot => [slot.box ?? []].flat();

export function indexAmongLaterSlots(template, slot, layers) {
    // A content slot ranks after every anatomy slot, in its own order (see planAnatomy).
    const rank = (/** @type {string | null | undefined} */ id) => {
        if (id === undefined || id === null) return -1;
        // A content slot that is a container of the anatomy (`box`) ranks where that container does.
        const boxed = boxesOf((template.slots ?? []).find(s => s.id === id) ?? {})[0];
        const at = template.anatomy.findIndex(s => s.id === (boxed ?? id));
        return at >= 0 ? at : (template.slots ?? []).findIndex(s => s.id === id) >= 0 ? template.anatomy.length + (template.slots ?? []).findIndex(s => s.id === id) : -1;
    };
    const own = rank(slot);
    const at = layers.findIndex(layer => rank(layer.slot ?? layer.name) > own);
    return at === -1 ? layers.length : at;
}

/**
 * The layers of an instance the editor binds to the icon tokens, in order: each managed icon slot (never a managed text layer: it follows the text tokens; the layer holds the icon, which carries the
 * colour) and each part that holds icon tokens (the spinner draws the colour itself). One function binds them all (iconSlotBindings).
 * @param {TemplateSchema} template
 * @returns {{ key: string, kind: 'slot' | 'part' }[]}
 */
export function iconBoundKeysOf(template) {
    return [
        ...template.anatomy.filter(s => s.managed && s.kind === 'icon').map(s => ({ key: s.id, kind: /** @type {const} */ ('slot') })),
        ...(template.parts ?? []).filter(p => p.tokens !== undefined).map(p => ({ key: p.id, kind: /** @type {const} */ ('part') })),
    ];
}

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
    return iconDefsOf(template).filter(def => def.slot !== undefined
        ? def.slot === slot
        : def.placement !== undefined && Object.values(template.props[def.placement]?.slots ?? {}).flat().includes(slot));
}

/** Swap icons drawn inside a container: prop-only defs whose toggleState press sits on the container. */
export function swapDefsOf(template, slotId) {
    return iconDefsOf(template).filter(d => d.swap && (template.press ?? []).some(p => p.toggleState === d.swap.by && p.slot === slotId));
}

/** The placement values of one def that show a slot. */
export function placementsOfDef(template, def, slot) {
    if (def.placement === undefined) return [];
    return Object.entries(template.props[def.placement]?.slots ?? {}).filter(([, s]) => [s].flat().includes(slot)).map(([value]) => value);
}

/** The placement values that show a managed slot: Button's `iconStart` is shown for `start`, Input's `prefixIcon` for `icon` (see the prop's `slots`). */
export function placementsOfSlot(template, slot) {
    return slotDefsOf(template, slot).flatMap(def => placementsOfDef(template, def, slot));
}

/**
 * Whether an icon def's show condition holds for these resolved values: no switch, a boolean switch
 * prop that is true, or a state gate (`{ prop, is }`, for a slot shown while a boolean prop holds a value).
 */
export function showOn(show, values) {
    if (show === undefined) return true;
    if (typeof show === 'string') return values[show] === true;
    return values[show.prop] === show.is;
}
/** Whether an icon def is on for these resolved values: its switch is on, or it has none because its slot is `alwaysVisible`. */
export function iconDefOn(def, values) {
    return showOn(def.show, values);
}

/** Whether the managed slot of an icon def is shown for these resolved values: the def is on and its placement (if any) picks the slot. */
function iconDefShown(template, def, values) {
    if (!iconDefOn(def, values)) return false;
    return def.placement === undefined || slotsOfValue(template, def.placement, values[def.placement]).includes(def.slot);
}

/**
 * The icon each slot takes when it starts to show with no icon chosen: the document's default icon, in the prop that holds the slot's icon.
 * A slot starts to show when its switch is turned on, or when its placement or kind comes to pick it (Input's Text to Icon). A slot that was
 * already shown, or already holds an icon (a remembered one included), is left as it is, so an icon cleared on purpose stays cleared.
 * Pure: the caller stores the returned writes.
 * @param {TemplateSchema} template
 * @param {Record<string, unknown> | null} prev the instance's stored props before the edit; null when the instance is being created (nothing was shown before)
 * @param {Record<string, unknown>} next the stored props after it
 * @param {string | null} defaultIcon the id of the default icon, or null when the document has none
 * @param {Record<string, string>} [roleIcons] the file's glyph for each role (roleIconsOf): a def that names a role takes its glyph, else the default
 * @param {Record<string, string | null>} [modes] the instance's mode name for each variable prop (a role map reads its type from here: variable props are not stored)
 * @returns {Record<string, string>} prop name to icon id
 */
export function newlyShownIconDefaults(template, prev, next, defaultIcon, roleIcons = {}, modes = {}) {
    if (!defaultIcon && Object.keys(roleIcons).length === 0) return {};
    const before = prev === null ? null : resolveProps(template, /** @type {any} */ (prev)), after = resolveProps(template, /** @type {any} */ (next));
    /** @type {Record<string, string>} */
    const writes = {};
    for (const def of iconDefsOf(template)) {
        if (!def.component) continue;
        const role = def.role !== undefined ? iconRoleOf(def, { ...after, ...modes }) : null;
        const fallback = (role !== null && roleIcons[role]) || defaultIcon;
        if (!fallback) continue;
        // An always visible slot is never switched on: it takes the default icon while none was ever chosen (no stored value), and an icon cleared on purpose (stored null) stays cleared.
        if (def.show === undefined) {
            if ((prev === null || prev[def.component] === undefined) && next[def.component] == null) writes[def.component] = fallback;
            continue;
        }
        const shownNow = iconDefShown(template, def, after);
        // A glyph picked by its mode (a role map) follows the mode: a slot that is shown with no glyph, or with one of the file's role glyphs (its own default
        // from another mode), takes the glyph of the current mode. A glyph the user picked is none of those, and stays.
        if (typeof def.role === 'object') {
            if (!shownNow) continue;
            const stored = next[def.component];
            const isRoleGlyph = stored != null && Object.values(def.role.map).some(r => roleIcons[r] === stored);
            if ((stored == null || isRoleGlyph) && stored !== fallback) writes[def.component] = fallback;
            continue;
        }
        if ((before !== null && iconDefShown(template, def, before)) || !shownNow) continue;
        if (after[def.component] == null) writes[def.component] = fallback;
    }
    return writes;
}

/**
 * The icon each slot takes when its instance is created: the edit rule (newlyShownIconDefaults) with nothing shown before, so a slot that is on from the
 * start (an always visible one, or a switch on by default) holds the default icon from the first frame. A new Button or Input has no icon on: no writes.
 * @param {TemplateSchema} template
 * @param {Record<string, unknown>} props the stored props of the new instance
 * @param {string | null} defaultIcon the id of the default icon, or null when the document has none
 * @returns {Record<string, string>} prop name to icon id
 */
export function createdIconDefaults(template, props, defaultIcon, roleIcons = {}, modes = defaultModesOf(template)) {
    return newlyShownIconDefaults(template, null, props, defaultIcon, roleIcons, modes);
}

/**
 * The mode each variable prop of a template starts in: its default mode name (a new instance, before any mode is chosen).
 * @param {TemplateSchema} template
 * @returns {Record<string, string | null>}
 */
export function defaultModesOf(template) {
    return Object.fromEntries(Object.entries(template.props).filter(([, def]) => def.source === 'variable').map(([prop, def]) => [prop, /** @type {any} */ (def).defaultMode ?? null]));
}

/**
 * The prop writes that carry icons across a placement change, by prop name. The live icon moves to the newly shown
 * slot; showing both keeps each side, duplicating the shown icon only where the other side has none. Sides the
 * placement hides keep their props (slot memory); nothing is cleared. Pure: the caller stores the returned writes.
 */
export function carryPlacementIcons(template, placement, prev, next) {
    const prevSlots = slotsOfValue(template, placement, prev[placement]);
    const nextSlots = slotsOfValue(template, placement, next);
    if (!prevSlots.length || !nextSlots.length) return {};
    const liveOn = slot => {
        for (const def of iconDefsOf(template)) {
            if (!showOn(def.show, prev)) continue;
            if (def.slot !== undefined && def.slot !== slot) continue;
            if (slotsOfValue(template, def.placement, prev[def.placement]).includes(slot) && typeof prev[def.component] === 'string') return prev[def.component];
        }
        return null;
    };
    const writerFor = (slot, values) => {
        for (const def of iconDefsOf(template)) {
            if (!showOn(def.show, values)) continue;
            if (def.slot !== undefined && def.slot !== slot) continue;
            if (def.component && slotsOfValue(template, def.placement, values[def.placement]).includes(slot)) return def.component;
        }
        return null;
    };
    const writes = {};
    if (prevSlots.length === 1 && nextSlots.length === 1 && prevSlots[0] !== nextSlots[0]) {
        const target = writerFor(nextSlots[0], { ...prev, [placement]: next });
        if (target) writes[target] = liveOn(prevSlots[0]);
    }
    else if (prevSlots.length === 1 && nextSlots.length > 1) {
        const shown = liveOn(prevSlots[0]);
        for (const slot of nextSlots) {
            if (slot === prevSlots[0]) continue;
            const target = writerFor(slot, { ...prev, [placement]: next });
            if (target && !(typeof prev[target] === 'string')) writes[target] = shown;
        }
    }
    return writes;
}

/** Whether the container a managed slot sits in allows it: a slot inside a conditional container exists only while the container's own condition holds (no container, no content). */
export function holderAllows(template, slot, values) {
    const holder = slot.parent === undefined ? undefined : template.anatomy.find(s => s.id === slot.parent);
    return holder?.shownWhen === undefined || conditionHolds(holder.shownWhen, values);
}

/** Whether a template's anatomy declares a required text or control slot (its label). A template without one has no label to order against. */
export function hasTextSlot(template) {
    return template.anatomy.some(s => (s.kind === 'text' || s.kind === 'control') && !s.optional);
}

/**
 * The primary text part of a template: the part a fresh instance shows and the text content property edits. Null when the template
 * declares none (a template with no text part); validate-schema.js names a malformed declaration.
 * @param {{ primarySlot?: unknown }} template
 * @returns {string | null}
 */
export function primarySlotOf(template) {
    return typeof template.primarySlot === 'string' ? template.primarySlot : null;
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
 * @param {ChildLayer[]} children the instance root's children, in stored order
 * @param {boolean} [flip] true when the instance root is a flipped auto layout (its children are stored back to front,
 * so placement means the visual start and end after the flip)
 * @returns {AnatomyOp[]} indexes are stored indexes, for the editor to apply in place
 */
/**
 * The managed slots a shown canvas part replaces: a part with `replaces` takes its slot's place while it is shown (the spinner takes the
 * start icon's place while loading), so that slot is not drawn.
 * @param {any} template
 * @param {Record<string, unknown>} values the resolved props
 * @returns {string[]}
 */
export function replacedSlotsOf(template, values) {
    return (template.parts ?? []).filter(part => (part.replaces || part.side) && conditionHolds(part.shownWhen, values))
        .flatMap(part => (part.side ? slotsOfValue(template, part.side, values[part.side] ?? template.props[part.side].default) : [part.replaces]));
}

/**
 * Whether a content slot is a layer of an instance only while something holds: its own condition, or the managed container it sits in (a slot in the Alert's action box
 * is there exactly while the action box is). Any other content slot belongs to the main component and the instance never adds or removes it.
 * @param {any} template
 * @param {{ id: string, shownWhen?: any, parent?: string, box?: string }} slot
 */
export function isConditionalSlot(template, slot) {
    if (boxesOf(slot).length) return false;
    return slot.shownWhen !== undefined || (slot.parent !== undefined && template.anatomy.some(s => s.id === slot.parent && s.managed));
}

export function planAnatomy(template, values, children, flip = false) {
    // A layer is planned by its slot only when the template makes that slot conditional (a content slot with shownWhen); a content slot the
    // props do not gate is the instance's own and is never removed here, so its layer reads as no slot.
    children = children.map(c => (c.slot !== null && !template.anatomy.some(s => s.id === c.slot) && !(template.slots ?? []).some(s => s.id === c.slot && isConditionalSlot(template, s)) ? { ...c, slot: null } : c));
    /** @type {{ slot: string, component: string | null }[]} */
    const wanted = [];
    const replaced = new Set(replacedSlotsOf(template, values));
    for (const def of iconDefsOf(template)) {
        // A swap icon without a managed anatomy slot is prop-only: Play and the export draw it from its component, so the canvas holds no layer for it.
        if (def.swap && def.slot && !template.anatomy.some(s => s.id === def.slot && s.managed)) continue;
        const slots = def.placement !== undefined
            ? (iconDefOn(def, values) ? slotsOfValue(template, def.placement, values[def.placement]).filter(s => def.slot === undefined || s === def.slot) : [])
            : (iconDefOn(def, values) && def.slot ? [def.slot] : []);
        for (const slot of slots) {
            if (replaced.has(slot) || wanted.some(w => w.slot === slot)) continue;
            if (!template.anatomy.some(s => s.id === slot && s.managed)) throw new Error(`${template.id} has no managed slot "${slot}"`);
            wanted.push({ slot, component: typeof values[def.component] === 'string' ? values[def.component] : null });
        }
    }
    // A managed text or control layer is wanted while its slot's condition holds; its text is the prop's, so it carries no component.
    for (const slot of template.anatomy) {
        if (slot.managed && slot.kind !== 'icon' && conditionHolds(slot.shownWhen, values) && holderAllows(template, slot, values) && !wanted.some(w => w.slot === slot.id)) wanted.push({ slot: slot.id, component: null });
    }
    // A content slot the props show while they hold is a layer only while its condition holds (never hidden): its content is the instance's own.
    for (const slot of template.slots ?? []) if (isConditionalSlot(template, slot) && (slot.shownWhen === undefined || conditionHolds(slot.shownWhen, values)) && holderAllows(template, slot, values) && !wanted.some(w => w.slot === slot.id)) wanted.push({ slot: slot.id, component: null });
    const want = new Set(wanted.map(w => w.slot));
    /** @type {AnatomyOp[]} */
    const ops = [];
    /** @type {ChildLayer[]} */
    const kept = [];
    // Positions are visual: on a flipped root the stored list reads back to front.
    const storedIndexOf = (visual, finalLength) => (flip ? finalLength - 1 - visual : visual);
    for (const c of children) {
        const isWanted = c.slot !== null && want.has(c.slot) && !kept.some(k => k.slot === c.slot);
        if (c.slot === null || isWanted) kept.push(c);
        else ops.push({ op: 'remove', id: c.id });
    }
    if (!wanted.length) return ops;
    // The slots before the primary text part go first. A template with no primary part orders against its first required text slot.
    const primary = primarySlotOf(template);
    const textIndex = primary !== null ? template.anatomy.findIndex(s => s.id === primary) : template.anatomy.findIndex(s => (s.kind === 'text' || s.kind === 'control') && !s.optional);
    // A content slot ranks after every anatomy slot, in its own order (it is the last layer, as the codegen draws it).
    const slotIndex = slot => { const at = template.anatomy.findIndex(s => s.id === slot); return at >= 0 ? at : template.anatomy.length + (template.slots ?? []).findIndex(s => s.id === slot); };
    const queue = [...wanted].sort((a, b) => slotIndex(a.slot) - slotIndex(b.slot));
    // A slot anatomically before the label goes first; one after it goes before the first layer the anatomy puts after it, else last.
    // Slots are placed in anatomy order.
    // A slot inside a container is placed by the container: it is the only layer there, so it has no order of its own and no index among the root's layers.
    const parentOf = slot => template.anatomy.find(s => s.id === slot)?.parent ?? (template.slots ?? []).find(s => s.id === slot)?.parent;
    // A root slot is ordered among the root's own layers only: a container's content (the Switch spinner under the handle) is not a direct
    // child, so counting it would land every later slot one short of where the editor inserts, and the backstop would see a permanent move.
    const working = (flip ? [...kept].reverse() : [...kept]).filter(c => c.slot === null ? c.parent == null : parentOf(c.slot) === undefined);
    let missing = queue.filter(w => parentOf(w.slot) === undefined && !working.some(c => c.slot === w.slot)).length;
    let front = 0;
    // The layers of each container, by slot, so a slot is inserted among its siblings in anatomy order (a container holding three has them in the order the anatomy names).
    const inside = new Map();
    for (const c of kept) if (c.slot !== null && c.parent !== undefined) inside.set(c.parent, [...(inside.get(c.parent) ?? []), c.slot]);
    for (const w of queue) {
        const parent = parentOf(w.slot);
        if (parent !== undefined) {
            const held = kept.find(c => c.slot === w.slot);
            const siblings = inside.get(parent) ?? [];
            const index = siblings.filter(s => s !== w.slot && slotIndex(s) < slotIndex(w.slot)).length;
            if (!held) { inside.set(parent, [...siblings, w.slot]); ops.push(w.component ? { op: 'insert', slot: w.slot, index, parent, component: w.component } : { op: 'insert', slot: w.slot, index, parent }); }
            else if ((held.component ?? null) !== w.component) ops.push({ op: 'swap', id: held.id, component: w.component });
            continue;
        }
        const at = working.findIndex(c => c.slot === w.slot);
        const finalLength = working.length + missing;
        const index = slotIndex(w.slot) < textIndex ? front++ : indexAmongLaterSlots(template, w.slot, working.filter((c, i) => i !== at));
        const atStored = storedIndexOf(index, finalLength);
        if (at === -1) {
            ops.push(w.component ? { op: 'insert', slot: w.slot, index: atStored, component: w.component } : { op: 'insert', slot: w.slot, index: atStored });
            working.splice(index, 0, { id: `new-${w.slot}`, slot: w.slot });
            missing--;
        }
        else {
            if (at !== index) { ops.push({ op: 'move', id: working[at].id, index: atStored }); const [moved] = working.splice(at, 1); working.splice(index, 0, moved); }
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
 *   stored: Record<string, string | boolean | null> | undefined, children: ChildLayer[], flip?: boolean
 * }} input `flip` is true when the instance root is a flipped auto layout (see planAnatomy)
 * @returns {{ ops: AnatomyOp[], reason?: string }}
 */
export function planInstanceAnatomy({ binding, masterRoot, masterTree, stored, children, flip = false }) {
    const template = binding && 'templateId' in binding ? TEMPLATES.get(binding.templateId) : undefined;
    if (!template) return { ops: children.filter(c => c.slot !== null).map(c => /** @type {AnatomyOp} */ ({ op: 'remove', id: c.id })) };
    // The label slot: the master's first text layer inside its root auto layout (tree is depth first). Nothing is guessed. A template that
    // declares no text slot has no label to find: its managed slots are placed against the root.
    if (!masterRoot.isAutoLayout) return { ops: [], reason: 'the master is not an auto layout frame' };
    if (hasTextSlot(template) && !masterTree.some(n => n.type === 'text')) return { ops: [], reason: 'the master has no text layer' };
    const values = resolveProps(template, stored || {});
    return { ops: planAnatomy(template, values, children, flip) };
}
