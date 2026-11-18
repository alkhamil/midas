// The latest snapshot of each library, kept in this browser (IndexedDB), so a file that uses a library still renders when the
// server cannot be reached. The file itself keeps only references (libRef); the snapshot is never written into the file.
// Every call is guarded: a browser without IndexedDB, or a blocked store, just has no cache.

const DB = 'midas-libraries', STORE = 'snapshots';

function openDb() {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB is not available'));
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

/** The cached snapshot of a library, or null when none is cached. */
export async function cachedSnapshot(id) {
    try {
        const db = await openDb();
        return await new Promise((resolve, reject) => {
            const req = db.transaction(STORE).objectStore(STORE).get(id);
            req.onsuccess = () => resolve(req.result ?? null);
            req.onerror = () => reject(req.error);
        });
    }
    catch {
        return null;
    }
}

/** Keeps the snapshot a library was last fetched as. A failed write leaves the cache as it was. */
export async function cacheSnapshot(id, snap) {
    try {
        const db = await openDb();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put(snap, id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }
    catch {
        // No cache in this browser: the library is fetched from the server each time.
    }
}
