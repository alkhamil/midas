// The value of a document variable in the modes a layer is read in (pure). The editor's Design panel, the canvas (through the stroke
// and fill colours it writes) and the Behavior engine all read a bound variable through this one function, so a swatch, the canvas
// and Play can never resolve the same variable in different modes.
import { splitColor, withOpacity } from './tokens.js';

/**
 * Follows a variable to its value. Every variable, including the targets of aliases, is read in the mode its own collection takes
 * (`modeOf`): an alias into another collection is read in that collection's mode, never the source's. A collection with no value
 * in that mode falls back to its first mode, then to the first mode that has one (Figma leaves modes unset). A colour alias can
 * carry its own opacity, multiplied onto the colour it reaches. Undefined when the value cannot be reached (missing target, a
 * target of another type, a cycle).
 * @param {{ collections: any[], items: any[] } | undefined} variables
 * @param {any} item
 * @param {(collection: any) => string | undefined} modeOf the mode a collection is read in
 * @param {number} [depth]
 * @returns {unknown}
 */
export function variableValue(variables, item, modeOf, depth = 0) {
    const collection = variables?.collections.find(c => c.id === item.collectionId);
    if (!variables || !collection || !collection.modes.length) return undefined;
    let value = item.values[/** @type {string} */ (modeOf(collection))];
    if (value === undefined) value = item.values[collection.modes[0].id];
    if (value === undefined) value = collection.modes.map((/** @type {{ id: string }} */ m) => item.values[m.id]).find((/** @type {unknown} */ x) => x !== undefined);
    if (!value || typeof value !== 'object' || !('alias' in value)) return value;
    const target = variables.items.find(i => i.id === value.alias);
    if (!target || target.type !== item.type || depth > 20) return undefined;
    const reached = variableValue(variables, target, modeOf, depth + 1);
    if (item.type === 'color' && typeof reached === 'string' && value.opacity != null && value.opacity < 100 && splitColor(reached)) {
        return withOpacity(reached, value.opacity);
    }
    return reached;
}
