#!/usr/bin/env node
/**
 * Auto-translate locale JSON memakai layanan GRATIS (tanpa API key).
 *
 *   node scripts/i18n-translate.mjs --check
 *   node scripts/i18n-translate.mjs --write [--source en] [--target id] [--provider gtx|mymemory]
 *
 * Cara kerja: pindai semua file locale (`src/shared/i18n/locales/<lang>/*.json`
 * + `src/modules/<*>/i18n/<lang>.json`), cari key yang kosong/hilang di bahasa
 * target dibanding bahasa sumber, terjemahkan, tulis kembali (format 2 spasi,
 * tanpa newline akhir — samakan gaya repo).
 *
 * - Placeholder `{{var}}` dilindungi agar tidak ikut diterjemahkan.
 * - Hasil di-cache di `scripts/.i18n-cache.json` (key = provider|sl|tl|teks).
 * - `--check` (default): hanya lapor, tanpa network & tanpa tulis file.
 * - Offline/gagal network: file tidak diubah, exit 2.
 *
 * Provider (keduanya gratis, tanpa API key; butuh internet saat `--write`):
 * - `mymemory` (default): API terjemahan gratis, anonim (ada batas harian;
 *   naik ke 50rb karakter/hari dengan key email gratis).
 * - `gtx`: endpoint gratis Google Translate — sering menolak query otomatis
 *   ("Sorry... automated queries"), jadi hanya fallback.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { globSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CACHE_PATH = path.join(ROOT, 'scripts', '.i18n-cache.json');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(=(.*))?$/);
    return m ? [m[1], m[3] ?? true] : [];
  }).filter((e) => e.length),
);
const SOURCE = args.source ?? 'en';
const TARGET = args.target ?? 'id';
const PROVIDER = args.provider ?? 'mymemory';
const WRITE = args.write !== undefined && args.write !== 'false';

function findLocaleDirs() {
  const dirs = new Set();
  for (const f of globSync('src/shared/i18n/locales/*/*.json', { cwd: ROOT })) {
    dirs.add(path.dirname(path.join(ROOT, f)));
  }
  for (const f of globSync('src/modules/**/i18n/*.json', { cwd: ROOT })) {
    dirs.add(path.dirname(path.join(ROOT, f)));
  }
  return [...dirs];
}

function flatten(obj, pre = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object') flatten(v, `${pre}${k}.`, out);
    else out[`${pre}${k}`] = v;
  }
  return out;
}

function unflatten(flat) {
  const out = {};
  for (const [key, v] of Object.entries(flat)) {
    const parts = key.split('.');
    let cur = out;
    for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]] ??= {};
    cur[parts.at(-1)] = v;
  }
  return out;
}

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

function writeJson(p, obj) {
  // Tanpa newline akhir — samakan gaya locale JSON repo ini.
  writeFileSync(p, JSON.stringify(obj, null, 2));
}

// Ganti placeholder {{x}} dengan token privat sebelum kirim, kembalikan sesudahnya.
function protect(text) {
  const vars = [];
  const masked = text.replace(/\{\{[^}]+\}\}/g, (m) => {
    vars.push(m);
    return `\uE000${vars.length - 1}\uE001`;
  });
  return { masked, restore: (t) => t.replace(/\uE000(\d+)\uE001/g, (_, i) => vars[Number(i)] ?? '') };
}

async function translateGtx(text, sl, tl) {
  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t` +
    `&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`gtx http ${res.status}`);
  const data = await res.json();
  return (data[0] ?? []).map((part) => part[0]).join('');
}

async function translateMyMemory(text, sl, tl) {
  const url =
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}` +
    `&langpair=${sl}|${tl}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`mymemory http ${res.status}`);
  const data = await res.json();
  if (!data?.responseData?.translatedText) throw new Error('mymemory: no translation');
  return data.responseData.translatedText;
}

const PROVIDERS = { gtx: translateGtx, mymemory: translateMyMemory };

function loadCache() {
  try {
    return JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

async function translateCached(cache, text, sl, tl) {
  const key = `${PROVIDER}|${sl}|${tl}|${text}`;
  if (cache[key]) return { text: cache[key], cached: true };
  const { masked, restore } = protect(text);
  const raw = await PROVIDERS[PROVIDER](masked, sl, tl);
  const out = restore(raw);
  cache[key] = out;
  return { text: out, cached: false };
}

async function main() {
  if (!PROVIDERS[PROVIDER]) {
    console.error(`Unknown provider: ${PROVIDER} (pilih gtx|mymemory)`);
    process.exit(2);
  }
  const cache = loadCache();
  let cacheDirty = false;
  let totalMissing = 0;

  for (const dir of findLocaleDirs()) {
    const srcFile = path.join(dir, `${SOURCE}.json`);
    const dstFile = path.join(dir, `${TARGET}.json`);
    if (!existsSync(srcFile)) continue;
    const srcFlat = flatten(readJson(srcFile));
    const dstFlat = existsSync(dstFile) ? flatten(readJson(dstFile)) : {};
    const missing = Object.keys(srcFlat).filter(
      (k) => typeof dstFlat[k] !== 'string' || dstFlat[k].trim() === '',
    );
    if (missing.length === 0) continue;
    const rel = path.relative(ROOT, dstFile);
    console.log(`${rel}: ${missing.length} key hilang di '${TARGET}'`);
    totalMissing += missing.length;
    if (!WRITE) {
      for (const k of missing.slice(0, 10)) console.log(`  - ${k}`);
      if (missing.length > 10) console.log(`  ... +${missing.length - 10} lagi`);
      continue;
    }
    for (const k of missing) {
      try {
        const { text, cached } = await translateCached(cache, String(srcFlat[k]), SOURCE, TARGET);
        dstFlat[k] = text;
        cacheDirty = true;
        console.log(`  ${cached ? '[cache]' : '[api]'} ${k} -> ${text.slice(0, 60)}`);
      } catch (err) {
        console.error(`  GAGAL ${k}: ${err.message} (file tidak diubah untuk key ini)`);
      }
    }
    const stillMissing = Object.keys(srcFlat).filter(
      (k) => typeof dstFlat[k] !== 'string' || dstFlat[k].trim() === '',
    );
    if (stillMissing.length === 0) writeJson(dstFile, unflatten(dstFlat));
    else console.error(`  ${stillMissing.length} key tetap kosong — file ${rel} TIDAK ditulis.`);
  }

  if (cacheDirty) writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  console.log(totalMissing === 0 ? 'Semua locale lengkap.' : `Total key hilang: ${totalMissing}`);
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(2);
});
