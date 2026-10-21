// Tipe snapshot library: komponen desain yang di-publish supaya file lain di workspace bisa memakainya.

export interface SnapshotNode {
    id: string;
    parentId?: string | null;
    name?: string;
    component?: boolean;
    componentSet?: boolean;
    [k: string]: unknown;
}
export interface SnapshotComponent {
    id: string;
    name: string;
    set?: boolean;
    nodes: SnapshotNode[];
}
export interface LibrarySnapshot {
    components: SnapshotComponent[];
    variables?: { collections?: unknown[]; items?: unknown[] };
    /** Aset yang dipakai komponen (assetId → data URL). */
    assets?: Record<string, string>;
}
