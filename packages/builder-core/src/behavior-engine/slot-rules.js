// The rules of a content slot (pure): how many layers it holds, which components it takes, and what the studio says about it. They read the
// slot's component property (`{ type: 'slot', min, max, onlyPreferred, preferred, showEmpty, fillCounter }`, see content-slots.js). The
// studio used to decide these inline, in the picker and in the property editor; it calls them, so every way content enters a slot can ask
// the same question.

/** The options of the slot editor that are checkboxes: they write a boolean on the property. */
export const SLOT_OPTIONS = ['onlyPreferred', 'showEmpty', 'fillCounter'];

/**
 * A limit typed in the slot editor: empty is none (null), otherwise a whole number rounded down. A maximum is at least 1 and a minimum at
 * least 0, so a value that is not a number, or is below that, is the lowest the limit can be.
 * @param {string} raw the field's text
 * @param {'min' | 'max'} kind
 * @returns {number | null}
 */
export function slotLimitFrom(raw, kind) {
    return raw.trim() === '' ? null : Math.max(kind === 'max' ? 1 : 0, Math.floor(+raw) || 0);
}

/**
 * Where a slot's count stands against its limits: `belowMin` (fewer than the minimum), `aboveMax` (more than the maximum) and `full` (at the
 * maximum, so one more would not fit). A missing, null or zero limit is no limit.
 * @param {{ min?: number | null, max?: number | null } | null | undefined} prop the slot property
 * @param {number} count the layers in the slot
 * @returns {{ belowMin: boolean, aboveMax: boolean, full: boolean }}
 */
export function slotCounts(prop, count) {
    return { belowMin: !!(prop?.min && count < prop.min), aboveMax: !!(prop?.max && count > prop.max), full: !!(prop?.max && count >= prop.max) };
}

/**
 * What the studio says when a slot is full.
 * @param {number} max
 * @returns {string}
 */
export function slotFullMessage(max) {
    return `This slot holds at most ${max} layer${max === 1 ? '' : 's'}.`;
}

/**
 * The label of a slot's row on an instance: how many layers it holds, or Empty.
 * @param {number} count
 * @returns {string}
 */
export function slotCountLabel(count) {
    return count ? `${count} layer${count === 1 ? '' : 's'}` : 'Empty';
}

/**
 * Whether a slot takes only some components: it only allows its preferred instances, and it has some. Every other slot takes anything.
 * @param {{ onlyPreferred?: boolean, preferred?: string[] } | null | undefined} prop
 * @returns {boolean}
 */
export function slotRestricts(prop) {
    return !!(prop?.onlyPreferred && prop.preferred?.length);
}

/**
 * Whether a slot takes a component: a slot that restricts takes exactly its preferred instances, every other slot takes anything. A layer
 * with no slot property takes anything.
 * @param {{ onlyPreferred?: boolean, preferred?: string[] } | null | undefined} prop
 * @param {string} candidateId the component's id
 * @returns {boolean}
 */
export function slotAccepts(prop, candidateId) {
    return !slotRestricts(prop) || !!prop?.preferred?.includes(candidateId);
}

/**
 * The preferred instances of a slot with one more, once. The property is not changed.
 * @param {{ preferred?: string[] }} prop
 * @param {string} id
 * @returns {string[]}
 */
export function slotPreferredWith(prop, id) {
    return [...new Set([...(prop.preferred || []), id])];
}

/**
 * The preferred instances of a slot without one. The property is not changed.
 * @param {{ preferred?: string[] }} prop
 * @param {string} id
 * @returns {string[]}
 */
export function slotPreferredWithout(prop, id) {
    return (prop.preferred || []).filter(x => x !== id);
}

/**
 * What a checkbox of the slot editor writes: its key and value, when the key is one of the slot options, else nothing.
 * @param {string} key
 * @param {boolean} checked
 * @returns {Record<string, boolean>}
 */
export function slotOptionPatch(key, checked) {
    return SLOT_OPTIONS.includes(key) ? { [key]: checked } : {};
}

/**
 * Whether a content slot of an instance is shown: the slot layer is visible in the main component, and it either holds a layer or the slot asks
 * to be displayed empty (`showEmpty`). An empty slot that does not ask takes no space: the layer is hidden, so the canvas layout, Play and the
 * export all skip it, as they skip any hidden layer. A layer with no slot property is left as its own visibility says.
 * @param {{ showEmpty?: boolean } | null | undefined} prop the slot property
 * @param {boolean} ownVisible whether the slot layer itself is visible in the main component
 * @param {number} count the layers in the slot
 * @returns {boolean}
 */
export function slotVisible(prop, ownVisible, count) {
    if (!prop) return ownVisible;
    return ownVisible && (count > 0 || prop.showEmpty === true);
}

/**
 * What a layer put into a slot takes on the slot's counter axis, as the fields to write on it: `fill`, once, when it is put there (not a
 * standing rule: the layer can be resized afterwards). A horizontal slot fills its counter axis, the height, on its own, as Figma does; a
 * vertical slot fills its counter axis, the width, only when the slot asks (`fillCounter`). A slot that is not an auto layout, or a layer
 * with no slot property, writes nothing.
 * @param {{ fillCounter?: boolean } | null | undefined} prop the slot property
 * @param {string | null | undefined} layout the slot's auto layout: `horizontal`, `vertical`, or none
 * @returns {{ layoutSizingH?: 'fill', layoutSizingV?: 'fill' }}
 */
export function slotFillPatch(prop, layout) {
    if (!prop) return {};
    if (layout === 'horizontal') return { layoutSizingV: 'fill' };
    if (layout === 'vertical' && prop.fillCounter === true) return { layoutSizingH: 'fill' };
    return {};
}
