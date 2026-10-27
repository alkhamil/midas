// Smaller pages on disk and on the wire: layer fields that hold the editor's default are left out. The Studio fills them in
// again when it opens a file (its `node()` defaults), so nothing changes for the editor.
//
// Only fields nobody reads with a different fallback are dropped: the code generator (builder-core) and the MCP tools read a
// missing field as "not set", which for these means the same as the default. Type-dependent defaults (clip on frames, font
// size/weight/line height on text) and the paint/shadow values that matter while a stroke or shadow is on are kept.

/** Fields whose default is the same for every layer type. */
const PLAIN: Record<string, unknown> = {
    rotation: 0, fill2: '#cfe1fa', fillType: 'solid', gradientAngle: 90, fillOpacity: 1, strokeWidth: 0,
    radius: 0, opacity: 1, locked: false, shadow: false,
};
/** Only default while there is no stroke (the stroke colour is read next to the width). */
const STROKE_OFF: Record<string, unknown> = { stroke: '#000000' };
/** Only default while the shadow is off (the generator falls back to other values when it is on). */
const SHADOW_OFF: Record<string, unknown> = { shadowColor: '#000000', shadowOpacity: 0.16, shadowBlur: 20, shadowX: 0, shadowY: 6 };

type Layer = Record<string, unknown>;

export function compactNode(n: Layer): Layer {
    const out: Layer = {};
    const noStroke = !n.strokeWidth, noShadow = !n.shadow;
    for (const [k, v] of Object.entries(n)) {
        if (k in PLAIN && PLAIN[k] === v) continue;
        if (noStroke && k in STROKE_OFF && STROKE_OFF[k] === v) continue;
        if (noShadow && k in SHADOW_OFF && SHADOW_OFF[k] === v) continue;
        out[k] = v;
    }
    return out;
}

/** The page with every layer compacted; pages without a `nodes` array are returned as they are. */
export function compactPage<T extends object>(page: T): T {
    const nodes = (page as { nodes?: unknown }).nodes;
    if (!Array.isArray(nodes)) return page;
    return { ...page, nodes: nodes.map(n => (n && typeof n === 'object' ? compactNode(n as Layer) : n)) };
}
