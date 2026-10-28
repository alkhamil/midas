// Tipe snapshot library: komponen desain yang di-publish supaya file lain di workspace bisa memakainya.

export interface SnapshotNode {
    id: string;
    parentId?: string | null;
    name?: string;
    component?: boolean;
    componentSet?: boolean;
    [k: string]: unknown;
}
/** What the design's Documentation frame says about a component (the Studio reads it when publishing). */
export interface ComponentDoc {
    category?: string;
    status?: string;
    description?: string;
    dos?: string[];
    donts?: string[];
    a11y?: string[];
}
export interface SnapshotComponent {
    id: string;
    name: string;
    set?: boolean;
    doc?: ComponentDoc;
    nodes: SnapshotNode[];
}
export interface LibrarySnapshot {
    components: SnapshotComponent[];
    variables?: { collections?: unknown[]; items?: unknown[] };
    /** Aset yang dipakai komponen (assetId → data URL). */
    assets?: Record<string, string>;
}

/** Variable name as a CSS custom property name (`color/primary` → `color-primary`); the studio's live preview uses the same rule. */
export const cssVarName = (name: unknown): string => String(name ?? 'var').trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();

type SnapVariable = { id: string; name: string; type: string; collectionId: string; values: Record<string, unknown> };

/** `variables.json` of a published library: variable name → value of the default mode (aliases followed, numbers in px). */
export function variablesJson(snapshot: LibrarySnapshot): Record<string, string> {
    const items = (snapshot.variables?.items ?? []) as SnapVariable[];
    const modes = new Map(((snapshot.variables?.collections ?? []) as { id: string; modes: { id: string }[] }[]).map(c => [c.id, c.modes?.[0]?.id]));
    const byId = new Map(items.map(i => [i.id, i]));
    const out: Record<string, string> = {};
    const valueOf = (item: SnapVariable, depth = 0): unknown => {
        const mode = modes.get(item.collectionId);
        let v = mode !== undefined ? item.values?.[mode] : undefined;
        v ??= Object.values(item.values ?? {})[0];
        const alias = (v as { alias?: string } | undefined)?.alias;
        if (alias && depth < 20 && byId.has(alias)) return valueOf(byId.get(alias)!, depth + 1);
        return v;
    };
    for (const item of items) {
        if (!['color', 'number', 'string'].includes(item.type)) continue;
        const v = valueOf(item);
        if (v == null || typeof v === 'object') continue;
        out[cssVarName(item.name)] = item.type === 'number' ? `${v}px` : String(v);
    }
    return out;
}
