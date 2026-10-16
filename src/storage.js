// Browser client-side storage implementation for Midas.
// Uses IndexedDB for large documents & library index (supports large Figma files with 180k+ layers),
// with structured page-level incremental storage, automatic migration, and seamless fallback to localStorage.
// `settings` provides synchronous access to localStorage settings.

const DB_NAME = 'midas-db';
const DB_VERSION = 1;
const STORE_NAME = 'kv';
const KV_PREFIX = 'midas:kv:';

let dbPromise = null;

function getDB() {
    if (dbPromise) return dbPromise;
    if (typeof indexedDB === 'undefined') {
        return Promise.resolve(null);
    }
    dbPromise = new Promise((resolve) => {
        try {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            req.onsuccess = () => {
                resolve(req.result);
            };
            req.onerror = (e) => {
                console.warn('IndexedDB unavailable, falling back to localStorage:', e);
                resolve(null);
            };
        } catch (e) {
            console.warn('Failed to open IndexedDB:', e);
            resolve(null);
        }
    });
    return dbPromise;
}

let migrated = false;
async function ensureMigrated(db) {
    if (migrated || !db || typeof localStorage === 'undefined') return;
    migrated = true;
    try {
        const keysToMigrate = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(KV_PREFIX)) {
                keysToMigrate.push([k.slice(KV_PREFIX.length), localStorage.getItem(k)]);
            }
        }
        if (!keysToMigrate.length) return;
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        for (const [subKey, val] of keysToMigrate) {
            if (val !== null) {
                store.put(val, subKey);
            }
        }
    } catch (e) {
        console.warn('Migration from localStorage to IndexedDB skipped:', e);
    }
}

export const kv = {
    async get(key) {
        try {
            const db = await getDB();
            if (db) {
                await ensureMigrated(db);
                return await new Promise((resolve) => {
                    const tx = db.transaction(STORE_NAME, 'readonly');
                    const store = tx.objectStore(STORE_NAME);
                    const req = store.get(key);
                    req.onsuccess = () => {
                        if (req.result !== undefined) {
                            resolve(req.result);
                        } else if (typeof localStorage !== 'undefined') {
                            resolve(localStorage.getItem(KV_PREFIX + key));
                        } else {
                            resolve(null);
                        }
                    };
                    req.onerror = () => {
                        if (typeof localStorage !== 'undefined') {
                            resolve(localStorage.getItem(KV_PREFIX + key));
                        } else {
                            resolve(null);
                        }
                    };
                });
            }
            if (typeof localStorage !== 'undefined') {
                return localStorage.getItem(KV_PREFIX + key);
            }
            return null;
        } catch (e) {
            console.error('Failed to read from storage:', e);
            if (typeof localStorage !== 'undefined') {
                return localStorage.getItem(KV_PREFIX + key);
            }
            return null;
        }
    },

    async put(key, value) {
        let savedInIdb = false;
        try {
            const db = await getDB();
            if (db) {
                await new Promise((resolve, reject) => {
                    const tx = db.transaction(STORE_NAME, 'readwrite');
                    const store = tx.objectStore(STORE_NAME);
                    const req = store.put(value, key);
                    req.onsuccess = () => resolve();
                    req.onerror = () => reject(req.error);
                });
                savedInIdb = true;
            }
        } catch (e) {
            console.warn('Failed to write to IndexedDB:', e);
        }

        // Keep localStorage in sync if small enough (< 1MB), but never throw if it exceeds quota
        if (typeof localStorage !== 'undefined') {
            try {
                if (typeof value === 'string' && value.length < 1024 * 1024) {
                    localStorage.setItem(KV_PREFIX + key, value);
                } else if (savedInIdb) {
                    // Free up space in localStorage if large document is already safely in IndexedDB
                    localStorage.removeItem(KV_PREFIX + key);
                }
            } catch (e) {
                if (!savedInIdb) {
                    console.error('Storage quota exceeded in both IndexedDB and localStorage:', e);
                    throw e;
                }
            }
        }

        if (!savedInIdb && typeof localStorage !== 'undefined') {
            localStorage.setItem(KV_PREFIX + key, value);
        }
    },

    async del(key) {
        try {
            const db = await getDB();
            if (db) {
                await new Promise((resolve) => {
                    const tx = db.transaction(STORE_NAME, 'readwrite');
                    const store = tx.objectStore(STORE_NAME);
                    const req = store.delete(key);
                    req.onsuccess = () => resolve();
                    req.onerror = () => resolve();
                });
            }
        } catch (e) {
            console.warn('Failed to delete from IndexedDB:', e);
        }
        if (typeof localStorage !== 'undefined') {
            try {
                localStorage.removeItem(KV_PREFIX + key);
            } catch (e) {
                console.error('Failed to delete from localStorage:', e);
            }
        }
    }
};

/**
 * Structured project storage supporting 180,000+ layers across 70+ pages.
 * Splits document metadata, individual pages, and assets into separate bounded chunks.
 * Incremental autosaves only write the active page and metadata instead of the whole file.
 */
export const projectStorage = {
    async getQuota() {
        if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
            try {
                const est = await navigator.storage.estimate();
                const usage = est.usage || 0;
                const quota = est.quota || 0;
                const percent = quota > 0 ? (usage / quota) * 100 : 0;
                const availableMB = Math.max(0, (quota - usage) / (1024 * 1024));
                return {
                    usage,
                    quota,
                    percent: Math.round(percent * 10) / 10,
                    availableMB: Math.round(availableMB),
                    isLow: quota > 0 && (percent > 90 || availableMB < 50)
                };
            } catch (e) {
                console.warn('Storage estimate failed:', e);
            }
        }
        return null;
    },

    // Save project incrementally: writes project metadata and all pages in bounded chunks
    async saveProject(fileId, docData, { onProgress } = {}) {
        const pages = docData.pages || [];
        
        // 1. Separate project metadata (strip nodes from pages list for lightweight metadata)
        const meta = {
            id: fileId,
            format: 'midas',
            version: 1,
            name: docData.name || 'Untitled',
            pageId: docData.pageId || (pages[0]?.id),
            pageMeta: pages.map(p => ({ id: p.id, name: p.name, parentId: p.parentId || null })),
            tokens: docData.tokens,
            variables: docData.variables,
            thumbnailId: docData.thumbnailId ?? null,
            created: docData.created || Date.now(),
            updated: Date.now()
        };

        // Write metadata
        await kv.put(`file:${fileId}:meta`, JSON.stringify(meta));
        
        // 2. Write pages in bounded chunks, yielding between chunks
        for (let i = 0; i < pages.length; i++) {
            const p = pages[i];
            await kv.put(`file:${fileId}:page:${p.id}`, JSON.stringify(p));
            if (onProgress) {
                onProgress({
                    savedPages: i + 1,
                    totalPages: pages.length,
                    pageName: p.name
                });
            }
            if (i % 3 === 0) {
                await new Promise(r => setTimeout(r, 0));
            }
        }

        // 3. Save assets if any
        if (docData.assets && Object.keys(docData.assets).length) {
            await kv.put(`file:${fileId}:assets`, JSON.stringify(docData.assets));
        }
        
        return meta;
    },

    // Incremental write: saves ONLY the active page and updates project metadata!
    async saveActivePage(fileId, docData, activePage) {
        const pages = docData.pages || [];
        const meta = {
            id: fileId,
            format: 'midas',
            version: 1,
            name: docData.name,
            pageId: docData.pageId,
            pageMeta: pages.map(p => ({ id: p.id, name: p.name, parentId: p.parentId || null })),
            tokens: docData.tokens,
            variables: docData.variables,
            thumbnailId: docData.thumbnailId ?? null,
            updated: Date.now()
        };

        await Promise.all([
            kv.put(`file:${fileId}:page:${activePage.id}`, JSON.stringify(activePage)),
            kv.put(`file:${fileId}:meta`, JSON.stringify(meta))
        ]);
        
        if (docData.assets) {
            await kv.put(`file:${fileId}:assets`, JSON.stringify(docData.assets));
        }
    },

    // Load full project (combining metadata + all pages)
    async loadProject(fileId) {
        const metaRaw = await kv.get(`file:${fileId}:meta`);
        if (metaRaw) {
            try {
                const meta = JSON.parse(metaRaw);
                const pageMeta = meta.pageMeta || [];
                const pages = [];
                for (const pm of pageMeta) {
                    const pRaw = await kv.get(`file:${fileId}:page:${pm.id}`);
                    if (pRaw) {
                        pages.push(JSON.parse(pRaw));
                    } else {
                        pages.push({ id: pm.id, name: pm.name, parentId: pm.parentId, nodes: [] });
                    }
                }
                const assetsRaw = await kv.get(`file:${fileId}:assets`);
                const assets = assetsRaw ? JSON.parse(assetsRaw) : {};
                return {
                    format: 'midas',
                    version: 1,
                    name: meta.name,
                    pageId: meta.pageId || pages[0]?.id,
                    pages,
                    tokens: meta.tokens,
                    variables: meta.variables,
                    thumbnailId: meta.thumbnailId,
                    assets
                };
            } catch (e) {
                console.warn('Failed to parse structured project, checking single file fallback:', e);
            }
        }

        // Fallback: check legacy single file key
        const singleRaw = await kv.get(`file:${fileId}`);
        if (singleRaw) {
            const data = typeof singleRaw === 'string' ? JSON.parse(singleRaw) : singleRaw;
            // Upgrade to structured chunked storage in background
            this.saveProject(fileId, data).catch(err => console.warn('Background project upgrade error:', err));
            return data;
        }

        return null;
    },

    // Export full project JSON (for downloading .midas file)
    async exportProject(fileId, inMemoryDocData) {
        if (inMemoryDocData) {
            const allInMemory = inMemoryDocData.pages?.every(p => Array.isArray(p.nodes));
            if (allInMemory) {
                return JSON.stringify({ ...inMemoryDocData, format: 'midas', version: 1 }, null, 2);
            }
        }
        const full = await this.loadProject(fileId);
        if (!full) throw new Error('Project not found');
        return JSON.stringify(full, null, 2);
    },

    // Delete project and all its chunked pages and assets
    async deleteProject(fileId) {
        const metaRaw = await kv.get(`file:${fileId}:meta`);
        if (metaRaw) {
            try {
                const meta = JSON.parse(metaRaw);
                for (const pm of meta.pageMeta || []) {
                    await kv.del(`file:${fileId}:page:${pm.id}`);
                }
            } catch {}
            await kv.del(`file:${fileId}:meta`);
            await kv.del(`file:${fileId}:assets`);
        }
        await kv.del(`file:${fileId}`);
    }
};

export const settings = {
    getItem(key) {
        try {
            if (typeof localStorage !== 'undefined') {
                return localStorage.getItem(key);
            }
            return null;
        } catch {
            return null;
        }
    },
    setItem(key, value) {
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(key, String(value));
            }
        } catch (e) {
            console.error('Failed to set setting in localStorage:', e);
        }
    },
    removeItem(key) {
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem(key);
            }
        } catch (e) {
            console.error('Failed to remove setting from localStorage:', e);
        }
    }
};

export async function loadSettings() {
    return Promise.resolve();
}
