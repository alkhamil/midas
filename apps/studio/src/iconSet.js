// Ikon design system di Midas (spec §3.1): setiap ikon = component set "Icon/<kategori>/<nama>"
// dengan variant "Style" (mis. outline, bold, …); isi setiap variant = node gambar berisi SVG.
// Modul ini murni (tanpa DOM/engine) supaya bisa dipakai Studio dan script seed di Node.

export const ICON_PREFIX = 'Icon/';
export const ICON_STYLE_PROP = 'Style';
const KNOWN_STYLES = ['bold-duotone', 'line-duotone', 'bold', 'broken', 'outline', 'linear', 'solid', 'filled', 'regular', 'light', 'duotone'];
// Kolom & baris grid page Icons: cukup lebar untuk label nama set di atasnya.
const ICON_SIZE = 24, COL_W = 260, ROW_H = 80, COLS = 10;

export const isIconName = name => typeof name === 'string' && name.startsWith(ICON_PREFIX);

const slug = s => String(s).trim().toLowerCase().replace(/\.svg$/i, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/**
 * Baca nama, kategori, dan gaya dari path file, mis. "wds/outline/arrows/arrow-left.svg"
 * → { name: "arrow-left", category: "arrows", style: "outline" }. Gaya = segmen yang dikenal,
 * selain itu `fallbackStyle`.
 */
export function iconInfoFromPath(path, fallbackStyle = 'default') {
    const parts = String(path).split(/[\\/]/).filter(Boolean);
    const name = slug(parts.pop() || '');
    const styleIdx = parts.findIndex(p => KNOWN_STYLES.includes(slug(p)));
    const style = styleIdx >= 0 ? slug(parts[styleIdx]) : fallbackStyle;
    const rest = parts.slice(styleIdx >= 0 ? styleIdx + 1 : Math.max(0, parts.length - 1));
    const category = slug(rest.at(-1) || 'general') || 'general';
    return { name, category, style };
}

/** Ukuran viewBox SVG (default 24×24). */
export function svgViewBox(svg) {
    const vb = /viewBox\s*=\s*"([^"]+)"/i.exec(svg)?.[1]?.trim().split(/[\s,]+/).map(Number);
    if (vb?.length === 4 && vb.every(Number.isFinite)) return { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
    const w = Number(/\swidth\s*=\s*"([\d.]+)/i.exec(svg)?.[1]) || ICON_SIZE, h = Number(/\sheight\s*=\s*"([\d.]+)/i.exec(svg)?.[1]) || ICON_SIZE;
    return { x: 0, y: 0, w, h };
}

export const svgToDataUrl = svg => `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
export function dataUrlToSvg(url) {
    const m = /^data:image\/svg\+xml(;base64)?,(.*)$/s.exec(url || '');
    if (!m) return null;
    return m[1] ? decodeURIComponent(escape(atob(m[2]))) : decodeURIComponent(m[2]);
}

/**
 * Susun page "Icons" dari file SVG. `files`: [{ path, svg }]. `existing`: page Icons yang sudah ada
 * (set dengan nama sama diganti, sisanya dipertahankan). Mengembalikan page dan aset baru
 * (assetId → data URL) untuk `doc.data.assets`.
 */
export function buildIconPage(files, { uid, existing = null, fallbackStyle = 'default' }) {
    const groups = new Map();
    for (const f of files) {
        if (!/<svg[\s>]/i.test(f.svg || '')) continue;
        const info = iconInfoFromPath(f.path, fallbackStyle);
        if (!info.name) continue;
        const key = `${info.category}/${info.name}`;
        const g = groups.get(key) || groups.set(key, { ...info, styles: new Map() }).get(key);
        g.styles.set(info.style, f.svg);
    }
    const replaced = new Set([...groups.keys()].map(k => ICON_PREFIX + k));
    const page = existing ? { ...existing, nodes: [] } : { id: uid(), name: 'Icons', nodes: [] };
    const keepRoots = new Set((existing?.nodes || []).filter(n => !n.parentId && !replaced.has(n.name)).map(n => n.id));
    const keep = new Set(keepRoots);
    let grew = true;
    while (grew) {
        grew = false;
        for (const n of existing?.nodes || []) if (n.parentId && keep.has(n.parentId) && !keep.has(n.id)) { keep.add(n.id); grew = true; }
    }
    page.nodes = (existing?.nodes || []).filter(n => keep.has(n.id));
    let slot = page.nodes.filter(n => !n.parentId).length;
    const assets = {};
    const base = { rotation: 0, opacity: 1, visible: true, locked: false, shadow: false, stroke: '#000000', strokeWidth: 0, radius: 0, version: 0 };
    for (const g of [...groups.values()].sort((a, b) => (a.category + a.name).localeCompare(b.category + b.name))) {
        const styles = [...g.styles.keys()].sort();
        const setW = styles.length * ICON_SIZE + (styles.length + 1) * 8, setH = ICON_SIZE + 16;
        const col = slot % COLS, row = Math.floor(slot++ / COLS);
        const set = {
            ...base, id: uid(), type: 'frame', name: `${ICON_PREFIX}${g.category}/${g.name}`, parentId: null,
            x: col * COL_W, y: row * ROW_H, w: setW, h: setH, fill: 'none', clip: false, componentSet: true,
            stroke: '#9747ff', strokeWidth: 1, strokeStyle: 'dash', strokeDash: 6, strokeGap: 4, strokeAlign: 'center', radius: 6,
        };
        page.nodes.push(set);
        styles.forEach((style, i) => {
            const svg = g.styles.get(style), vb = svgViewBox(svg), assetId = uid();
            assets[assetId] = svgToDataUrl(svg);
            const variant = {
                ...base, id: uid(), type: 'frame', name: `${ICON_STYLE_PROP}=${style}`, parentId: set.id,
                x: 8 + i * (ICON_SIZE + 8), y: 8, w: ICON_SIZE, h: ICON_SIZE, fill: 'none', clip: false, component: true, variant: { [ICON_STYLE_PROP]: style },
            };
            const image = {
                ...base, id: uid(), type: 'image', name: g.name, parentId: variant.id, x: 0, y: 0, w: ICON_SIZE, h: Math.round(ICON_SIZE * vb.h / vb.w) || ICON_SIZE,
                fill: 'none', clip: false, assetId, lockRatio: true,
            };
            page.nodes.push(variant, image);
        });
    }
    return { page, assets, count: groups.size, styles: [...new Set([...groups.values()].flatMap(g => [...g.styles.keys()]))].sort() };
}

/** Aset (id) yang dipakai sekumpulan node — untuk ikut dikirim di snapshot library. */
export function assetIdsOf(nodes) {
    const ids = new Set();
    for (const n of nodes) {
        if (n.assetId) ids.add(n.assetId);
        for (const f of Array.isArray(n.fills) ? n.fills : []) if (f?.type === 'image' && f.image) ids.add(f.image);
    }
    return ids;
}
