// The slot property and the "+" badge of a content slot (pure). Making a frame a slot adds a component property of type `slot` to its main
// component and binds the frame to it (see content-slots.js); the canvas draws a pink "+" badge where the next layer would go. The studio
// used to hold these inline; it calls them, so the generator can write the same property from a template schema.

/** The radius of the "+" badge, in screen px. */
export const SLOT_BADGE_RADIUS = 9;

/**
 * A name for a new slot property: the layer's name (Slot when it has none), made unique among the names the holder already uses by adding
 * " 2", " 3", and so on.
 * @param {string | undefined} name the layer's name
 * @param {Set<string>} taken the property and variant names of the holder
 * @returns {string}
 */
export function uniqueSlotName(name, taken) {
    const base = String(name || 'Slot').trim() || 'Slot';
    let unique = base, k = 1;
    while (taken.has(unique)) unique = `${base} ${++k}`;
    return unique;
}

/**
 * A new slot property, with no default.
 * @param {string} id
 * @param {string} name
 * @returns {{ id: string, name: string, type: 'slot', def: null }}
 */
export function newSlotProp(id, name) {
    return { id, name, type: 'slot', def: null };
}

/**
 * The properties of a holder without one: what is left when a frame stops being a slot.
 * @param {{ id: string }[]} props
 * @param {string} id
 * @returns {{ id: string }[]}
 */
export function slotPropsWithout(props, id) {
    return props.filter(p => p.id !== id);
}

/**
 * Where the "+" badge of a slot is drawn, in the box's own units: the middle of an empty slot, else where the next layer would go, the right
 * edge of a horizontal auto layout (centred vertically) or the bottom edge of any other (centred horizontally).
 * @param {{ x: number, y: number, w: number, h: number }} box the slot's box
 * @param {{ empty: boolean, horizontal: boolean }} slot
 * @returns {{ cx: number, cy: number, r: number }}
 */
export function slotBadgeCenter({ x, y, w, h }, { empty, horizontal }) {
    return {
        cx: empty ? x + w / 2 : horizontal ? x + w : x + w / 2,
        cy: empty ? y + h / 2 : horizontal ? y + h / 2 : y + h,
        r: SLOT_BADGE_RADIUS,
    };
}

/**
 * The badge a point hits: the first one drawn whose circle holds the point. Null for none.
 * @param {{ cx: number, cy: number, r: number }[] | undefined} badges
 * @param {{ x: number, y: number }} p
 * @returns {any}
 */
export function slotBadgeAt(badges, p) {
    return (badges || []).find(b => Math.hypot(b.cx - p.x, b.cy - p.y) <= b.r) || null;
}
