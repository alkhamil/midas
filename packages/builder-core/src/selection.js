// Selection target resolution, Figma's hierarchical model. Pure: the layers under the cursor (root first), the current selection
// and the modifiers in; the id of the layer a click, double-click or hover picks out, or null. Hover uses the same function, so
// the highlighted layer is always the one a click would select.

/**
 * What the rules need to know about one layer.
 * @typedef {{
 *   id: string, parentId: string | null, type: string, isSection: boolean, isInstance: boolean,
 *   isAutoLayout: boolean, componentSet: boolean, parentIsSection: boolean, childCount: number, isStandaloneComponent: boolean
 * }} LayerRecord
 */

/** A standalone component (not a variant of a component set) is picked whole, like an instance: its layers are entered with Ctrl or a double-click. */
const isStandaloneComponentOf = (/** @type {LayerRecord} */ l) => !!l.isStandaloneComponent;

/** A frame, group, component instance or standalone component: a click picks it whole, never the layers inside it. */
const isContainer = (/** @type {LayerRecord} */ l) => l.type === 'frame' || l.type === 'group' || l.isInstance || isStandaloneComponentOf(l);

/** A top-level frame (on the page, or in a section): not a section and not a component instance. */
const isTopLevelPlainFrame = (/** @type {LayerRecord} */ l) => l.type === 'frame' && !l.isSection && !l.isInstance && !isStandaloneComponentOf(l) && (l.parentId === null || l.parentIsSection);

/** A top-level frame with children that is picked through its label: its area is not a target. */
const isLabelOnly = (/** @type {LayerRecord} */ l) => isTopLevelPlainFrame(l) && !l.isAutoLayout;

/** A top-level auto layout frame: its area is a target, but a child under the cursor is picked first. */
const isTopLevelAutoLayout = (/** @type {LayerRecord} */ l) => isTopLevelPlainFrame(l) && !!l.isAutoLayout;

/** A top-level frame or section that holds layers is picked through the layers inside it, never as a whole (see plainTarget). */
const isPickedThroughChildren = (/** @type {LayerRecord} */ l) => l.childCount > 0 && (isLabelOnly(l) || isTopLevelAutoLayout(l) || l.isSection);

/**
 * The layer a plain click picks: the layer of the path at the selection's scope level (the parent of the selection, or the
 * top level when nothing is selected), then down through any layer that is picked through its children. When the cursor is on
 * no child of an auto layout frame, the frame itself is picked.
 * @param {LayerRecord[]} path
 * @param {string | null} scope
 * @returns {string | null}
 */
function plainTarget(path, scope) {
    let i = path.findIndex(l => l.parentId === scope);
    if (i < 0)
        i = 0;
    for (; i < path.length; i++) {
        const layer = path[i];
        if (!isPickedThroughChildren(layer))
            return layer.id;
        if (isTopLevelAutoLayout(layer) && i === path.length - 1)
            return layer.id;
    }
    return null;
}

/**
 * Resolves the layer a pointer action picks. The caller passes only layers that can be picked: locked layers are left out of the path.
 * - Plain: the scope level of the path, descending through top-level frames and sections that hold layers. A hit outside the scope resets to the top level.
 * - `deep` (Ctrl / Cmd): the deepest layer under the cursor.
 * - `drill` (double-click, third click): the child of the selected container under the cursor. A leaf selection picks nothing; nothing selected works as a plain click.
 * @param {{ path: LayerRecord[], selection: LayerRecord[], deep?: boolean, drill?: boolean }} input
 *   `path` is the hit path under the cursor, root first, down to the deepest layer; `selection` is the current selection.
 * @returns {string | null}
 */
export function resolveSelectTarget({ path, selection, deep = false, drill = false }) {
    if (!path.length)
        return null;
    if (deep)
        return path[path.length - 1].id;
    if (drill && selection.length === 1) {
        const [container] = selection;
        if (!isContainer(container))
            return null;
        return path.find(l => l.parentId === container.id)?.id ?? null;
    }
    if (drill && selection.length > 1)
        return null;
    return plainTarget(path, selection.length ? selection[0].parentId : null);
}
