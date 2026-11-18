// A published library as a file sees it (pure). The file stores only references: an instance points at a layer of a library by an id
// that depends on the library and the layer, never on the file. The library's components are rebuilt in memory from its snapshot
// (snapshotPageOf); that page is never written into the file (persistedPages). A file that still holds a copied library page from the
// earlier format is refused (legacyLibraryProblem), since nothing rebuilds it.

const LIBRARY_PAGE = 'Library · ';

/**
 * The id a library layer has in the file's memory: the same for every file that uses the library, so an instance saved in a file finds
 * it again when the library loads.
 * @param {string} snapId the library id
 * @param {string} nodeId the layer id in the snapshot
 */
export function libraryCopyId(snapId, nodeId) {
    return `${snapId}~${nodeId}`;
}

/**
 * The page holding a library's components, built from its snapshot: every layer keeps its snapshot values, with ids, parents and
 * references mapped to libraryCopyId and a libRef of `<library>:<layer>`. A root keeps its position in the library.
 * @param {{ id: string, name: string, version: number, components: { nodes: any[] }[] }} snap
 */
export function snapshotPageOf(snap) {
    const map = id => (id == null ? id : libraryCopyId(snap.id, id));
    const nodes = snap.components.flatMap(c => c.nodes.map(src => {
        const n = structuredClone(src);
        n.id = map(src.id);
        n.parentId = map(src.parentId);
        for (const k of ['sourceId', 'swapOf'])
            if (n[k] != null)
                n[k] = map(n[k]);
        n.libRef = `${snap.id}:${src.id}`;
        return n;
    }));
    return { id: `library:${snap.id}`, name: `${LIBRARY_PAGE}${snap.name}`, nodes, library: { id: snap.id, version: snap.version, assets: Object.keys(snap.assets ?? {}) } };
}

/** Whether a page is a library's page built from a snapshot (never saved). */
export function isLibraryPage(page) {
    return page?.library != null;
}

/** The pages a file saves: every page except the library pages. */
export function persistedPages(pages) {
    return pages.filter(p => !isLibraryPage(p));
}

/**
 * The variables a library brings to a file, tagged with the library (libId) so they are read-only there and never saved with the file.
 * @param {{ id: string, variables?: { collections?: any[], items?: any[] } }} snap
 */
export function libraryVariablesOf(snap) {
    const v = snap.variables ?? {};
    return { collections: (v.collections ?? []).map(c => ({ ...structuredClone(c), libId: snap.id })), items: (v.items ?? []).map(i => ({ ...structuredClone(i), libId: snap.id })) };
}

/**
 * The document a file saves: the file's own pages, assets and variables. Library pages, the assets a library page names and the
 * variables tagged with a library are left out; the document in memory is not changed.
 * @param {{ pages: any[], assets?: Record<string, string>, variables?: { collections?: any[], items?: any[] } }} data
 */
export function persistedDocumentOf(data) {
    const libraryAssets = new Set(data.pages.filter(isLibraryPage).flatMap(p => p.library.assets ?? []));
    const out = { ...data, pages: persistedPages(data.pages), assets: Object.fromEntries(Object.entries(data.assets ?? {}).filter(([id]) => !libraryAssets.has(id))) };
    if (data.variables)
        out.variables = { ...data.variables, collections: (data.variables.collections ?? []).filter(c => !c.libId), items: (data.variables.items ?? []).filter(i => !i.libId) };
    return out;
}

/**
 * The reason a file cannot open because it holds a copied library page from the earlier format, or null when it can open.
 * @param {{ name?: string, library?: unknown }[]} pages
 */
export function legacyLibraryProblem(pages) {
    const old = pages.find(p => typeof p.name === 'string' && p.name.startsWith(LIBRARY_PAGE) && !isLibraryPage(p));
    if (!old) return null;
    return `The file holds a copied library "${old.name}" from an earlier format. Delete that page and place the components again from the published library (rebuild the file's library copy).`;
}
