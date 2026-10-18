// Indeks node untuk seluruh dokumen (lintas page). Fungsi murni supaya bisa diuji terhadap algoritma lama.

/** { nodeMap: id → node, kidsMap: id induk → [anak] (urutan dokumen) } dari daftar page. */
export function buildNodeIndex(pages) {
    const nodeMap = new Map(), kidsMap = new Map();
    for (const p of pages)
        for (const n of p.nodes) {
            nodeMap.set(n.id, n);
            if (n.parentId)
                (kidsMap.get(n.parentId) || kidsMap.set(n.parentId, []).get(n.parentId)).push(n);
        }
    return { nodeMap, kidsMap };
}

/** Root + semua keturunannya (DFS dengan tumpukan, urutan sama seperti implementasi lama `subtreeOf`). */
export function subtreeFrom({ nodeMap, kidsMap }, rootId) {
    const out = [], root = nodeMap.get(rootId);
    if (!root)
        return out;
    const stack = [root];
    while (stack.length) {
        const n = stack.pop();
        out.push(n);
        const kids = kidsMap.get(n.id);
        if (kids)
            stack.push(...kids);
    }
    return out;
}
