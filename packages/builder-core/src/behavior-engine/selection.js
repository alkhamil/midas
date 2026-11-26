// Selection among the items of a box (a Tabs' tabs). A template's exclusive toggle prop (`toggle.exclusive`) selects one item: turning it on turns
// the prop off on the siblings that hold it on. Pure: the studio writes the result.

/**
 * The sibling items to turn their selection prop off, when `instance` is set to `value`: only for the template's exclusive toggle prop, turned on.
 * @param {any} template
 * @param {string} prop the prop being written
 * @param {unknown} value what it is set to
 * @param {{ id: string, behavior?: { props?: Record<string, unknown> } }[]} siblings the items of the same box
 * @param {{ id: string }} instance the item being written
 * @returns {typeof siblings} the siblings (not the instance) that are selected now
 */
export function siblingsToDeselect(template, prop, value, siblings, instance) {
    if (value !== true || template?.toggle?.exclusive !== true || template.toggle.prop !== prop) return [];
    return siblings.filter(s => s.id !== instance.id && s.behavior?.props?.[prop] === true);
}

/**
 * The id of the item to select when none of the items is (the first), else null: a box that starts with its first item selected.
 * @param {{ id: string, behavior?: { props?: Record<string, unknown> } }[]} items
 * @param {string} prop the selection prop
 * @returns {string | null}
 */
export function selectedAtStart(items, prop = 'active') {
    if (items.length === 0 || items.some(i => i.behavior?.props?.[prop] === true)) return null;
    return items[0].id;
}
