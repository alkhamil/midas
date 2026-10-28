// Child order of an instance when its component's order is re-applied. A managed layer keeps the index anatomy sync
// gave it: it is never ranked, and the other children fill the places around it in rank order.

/**
 * Sorts children by rank into the places that are not managed. Managed children stay where they are.
 * @template T
 * @param {T[]} kids the children, in their current order
 * @param {(kid: T) => number} rank the position each child should take among the non-managed children
 * @param {(kid: T) => boolean} isManaged true for a managed layer
 * @returns {T[]} a new array in the new order
 */
export function orderChildren(kids, rank, isManaged) {
    const out = [...kids];
    const free = kids.map((_, i) => i).filter(i => !isManaged(kids[i]));
    const sorted = free.map(i => kids[i]).sort((a, b) => rank(a) - rank(b));
    free.forEach((index, j) => { out[index] = sorted[j]; });
    return out;
}
