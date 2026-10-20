// Penyimpanan Midas di server (Midas API, apps/server).
// Bentuk `kv` dan `projectStorage` sama dengan penyimpanan IndexedDB lama (legacyStorage.js),
// sehingga engine editor tidak perlu tahu datanya sekarang ada di Postgres + object storage:
//   - `projectStorage`  → /api/files (meta), /api/files/:id/pages (isi per page), /api/files/:id/assets
//   - kv('index')       → daftar file di workspace (/api/files); perubahan nama/thumb/trash dikirim per file
//   - kv lain           → /api/kv (state editor per user, mis. file terakhir dibuka)
// Setiap simpan membawa versi terakhir yang diketahui; bila server punya versi lebih baru
// → ConflictError (409).

export { settings } from './legacyStorage.js';

export class ApiError extends Error {
    constructor(status, body) {
        super(body?.message || `Request failed (${status})`);
        this.name = 'ApiError';
        this.status = status;
        this.body = body;
    }
}

export class ConflictError extends Error {
    constructor(message = 'This file was changed elsewhere.') {
        super(message);
        this.name = 'ConflictError';
    }
}

/** Fetch ke Midas API (same-origin, cookie sesi). Error jaringan dilempar apa adanya (TypeError). */
async function api(method, url, body, { raw = false } = {}) {
    const init = { method, credentials: 'same-origin', headers: {} };
    if (body instanceof Blob) {
        init.body = body;
        init.headers['content-type'] = body.type || 'application/octet-stream';
    }
    else if (body !== undefined) {
        init.body = JSON.stringify(body);
        init.headers['content-type'] = 'application/json';
    }
    const res = await fetch(url, init);
    if (raw && res.ok) return res;
    const text = await res.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = { message: text };
    }
    if (res.status === 401) window.dispatchEvent(new CustomEvent('midas:unauthorized'));
    if (!res.ok) throw new ApiError(res.status, data);
    return data;
}

const enc = encodeURIComponent;
const fileUrl = id => `/api/files/${enc(id)}`;
const assetUrl = (fileId, assetId) => `${fileUrl(fileId)}/assets/${enc(assetId)}`;
const isServerAsset = (fileId, url) => typeof url === 'string' && url.startsWith(`${fileUrl(fileId)}/assets/`);

// Versi terakhir yang diketahui Studio, untuk optimistic concurrency.
const fileVersions = new Map();              // fileId → versi meta
const pageVersions = new Map();              // fileId → Map(pageId → versi)
const uploadedAssets = new Map();            // fileId → Set(assetId)
const pagesOf = id => pageVersions.get(id) ?? pageVersions.set(id, new Map()).get(id);
const assetsOf = id => uploadedAssets.get(id) ?? uploadedAssets.set(id, new Set()).get(id);

// Snapshot daftar file dari server, untuk menerjemahkan kv.put('index') menjadi PATCH per file.
let indexSnapshot = new Map();               // fileId → { name, opened, thumb, trashed }
const indexFields = m => ({ name: m.name, opened: m.opened || 0, thumb: m.thumb ?? null, trashed: m.trashed ?? null, folder: m.folder ?? null, starred: !!m.starred, hiddenRecent: !!m.hiddenRecent });

async function loadIndex() {
    const { files } = await api('GET', '/api/files');
    indexSnapshot = new Map(files.map(f => [f.id, indexFields(f)]));
    for (const f of files) if (!fileVersions.has(f.id)) fileVersions.set(f.id, f.version);
    return files.map(({ version: _v, ...m }) => m);
}

async function saveIndex(json) {
    let list;
    try {
        list = JSON.parse(json);
    } catch {
        return;
    }
    const jobs = [];
    for (const m of Array.isArray(list) ? list : []) {
        const prev = indexSnapshot.get(m.id);
        if (!prev) continue; // belum ada di server: dibuat saat simpan pertama
        const next = indexFields(m), patch = {};
        for (const k of Object.keys(next)) if (next[k] !== prev[k]) patch[k] = next[k];
        if (!Object.keys(patch).length) continue;
        indexSnapshot.set(m.id, next);
        jobs.push(api('PATCH', fileUrl(m.id), patch).catch(e => {
            if (e.status !== 404) throw e;
        }));
    }
    await Promise.all(jobs);
}

export const kv = {
    async get(key) {
        if (key === 'index') return JSON.stringify(await loadIndex());
        const meta = /^file:([^:]+):meta$/.exec(key);
        if (meta) {
            if (indexSnapshot.has(meta[1])) return JSON.stringify({ id: meta[1], name: indexSnapshot.get(meta[1]).name });
            try {
                return JSON.stringify((await api('GET', fileUrl(meta[1]))).file.meta);
            } catch (e) {
                if (e.status === 404) return null;
                throw e;
            }
        }
        if (key.startsWith('file:')) return null; // format lama satu-blob tidak ada di server
        try {
            return (await api('GET', `/api/kv/${enc(key)}`)).value;
        } catch (e) {
            if (e.status === 404) return null;
            throw e;
        }
    },

    async keys(prefix = '') {
        if (prefix.startsWith('file:') || 'file:'.startsWith(prefix)) {
            const files = await loadIndex();
            const fileKeys = files.map(f => `file:${f.id}:meta`).filter(k => k.startsWith(prefix));
            if (prefix.startsWith('file:')) return fileKeys;
            const { keys } = await api('GET', `/api/kv?prefix=${enc(prefix)}`);
            return [...fileKeys, ...keys];
        }
        return (await api('GET', `/api/kv?prefix=${enc(prefix)}`)).keys;
    },

    async put(key, value) {
        if (key === 'index') return saveIndex(value);
        if (key.startsWith('file:')) return; // isi file hanya lewat projectStorage
        await api('PUT', `/api/kv/${enc(key)}`, { value: String(value) });
    },

    async del(key) {
        const file = /^file:([^:]+)$/.exec(key);
        if (file) return projectStorage.deleteProject(file[1]);
        if (key.startsWith('file:')) return;
        await api('DELETE', `/api/kv/${enc(key)}`);
    }
};

function metaFor(fileId, docData) {
    const pages = docData.pages || [];
    const assetUrls = {};
    for (const [id, url] of Object.entries(docData.assets || {}))
        if (typeof url === 'string' && !url.startsWith('data:') && !isServerAsset(fileId, url)) assetUrls[id] = url;
    return {
        id: fileId,
        format: 'midas',
        version: 1,
        name: docData.name || 'Untitled',
        pageId: docData.pageId || pages[0]?.id,
        pageMeta: pages.map(p => ({ id: p.id, name: p.name, parentId: p.parentId || null })),
        tokens: docData.tokens,
        variables: docData.variables,
        thumbnailId: docData.thumbnailId ?? null,
        guideStyles: docData.guideStyles ?? [],
        created: docData.created,
        ...(Object.keys(assetUrls).length ? { assetUrls } : {})
    };
}

function dataUrlToBlob(url) {
    const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(url);
    if (!m) return null;
    const type = m[1] || 'application/octet-stream';
    if (!m[2]) return new Blob([decodeURIComponent(m[3])], { type });
    const bin = atob(m[3]), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type });
}

async function uploadNewAssets(fileId, docData) {
    const done = assetsOf(fileId);
    const queue = Object.entries(docData.assets || {}).filter(([id, url]) => !done.has(id) && typeof url === 'string' && url.startsWith('data:'));
    // Beberapa upload sekaligus: satu set ikon bisa berisi ribuan file kecil.
    const worker = async () => {
        for (let job = queue.shift(); job; job = queue.shift()) {
            const [id, url] = job, blob = dataUrlToBlob(url);
            if (!blob) continue;
            await api('PUT', assetUrl(fileId, id), blob);
            done.add(id);
        }
    };
    await Promise.all(Array.from({ length: 8 }, worker));
}

async function saveMeta(fileId, docData) {
    const meta = metaFor(fileId, docData);
    try {
        const { version } = await api('PUT', fileUrl(fileId), { name: meta.name, meta, baseVersion: fileVersions.get(fileId) ?? null });
        fileVersions.set(fileId, version);
        if (!indexSnapshot.has(fileId)) indexSnapshot.set(fileId, { name: meta.name, opened: Date.now(), thumb: null, trashed: null, folder: null, starred: false, hiddenRecent: false });
        else indexSnapshot.get(fileId).name = meta.name;
    } catch (e) {
        if (e.status === 409) throw new ConflictError();
        throw e;
    }
    // Page yang sudah tidak ada di dokumen ikut dihapus di server.
    const known = pagesOf(fileId), live = new Set(meta.pageMeta.map(p => p.id));
    for (const pageId of [...known.keys()]) {
        if (live.has(pageId)) continue;
        await api('DELETE', `${fileUrl(fileId)}/pages/${enc(pageId)}`).catch(() => { });
        known.delete(pageId);
    }
}

async function savePage(fileId, page) {
    const known = pagesOf(fileId);
    try {
        const { version } = await api('PUT', `${fileUrl(fileId)}/pages/${enc(page.id)}`, { data: page, baseVersion: known.get(page.id) ?? null });
        known.set(page.id, version);
    } catch (e) {
        if (e.status === 409) throw new ConflictError();
        throw e;
    }
}

/** Ganti URL aset server dengan data URL, supaya file `.midas` hasil export portabel. */
export const assetsAsDataUrls = (fileId, assets) => embedAssets(fileId, assets);
async function embedAssets(fileId, assets = {}) {
    const out = {}, queue = [];
    for (const [id, url] of Object.entries(assets)) {
        if (isServerAsset(fileId, url)) queue.push([id, url]);
        else out[id] = url;
    }
    const worker = async () => {
        for (let job = queue.shift(); job; job = queue.shift()) {
            const [id, url] = job;
            const blob = await (await api('GET', url, undefined, { raw: true })).blob();
            out[id] = await new Promise((resolve, reject) => {
                const r = new FileReader();
                r.onload = () => resolve(r.result);
                r.onerror = () => reject(r.error);
                r.readAsDataURL(blob);
            });
        }
    };
    await Promise.all(Array.from({ length: 8 }, worker));
    return out;
}

// Exported files keep coordinates to 4 decimals (0.0001 px): the long floating-point tails of vector points were most of the file.
const roundForExport = (_k, v) => typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1e4) / 1e4 : v;

export const projectStorage = {
    // Kuota browser tidak relevan lagi: data ada di server.
    async getQuota() {
        return null;
    },

    // Simpan dokumen utuh sebagai file baru (import, duplikat). File yang sudah ada disimpan per page.
    async saveProject(fileId, docData, { onProgress } = {}) {
        const pages = docData.pages || [];
        try {
            const res = await api('POST', '/api/files/import', { id: fileId, data: { ...docData, pages, created: docData.created || Date.now() } });
            fileVersions.set(fileId, res.version);
            const known = pagesOf(fileId);
            for (const [pageId, v] of Object.entries(res.pageVersions || {})) known.set(pageId, v);
            for (const [id, url] of Object.entries(docData.assets || {}))
                if (typeof url === 'string' && url.startsWith('data:')) assetsOf(fileId).add(id);
            indexSnapshot.set(fileId, { name: docData.name || 'Untitled', opened: Date.now(), thumb: null, trashed: null, folder: null, starred: false, hiddenRecent: false });
            pages.forEach((p, i) => onProgress?.({ savedPages: i + 1, totalPages: pages.length, pageName: p.name }));
            return;
        } catch (e) {
            if (e.status !== 409) throw e;
        }
        await uploadNewAssets(fileId, docData);
        await saveMeta(fileId, docData);
        for (let i = 0; i < pages.length; i++) {
            await savePage(fileId, pages[i]);
            onProgress?.({ savedPages: i + 1, totalPages: pages.length, pageName: pages[i].name });
        }
    },

    // Simpan satu page yang berubah + metadata dokumen.
    async saveActivePage(fileId, docData, activePage) {
        await uploadNewAssets(fileId, docData);
        await saveMeta(fileId, docData);
        await savePage(fileId, activePage);
    },

    async loadProject(fileId) {
        let file;
        try {
            file = (await api('GET', fileUrl(fileId))).file;
        } catch (e) {
            if (e.status === 404) return null;
            throw e;
        }
        const [{ pages: rows }, { assets: assetIds }] = await Promise.all([
            api('GET', `${fileUrl(fileId)}/pages`),
            api('GET', `${fileUrl(fileId)}/assets`)
        ]);
        fileVersions.set(fileId, file.version);
        const known = pagesOf(fileId);
        known.clear();
        const byId = new Map();
        for (const r of rows) {
            byId.set(r.pageId, r.data);
            known.set(r.pageId, r.version);
        }
        const meta = file.meta || {};
        const pages = (meta.pageMeta || []).map(pm => byId.get(pm.id) || { id: pm.id, name: pm.name, parentId: pm.parentId, nodes: [] });
        const assets = { ...(meta.assetUrls || {}) };
        const done = assetsOf(fileId);
        for (const id of assetIds) {
            assets[id] = assetUrl(fileId, id);
            done.add(id);
        }
        return {
            format: 'midas',
            version: 1,
            name: file.name,
            pageId: meta.pageId || pages[0]?.id,
            pages,
            tokens: meta.tokens,
            variables: meta.variables,
            thumbnailId: meta.thumbnailId,
            guideStyles: meta.guideStyles ?? [],
            created: meta.created ?? file.created,
            assets
        };
    },

    async exportProject(fileId, inMemoryDocData) {
        if (inMemoryDocData?.pages?.every(p => Array.isArray(p.nodes))) {
            const assets = await embedAssets(fileId, inMemoryDocData.assets);
            return JSON.stringify({ ...inMemoryDocData, assets, format: 'midas', version: 1 }, roundForExport);
        }
        return JSON.stringify(await api('GET', `${fileUrl(fileId)}/export`), roundForExport);
    },

    async deleteProject(fileId) {
        try {
            await api('DELETE', fileUrl(fileId));
        } catch (e) {
            if (e.status !== 404) throw e;
        }
        indexSnapshot.delete(fileId);
        fileVersions.delete(fileId);
        pageVersions.delete(fileId);
        uploadedAssets.delete(fileId);
    },

    /** Lupakan versi yang diketahui, mis. sebelum memuat ulang versi server setelah konflik. */
    forget(fileId) {
        fileVersions.delete(fileId);
        pageVersions.delete(fileId);
    }
};

/**
 * Design system library di workspace (spec §3). Bentuk data mengikuti engine:
 * `version` = nomor urut publish (dipakai untuk deteksi update), `semver` = versi paket kode.
 */
/** Folders on the Home page. */
export const folderApi = {
    list: () => api('GET', '/api/folders').then(r => r.folders),
    create: (id, name, parent = null) => api('POST', '/api/folders', { id, name, parent }),
    update: (id, patch) => api('PATCH', `/api/folders/${enc(id)}`, patch),
    remove: id => api('DELETE', `/api/folders/${enc(id)}`),
};

export const templateApi = {
    /** Base project template as { path: text }. */
    get: name => api('GET', `/api/templates/${enc(name)}`).then(r => r.files),
};

export const libraryApi = {
    /** The built npm package (.tgz) of a library version, or null when it was not uploaded (`midas bundle`). */
    package: async (id, version) => {
        const res = await fetch(`/api/libraries/${enc(id)}/versions/${enc(version)}/package`, { credentials: 'same-origin' });
        if (!res.ok) return null;
        return { name: res.headers.get('x-package-file') || `${id}-${version}.tgz`, bytes: new Uint8Array(await res.arrayBuffer()) };
    },
    list: () => api('GET', '/api/libraries').then(r => r.libraries),
    snapshot: async (id, seq) => {
        try {
            return await api('GET', `/api/libraries/${enc(id)}/snapshot${seq ? `?seq=${seq}` : ''}`);
        } catch (e) {
            if (e.status === 404) return null;
            throw e;
        }
    },
    history: id => api('GET', `/api/libraries/${enc(id)}`),
    /** Status kode per komponen untuk satu versi (dari `midas report`). */
    codeStatus: (id, version) => api('GET', `/api/libraries/${enc(id)}/versions/${enc(version)}/code`),
    /** Build (or rebuild) the code package of a version from Midas' standard components. */
    buildCode: (id, version) => api('POST', `/api/libraries/${enc(id)}/versions/${enc(version)}/build`),
    /** Bahan form publish: mapping default, saran versi & nama paket, breaking change. */
    draft: (id, name, snapshot, iconKeys = []) => api('POST', `/api/libraries/${enc(id)}/draft`, { name, snapshot, iconKeys }),
    packageAvailable: (name, library) => api('GET', `/api/libraries/package-available?name=${enc(name)}${library ? `&library=${enc(library)}` : ''}`),
    publish: (id, body) => api('POST', `/api/libraries/${enc(id)}/versions`, body).then(r => ({ ...r.library, code: r.code, codeError: r.codeError })),
    fileUses: async fileId => {
        try {
            return (await api('GET', `${fileUrl(fileId)}/libraries`)).libraries;
        } catch (e) {
            if (e.status === 404) return [];
            throw e;
        }
    },
    setFileUses: (fileId, uses) => api('PUT', `${fileUrl(fileId)}/libraries`, { libraries: uses.map(u => ({ id: u.id, version: u.version })) }).catch(e => {
        if (e.status !== 404) throw e; // file belum pernah disimpan ke server
    })
};

/** Code Builder project (spec §4): module & screen dari file desain, library + versi yang dipakai. */
export const builderApi = {
    list: fileId => api('GET', `/api/builder-projects${fileId ? `?fileId=${enc(fileId)}` : ''}`).then(r => r.projects),
    get: id => api('GET', `/api/builder-projects/${enc(id)}`).then(r => r.project),
    create: body => api('POST', '/api/builder-projects', body).then(r => r.project),
    /** `body.version` = versi terakhir yang dibaca; konflik → ApiError 409 dengan `data.project` versi server. */
    save: (id, body) => api('PUT', `/api/builder-projects/${enc(id)}`, body).then(r => r.project),
    remove: id => api('DELETE', `/api/builder-projects/${enc(id)}`),
    mappings: (libraryId, version) => api('GET', `/api/libraries/${enc(libraryId)}/versions/${enc(version)}/mappings`).then(r => r.mappings),
    versions: libraryId => api('GET', `/api/libraries/${enc(libraryId)}`),
};

const LEGACY_LIBS_DONE = 'midas-legacy-libraries-migrated';

/**
 * Pindahkan library dari penyimpanan lama ke tabel library di server:
 * kunci `libraries` / `library:<id>` / `libuse:<fileId>` di /api/kv (data sebelum fitur ini)
 * dan, sekali per browser, dari IndexedDB lama. Library yang file sumbernya belum ada di server dilewati.
 */
export async function migrateLegacyLibraries(legacyKv) {
    const snapshots = new Map(), uses = {}, kvKeys = [];
    const collect = async (get, keys) => {
        for (const k of await keys('library:')) {
            try {
                const snap = JSON.parse(await get(k) || 'null');
                if (snap?.id && Array.isArray(snap.components)) snapshots.set(snap.id, snap);
            } catch { }
        }
        for (const k of await keys('libuse:')) {
            try {
                const list = JSON.parse(await get(k) || '[]');
                if (Array.isArray(list) && list.length) uses[k.slice('libuse:'.length)] = list.map(u => ({ id: u.id, version: u.version || 1 }));
            } catch { }
        }
    };
    const serverKeys = async prefix => (await api('GET', `/api/kv?prefix=${enc(prefix)}`)).keys;
    const serverGet = key => api('GET', `/api/kv/${enc(key)}`).then(r => r.value, () => null);
    await collect(serverGet, async prefix => {
        const keys = await serverKeys(prefix);
        kvKeys.push(...keys);
        return keys;
    });
    let fromIdb = false;
    if (legacyKv && !localStorage.getItem(LEGACY_LIBS_DONE)) {
        fromIdb = true;
        await collect(k => legacyKv.get(k), p => legacyKv.keys(p)).catch(() => { });
    }
    if (!snapshots.size && !Object.keys(uses).length) return;
    const { missing } = await api('POST', '/api/libraries/import-legacy', { snapshots: [...snapshots.values()], uses });
    // Data yang file sumbernya belum ada di server disimpan dulu, dicoba lagi saat login berikutnya.
    const keep = new Set(missing);
    for (const k of kvKeys) {
        const id = k.startsWith('library:') ? k.slice('library:'.length) : null;
        const pending = id ? keep.has(id) : (uses[k.slice('libuse:'.length)] || []).some(u => keep.has(u.id));
        if (!pending) await api('DELETE', `/api/kv/${enc(k)}`).catch(() => { });
    }
    await api('DELETE', '/api/kv/libraries').catch(() => { });
    if (fromIdb && !missing.length) localStorage.setItem(LEGACY_LIBS_DONE, '1');
}

let signedInUser = null;
const remember = user => (signedInUser = user);

/** User yang sedang login (diisi setelah auth.me/login/register). */
export const getSignedInUser = () => signedInUser;

export const auth = {
    status: () => api('GET', '/api/auth/status'),
    async me() {
        try {
            return remember((await api('GET', '/api/auth/me')).user);
        } catch (e) {
            if (e.status === 401) return remember(null);
            throw e;
        }
    },
    login: (email, password) => api('POST', '/api/auth/login', { email, password }).then(r => remember(r.user)),
    register: (name, email, password) => api('POST', '/api/auth/register', { name, email, password }).then(r => remember(r.user)),
    logout: () => api('POST', '/api/auth/logout').then(() => remember(null))
};

/** Upload dokumen lama dari IndexedDB sebagai file baru di workspace (id tetap). */
export async function importLegacyDocument(id, data) {
    try {
        await api('POST', '/api/files/import', { id, data });
    } catch (e) {
        if (e.status !== 409) throw e; // sudah pernah di-import
    }
}

export async function loadSettings() { }
