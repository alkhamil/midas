# Midas Roadmap

Urutan fase: **0 → 1 → 2 → 3 → 4**. Fase berikutnya baru mulai kalau exit criteria fase sebelumnya terpenuhi.

## Prinsip (berlaku di semua fase)

- "Sesuai Ant Design" = struktur saja (variant, props, state, size, slot). Nama bebas Midas.
- Semua nilai dari variable file (Primitives → Semantic), tidak disalin dari antd.
- Hug/fill/fixed milik node, tidak pernah ditulis engine.
- Engine generik dan schema-driven. Tidak ada kode khusus per component di engine.
- Satu stroke, satu penggambar (`strokeStrategyOf` dipakai bersama Play dan codegen).
- Strict: tanpa legacy, tanpa migration shim. File lama di-regenerate.
- Preview-only state (hover/active/focus) color-only, studio-only, ditolak saat disabled. Animasi hanya di Play/codegen.
- Tiap perubahan yang menambah aturan, lokasi file, atau known issue: update `AGENTS.md` 1 sampai 3 baris.

---

## Fase 0: Stabilisasi (sebelum component baru)

Tujuan: fondasi Button bersih, supaya component lain tidak mewarisi bug.

- [x] Fix stroke: satu penggambar (host border vs overlay), tanpa outline permanen di base rule
- [x] Fix label Button di Play (`rootLayoutOf` / `labelLayoutOf` / `generateComponent(master)`)
- [x] Fix icon slot: fill slot, gap default 16, icon tampil di Play, picker start/end untuk `both`
- [x] Disabled state tidak mewarisi hover/pressed/focus
- [x] Bikin `AGENTS.md` awal: Decisions, Code map, Known issues, Antrean
- [ ] Push branch `feat/fahmi` (butuh instruksi eksplisit; sudah merge PR #11)
- [x] Catat known issue: test `selColorSwatch` gagal (pre-existing) — basi, tidak ada di repo (triase 2026-10-31)

Triase 2026-10-31 (baseline: builder-core 642 lulus, studio 43 lulus, 0 gagal):
kode semua item di atas sudah jadi dan teruji (`codegen.test.js`, `focus-outline.test.js`,
`variant-style.test.js`, `icon-only.test.js`, `icon-slot.test.js`, `prototype-dom.test.js`).
Deviasi dari teks roadmap dicatat di `AGENTS.md`; spec tetap menang bila beda.
Sisa exit Fase 0: verifikasi manual di browser.

**Exit:** Button outlined/solid/dashed tampil benar di canvas, Play, dan codegen. Verifikasi manual di browser.

---

## Fase 1: Component schema + template + behavior

Tujuan: semua component punya schema JSON, template sebagai component, dan behavior-nya.

Referensi struktur: `D:\antd-ref\components\<nama>` (read-only).

| Batch | Component | Catatan |
|---|---|---|
| 1 | Input | ✅ done 2026-10-31. Menambah kind `control` (`<input>` asli). Variant, Status, Size. Slot prefix/suffix/addon. allowClear, showCount |
| 2 | Checkbox, Radio, Switch | Pakai `control`, tinggal data schema |
| 3 | Tag, Alert | Alert butuh slot icon + close |
| 4+ | Daftar lanjutan (Select, Modal, Tabs, dll.) | Ditentukan setelah batch 3 stabil |

Per component, selesai kalau:
- [ ] Schema JSON (collections, persistent props, slots, features)
- [ ] Template by hand sebagai data schema
- [ ] Auto-bind (collection bind, auto-match, mode write)
- [ ] Diagnostics hanya cek collection yang dibutuhkan
- [ ] State: hover/focus/focus-visible/disabled
- [ ] Play + codegen
- [ ] Test untuk binding dan kind baru
- [ ] `AGENTS.md` terupdate

**Exit:** semua component di daftar punya template yang jalan di canvas, Play, dan codegen. Engine tidak punya kode per component.

---

## Fase 2: Prototype + Play (DOM)

Tujuan: preview DOM setia ke canvas dan prototype lengkap.

Prototype fase 2:
- [ ] Conditional
- [ ] Set variable
- [ ] Overlay / dropdown / popover
- [ ] Interaksi template Input / Alert / Modal

Fidelity Play:
- [ ] Grid layout di Play
- [ ] Mask di auto layout
- [ ] Motion (Play dan codegen saja, bukan canvas)
- [ ] Audit stroke overlay: inside/center/outside, per-side, radius

Opsional:
- [ ] Generator schema dari source antd (struktur saja, nilai tetap dari variable)

**Exit:** flow prototype dengan conditional, variable, dan overlay jalan di Play tanpa beda dengan canvas.

---

## Fase 3: Publish library + dokumentasi live

Tujuan: library bisa dipublish dan tiap component punya dokumentasi dengan live preview.

- [ ] Format paket library (components + variables + schema + versi)
- [ ] Flow publish / update / versioning
- [ ] Konsumsi library dari file lain
- [ ] Situs dokumentasi, satu halaman per component
- [ ] Live preview per level: Component → Variant/Property → State → Slot
- [ ] Props table dari schema (otomatis, bukan ditulis tangan)
- [ ] Contoh codegen per component

**Exit:** library dipublish dari Midas, dan tiap component punya halaman docs dengan live preview yang berubah mengikuti property.

---

## Fase 4: Icon di server

Tujuan: icon reusable tanpa harus ditaruh di page design.

- [ ] Penyimpanan icon di server (upload, kategori, nama unik, versi)
- [ ] API list / search / fetch (SVG)
- [ ] Icon picker baca dari server (ganti sumber "semua component di semua page")
- [ ] Icon slot menyimpan referensi ke server, bukan salinan node
- [ ] Play dan codegen resolve icon dari server
- [ ] Migrasi icon yang sekarang ada di page design (di-regenerate, tanpa shim)
- [ ] Icon ikut paket library di Fase 3

**Exit:** file baru bisa memakai icon tanpa membuat page icon.

> Catatan: Fase 4 ada di akhir, tapi picker icon dipakai sejak Fase 1. Selama Fase 1 sampai 3, abstraksi sumber icon (`iconSource`) dijaga terpisah dari picker supaya pergantian ke server nanti kecil.

---

## Known issues

- Test `selColorSwatch` tidak ada di repo (triase 2026-10-31: builder-core 642 + studio 43 lulus, 0 gagal) — isu basi, ditutup.
- Hampir semua fix terbaru belum diverifikasi di browser (tanpa browser automation)
