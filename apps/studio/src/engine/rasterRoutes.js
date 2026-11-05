// Which scene layers are painted into the raster atlas instead of by the GPU shader, and how big their raster must be. Pure: the
// renderer decides per node, so a page with a mask, an effect or a backdrop blur keeps every other layer on the GPU.
//
// A scene item is { id, parentId, reasons, maskParents }: `reasons` lists what its own paint needs the 2D painter for ('effect',
// 'backdrop'), and `maskParents` lists the parents of the masks that clip it (a mask and the layers it clips share a parent).

/**
 * The raster roots: each root is the outermost layer whose subtree is painted into one atlas entry. A layer clipped by a mask is
 * rastered with the group the mask belongs to (so the mask applies to its whole content); an effect or backdrop blur on a layer is
 * rastered with that layer. A root inside another root is part of that root's entry.
 * @param {{ id: string, parentId: string | null, reasons: string[], maskParents: string[] }[]} items the scene's layers in paint order
 * @returns {Map<string, Set<string>>} root id → reasons ('mask', 'effect', 'backdrop')
 */
export function planRasterRoots(items) {
    const byId = new Map(items.map(it => [it.id, it]));
    const candidates = new Map();
    const add = (id, reasons) => { const set = candidates.get(id) ?? new Set(); for (const r of reasons) set.add(r); candidates.set(id, set); };
    for (const it of items) {
        if (!it.reasons.length && !it.maskParents.length)
            continue;
        let root = it;
        const reasons = [...it.reasons];
        // A mask parent that is itself clipped by a mask climbs again: the outermost group that no mask clips is the root.
        for (let guard = 0; root.maskParents.length && guard < items.length; guard++) {
            reasons.push('mask');
            const parent = byId.get(root.maskParents[0]);
            if (!parent)
                break; // a mask with no parent group: the layer itself is the root, and the atlas entry applies the mask
            root = parent;
        }
        add(root.id, reasons);
    }
    const roots = new Map();
    for (const [id, reasons] of candidates) {
        if (![...candidates.keys()].some(other => other !== id && isAncestor(byId, other, id)))
            roots.set(id, reasons);
    }
    return roots;
}

function isAncestor(byId, ancestor, id) {
    for (let p = byId.get(id)?.parentId ?? null, guard = 0; p != null && guard < byId.size; guard++) {
        if (p === ancestor)
            return true;
        p = byId.get(p)?.parentId ?? null;
    }
    return false;
}

/**
 * The ids of a layer and everything below it.
 * @param {{ id: string, parentId: string | null }[]} items
 * @param {string} rootId
 * @returns {Set<string>}
 */
export function descendantsOf(items, rootId) {
    const children = new Map();
    for (const it of items) {
        if (it.parentId != null)
            children.set(it.parentId, [...(children.get(it.parentId) ?? []), it.id]);
    }
    const out = new Set([rootId]), stack = [rootId];
    while (stack.length) {
        for (const c of children.get(stack.pop()) ?? []) {
            if (!out.has(c)) {
                out.add(c);
                stack.push(c);
            }
        }
    }
    return out;
}

/**
 * How far an effect paints beyond the layer's box, in the layer's units: a shadow reaches its offset, its spread and about three
 * standard deviations of its blur; a layer blur reaches about three standard deviations of its radius. Inner shadows and backdrop
 * effects paint inside the box.
 * @param {{ type: string, visible?: boolean, x?: number, y?: number, blur?: number, spread?: number, radius?: number }[]} effects
 * @returns {number}
 */
export function effectBleed(effects) {
    let bleed = 0;
    for (const e of effects) {
        if (e.visible === false)
            continue;
        if (e.type === 'drop')
            bleed = Math.max(bleed, Math.abs(e.x || 0) + Math.abs(e.y || 0) + 1.5 * (e.blur || 0) + Math.abs(e.spread || 0));
        else if (e.type === 'layerBlur')
            bleed = Math.max(bleed, 1.5 * (e.radius || 0));
    }
    return bleed;
}

/**
 * The bounding box, in another space, of a box given by its corners: `inv` maps the box's space into the target space.
 * @param {{ x: number, y: number, w: number, h: number }} box
 * @param {number[]} inv an affine matrix [a, b, c, d, e, f]
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
export function boundsIn(box, inv) {
    const [a, b, c, d, e, f] = inv;
    const pts = [[box.x, box.y], [box.x + box.w, box.y], [box.x, box.y + box.h], [box.x + box.w, box.y + box.h]].map(([x, y]) => [a * x + c * y + e, b * x + d * y + f]);
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
