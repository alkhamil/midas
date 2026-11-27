// The kind of layer a sync op acts on (pure). The studio's sync applies each kind; this only says which. The order is the one the studio always had:
// a non-icon anatomy slot is a managed text layer first, then a content slot, else an icon slot.

/**
 * @param {{ anatomy?: { id: string, kind: string }[], slots?: { id: string }[] } | null} template the instance's template, or null
 * @param {{ op: string, slot?: string }} op one anatomy op (remove, move, swap, or an insert of a slot)
 * @returns {'remove' | 'move' | 'swap' | 'text' | 'content' | 'icon'}
 */
export function syncOpKindOf(template, op) {
    if (op.op === 'remove' || op.op === 'move' || op.op === 'swap') return op.op;
    const def = template?.anatomy?.find(s => s.id === op.slot);
    if (def && def.kind !== 'icon') return 'text';
    if (template?.slots?.some(s => s.id === op.slot)) return 'content';
    return 'icon';
}
