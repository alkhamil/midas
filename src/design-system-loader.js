// Design System loader for Midas
// Loads /design-system.json and synchronizes with IndexedDB/localStorage

import { kv } from './storage.js';

export async function fetchDesignSystem({ reload = true } = {}) {
    if (!reload) {
        try {
            const cached = localStorage.getItem('figma-clone-design-system');
            if (cached) {
                return JSON.parse(cached);
            }
        } catch { }
    }
    // Fetch latest fresh version from /design-system.json
    const res = await fetch('/design-system.json?v=' + Date.now());
    if (!res.ok) throw new Error(`Could not fetch design-system.json (${res.status})`);
    const data = await res.json();
    try {
        localStorage.setItem('figma-clone-design-system', JSON.stringify(data));
    } catch { }
    return data;
}

export async function loadDesignSystem({ merge = false, reload = true } = {}) {
    const ds = await fetchDesignSystem({ reload });
    // Cache to acceptance criteria key
    try {
        localStorage.setItem('figma-clone-design-system', JSON.stringify(ds));
    } catch { }
    
    // Store as document in Midas KV storage (IndexedDB with localStorage fallback)
    try {
        await kv.put('file:design-system', JSON.stringify(ds));
    } catch (e) {
        console.warn('Could not store design system in kv:', e);
    }
    
    // Ensure indexed in Midas file library
    try {
        const rawIdx = await kv.get('index');
        const idx = rawIdx ? JSON.parse(rawIdx) : [];
        const existing = idx.find(m => m.id === 'design-system');
        if (existing) {
            existing.updated = Date.now();
            existing.opened = Date.now();
        } else {
            idx.unshift({
                id: 'design-system',
                name: 'Midas Design System',
                created: Date.now(),
                updated: Date.now(),
                opened: Date.now(),
                thumb: null
            });
        }
        await kv.put('index', JSON.stringify(idx));
    } catch (e) {
        console.warn('Could not index design system file:', e);
    }

    // Hand off to active editor engine if mounted
    if (typeof window !== 'undefined' && window.__midasLoadDesignSystem) {
        return window.__midasLoadDesignSystem(ds, { merge });
    }

    return ds;
}

if (typeof window !== 'undefined') {
    window.loadDesignSystem = loadDesignSystem;
    window.fetchDesignSystem = fetchDesignSystem;
}
