// Memuat bundle ESM library (hasil `midas bundle`) di browser. Bundle tidak membawa React: import `react`,
// `react-dom`, `react/jsx-runtime` diarahkan ke modul shim yang mengekspor React milik Studio, sehingga
// komponen library memakai satu instance React yang sama dengan renderer (hook & context bekerja).
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as JSXRuntime from 'react/jsx-runtime';

const SHARED = { react: React, 'react-dom': ReactDOM, 'react-dom/client': ReactDOMClient, 'react/jsx-runtime': JSXRuntime, 'react/jsx-dev-runtime': JSXRuntime };
const IDENT = /^[A-Za-z_$][\w$]*$/;

/** Sumber modul shim: `export default` + semua named export dari objek global. */
export function shimSource(spec, mod) {
    const names = Object.keys(mod).filter(k => k !== 'default' && IDENT.test(k));
    return `const m = globalThis.__midasShared[${JSON.stringify(spec)}];\nexport default (m.default ?? m);\nexport const { ${names.join(', ')} } = m;\n`;
}

/** Ganti specifier React di statement import/export bundle dengan URL lain. */
export function rewriteImports(code, resolve) {
    return code.replace(/(\bfrom\s*|\bimport\s*\(?\s*)(["'])(react|react-dom|react\/jsx-runtime|react\/jsx-dev-runtime|react-dom\/client)\2/g,
        (_, pre, q, spec) => `${pre}${q}${resolve(spec)}${q}`);
}

const shimUrls = new Map();
function shimUrl(spec) {
    if (!shimUrls.has(spec)) {
        globalThis.__midasShared ||= {};
        globalThis.__midasShared[spec] = SHARED[spec];
        shimUrls.set(spec, URL.createObjectURL(new Blob([shimSource(spec, SHARED[spec])], { type: 'text/javascript' })));
    }
    return shimUrls.get(spec);
}

const loaded = new Map();
/** Muat bundle sekali per URL (bundle immutable per versi library). */
export function loadBundle(url) {
    if (!loaded.has(url)) {
        loaded.set(url, (async () => {
            const res = await fetch(url, { credentials: 'same-origin' });
            if (!res.ok) throw new Error(res.status === 404 ? 'Bundle library belum diunggah (jalankan `midas bundle` di repo paket)' : `Gagal memuat bundle (${res.status})`);
            const code = rewriteImports(await res.text(), shimUrl);
            const blobUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
            return import(/* @vite-ignore */ blobUrl);
        })());
        loaded.get(url).catch(() => loaded.delete(url));
    }
    return loaded.get(url);
}

export const cssUrlOf = bundleUrl => bundleUrl.replace(/index\.js(?=\?|$)/, 'style.css');
