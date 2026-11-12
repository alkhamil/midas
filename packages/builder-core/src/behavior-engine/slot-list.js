// The slots of a template: ONE list, derived from the template's declaration, that the Behavior panel's Slots block and the component's slot properties both show.
// An entry is a managed icon slot (an icon def), a managed text slot that a prop backs (Title, Description, an affix), or a content slot (`template.slots`). A toggle
// prop (Closable, Action, Extra, ...) is a Prop, never an entry; the part it adds has its entry, which exists only while the toggle holds (no hidden layers).
import { conditionHolds } from './display.js';
import { boxesOf, iconDefOn, iconDefsOf, slotsOfValue } from './anatomy.js';

/**
 * @typedef {{ id: string, name: string, kind: 'icon' | 'text' | 'instance' | 'content' | 'image', prop?: string, accepts?: string[] }} SlotEntry
 * `kind`: `icon` and `instance` hold only instances (an icon slot's glyph, a Link, a Button, an Icon Button); `content` holds anything and is managed in the Design tab;
 * `image` is a frame drawn as a picture (a Card's cover): the image prop `prop` holds the picture, edited in both tabs by one control. `text` is a managed text layer whose text the prop `prop` backs. `prop` also names the icon prop of an `icon` entry.
 */

/**
 * What a content slot holds: only instances (`instance`) or anything (`content`). A slot says so with `holds`; one that names the templates it accepts or starts with
 * seeded instances holds instances, any other holds content.
 * @param {{ holds?: 'instance' | 'content' | 'image', accepts?: string[], seed?: unknown[] }} slot
 * @returns {'instance' | 'content' | 'image'}
 */
export function slotHolds(slot) {
    return slot.holds ?? (slot.accepts?.length || slot.seed?.length ? 'instance' : 'content');
}

/** A name from an id: `descriptionText` is "Description text". */
const nameOf = id => id.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();

/** The name of a managed icon slot: its def's label, else "Icon" plus the slot's own suffix ("Icon close"). */
export function iconNameOf(def) {
    if (def.label) return def.label;
    return def.slot === undefined || /^icon$/i.test(def.slot) ? 'Icon' : `Icon ${def.slot.replace(/^icon/i, '').toLowerCase()}`;
}

/** Whether the container a slot sits in exists for these values (its own condition and its holders'). */
function holderPresent(template, parent, values) {
    for (let id = parent; id !== undefined;) {
        const holder = template.anatomy.find(s => s.id === id);
        if (!holder) return true;
        if (holder.shownWhen !== undefined && !conditionHolds(holder.shownWhen, values)) return false;
        id = holder.parent;
    }
    return true;
}

/**
 * The slots of a template for these resolved prop values, in the order of the layers (the anatomy first, a content slot where its container is, the rest last): only the
 * ones that exist now. Both the Behavior panel and the component's slot properties show exactly this list.
 * @param {any} template
 * @param {Record<string, unknown>} values the resolved props
 * @returns {SlotEntry[]}
 */
export function slotListOf(template, values) {
    /** @type {{ rank: number, entry: SlotEntry }[]} */
    const found = [];
    const anatomyRank = id => { const at = template.anatomy.findIndex(s => s.id === id); return at < 0 ? template.anatomy.length : at; };
    // Managed icon slots: one entry per def that is on.
    for (const def of iconDefsOf(template)) {
        if (!def.component || !iconDefOn(def, values)) continue;
        if (def.placement !== undefined && def.slot !== undefined && !slotsOfValue(template, def.placement, values[def.placement]).includes(def.slot)) continue;
        found.push({ rank: anatomyRank(def.slot ?? ''), entry: { id: def.slot ?? def.component, name: iconNameOf(def), kind: 'icon', prop: def.component } });
    }
    // Managed text slots a prop backs (Title, Description, the affixes): shown while their condition holds.
    for (const slot of template.anatomy) {
        if (slot.kind !== 'text' || !slot.optional && !slot.managed) continue;
        const backing = Object.entries(template.props).find(([, def]) => def.source === 'literal' && def.node?.key === slot.id && def.node.field === 'text');
        if (!backing) continue;
        // The slot is there while the switches that enable it hold, whether or not its text is empty yet (an empty text is the slot, waiting for its text).
        const probe = { ...values, [backing[0]]: values[backing[0]] === '' || values[backing[0]] == null ? 'x' : values[backing[0]] };
        if (slot.shownWhen !== undefined && !conditionHolds(slot.shownWhen, probe)) continue;
        if (!holderPresent(template, slot.parent, probe)) continue;
        found.push({ rank: anatomyRank(slot.id), entry: { id: slot.id, name: slot.name ?? nameOf(slot.id), kind: 'text', prop: backing[0] } });
    }
    // Content slots: while their condition and their containers hold.
    for (const slot of template.slots ?? []) {
        if (slot.shownWhen !== undefined && !conditionHolds(slot.shownWhen, values)) continue;
        // The container it is (one of them exists at a time) or the one it sits in must be there.
        const boxes = boxesOf(slot);
        const box = boxes.find(b => holderPresent(template, b, values) && conditionHolds(template.anatomy.find(s => s.id === b)?.shownWhen ?? { all: [] }, values));
        if (boxes.length ? box === undefined : !holderPresent(template, slot.parent, values)) continue;
        const holds = slotHolds(slot);
        // An image slot is backed by the image prop that draws on its box.
        const imageProp = holds === 'image' ? Object.entries(template.props).find(([, def]) => def.type === 'image' && [def.node, ...(def.nodes ?? [])].some(w => boxes.includes(w?.key)))?.[0] : undefined;
        // A slot in a container comes after the container's own layers (a Card's Extra after its Title), as Play and the export draw it.
        const lastIn = id => Math.max(anatomyRank(id), ...template.anatomy.filter(s => s.parent === id).map(s => anatomyRank(s.id)));
        const rank = box !== undefined ? anatomyRank(box) + 0.5 : slot.parent !== undefined ? lastIn(slot.parent) + 0.5 : template.anatomy.length + 1;
        found.push({ rank, entry: { id: slot.id, name: slot.name, kind: holds, ...(imageProp ? { prop: imageProp } : {}), ...(slot.accepts ? { accepts: slot.accepts } : {}) } });
    }
    // A stable sort keeps the declared order within a rank.
    return found.map((f, i) => ({ ...f, i })).sort((a, b) => a.rank - b.rank || a.i - b.i).map(f => f.entry);
}
