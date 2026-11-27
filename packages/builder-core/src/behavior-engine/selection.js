// Selection among the items of a box (a Tabs' tabs). A template's exclusive toggle prop (`toggle.exclusive`) selects one item: turning it on turns
// the prop off on the rivals in the same group (the same master), within one box. Pure: the caller maps its own nodes or elements to items.

/** Whether a box slot holds the parent's children: only its items select among each other; a loose instance stands alone. */
export function isBoxSlot(parent) {
    return parent?.propBind?.slot !== undefined;
}

/** Whether a prop write is the template's exclusive toggle turned on. */
export function turnsExclusiveOn(template, prop, value) {
    return value === true && template?.toggle?.exclusive === true && template.toggle.prop === prop;
}

/**
 * The rivals of `self` in a box: the items of its group that are on. Each item is `{ node, group, on }`; `self` is `{ node, group }`, and the
 * rivals are compared by `node`, so `self` may be a fresh object.
 * @template T
 * @param {{ node: unknown, group: unknown }} self
 * @param {{ node: T, group: unknown, on: boolean }[]} items the items of the same box
 * @returns {{ node: T, group: unknown, on: boolean }[]}
 */
export function exclusiveRivals(self, items) {
    return items.filter(i => i.node !== self.node && i.group === self.group && i.on);
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
