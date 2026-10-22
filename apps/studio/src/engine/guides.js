// Ruler guides: logika murni untuk guide page-level dan guide yang terikat frame.
// Guide terikat menyimpan frameId + offset dari sudut kiri-atas frame, jadi ia hanya
// hidup di dalam frame itu dan ikut bergerak saat frame dipindah.

/** Titik (x, y) di dalam box; pad memperluas box ke segala arah (toleransi tangkap). */
export function pointInBox(box, x, y, pad = 0) {
    return !!box && x >= box.x - pad && x <= box.x + box.w + pad && y >= box.y - pad && y <= box.y + box.h + pad;
}

/** Frame teratas pada titik dunia w. frames dalam urutan gambar (terakhir = paling atas); section tidak pernah jadi host. */
export function hostFrameAt(frames, w) {
    for (let i = frames.length - 1; i >= 0; i--) {
        const f = frames[i];
        if (f.type !== 'frame' || f.isSection)
            continue;
        if (pointInBox(f.box, w.x, w.y))
            return f;
    }
    return null;
}

/** Nilai dunia guide: hostBox null berarti page-level (value apa adanya). */
export function guideWorldValue(guide, hostBox) {
    if (!hostBox)
        return guide.value;
    const origin = guide.axis === 'x' ? hostBox.x : hostBox.y;
    const off = Number.isFinite(guide.offset) ? guide.offset : guide.value - origin;
    return origin + off;
}

/**
 * Ikat guide ke host (hasil hostFrameAt pada titik jatuhnya) atau lepas kembali ke
 * page-level bila host null. Guide yang nilai tersnap-nya jatuh di luar bentang frame
 * tidak jadi terikat: garisnya akan terpotong habis dan tidak terlihat.
 */
export function applyGuideHost(guide, host, worldValue) {
    guide.value = worldValue;
    let bound = host || null;
    if (bound) {
        const origin = guide.axis === 'x' ? bound.box.x : bound.box.y;
        const span = guide.axis === 'x' ? bound.box.w : bound.box.h;
        if (worldValue < origin || worldValue > origin + span)
            bound = null;
        else
            guide.offset = Math.round((worldValue - origin) * 100) / 100;
    }
    if (bound)
        guide.frameId = bound.id;
    else {
        delete guide.frameId;
        delete guide.offset;
    }
    return guide;
}

/** Guide milik frame yang ikut terhapus dibuang; guide page-level dan frame lain tetap. */
export function pruneGuides(guides, removedIds) {
    return guides.filter(g => !g.frameId || !removedIds.has(g.frameId));
}

/** Salinan guide untuk frame hasil duplikasi: frameId dipetakan ke id salinan, offset sama. */
export function clonedGuides(guides, idMap, makeId) {
    const out = [];
    for (const g of guides) {
        if (!g.frameId || !idMap.has(g.frameId))
            continue;
        out.push({ ...g, id: makeId(), frameId: idMap.get(g.frameId) });
    }
    return out;
}
