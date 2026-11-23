# Midas Roadmap

Diperbarui 2026-11-18 dari kondisi kode (`AGENTS.md`, `docs/behavior-spec.md`, `docs/slots.md`, `docs/prototype-spec.md`, `docs/rust-plan.md`). Kalau ada yang beda, dokumen-dokumen itu yang menang.

Urutan fase: **0 → 1 → 2 → 3 → 4**. Fase berikutnya baru mulai kalau exit criteria fase sebelumnya terpenuhi.

Legenda: `[x]` = kode ada dan teruji unit test; `[ ]` = belum; catatan "browser" = belum diverifikasi di browser.

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
- [x] Push branch `feat/fahmi` (sudah ada di origin)
- [x] Catat known issue: test `selColorSwatch` gagal (pre-existing) — basi, tidak ada di repo (triase 2026-10-31)

Triase 2026-10-31 (baseline: builder-core 642 lulus, studio 43 lulus, 0 gagal). Baseline terakhir di `AGENTS.md`: builder-core 842, studio 53, 0 gagal.

**Exit:** Button outlined/solid/dashed tampil benar di canvas, Play, dan codegen. **Terpenuhi** (dikonfirmasi user 2026-11-18).

---

## Fase 1: Component schema + template + behavior

Tujuan: semua component punya schema JSON, template sebagai component, dan behavior-nya.

Referensi struktur: `D:\antd-ref\components\<nama>` (read-only).

| Batch | Component | Status |
|---|---|---|
| 1 | Input (kind `text`, `password`, `textarea`) | ✅ Kode selesai. Text dan Password single-line; Textarea (kind `textarea`) multi-line. Browser: lihat `docs/input-managed-text.md`. |
| 2 | Checkbox, Radio, Switch | ✅ Kode dan template ada. Radio.Group belum dibuat (Tier 3). |
| 3 | Tag, Alert | ✅ Kode dan template ada. Alert punya slot icon, close, action, dan Banner. |
| 2a (tambahan) | Badge, Card, Divider, Avatar, Text, Title, Paragraph, Link, Icon Button, FormItem, List, InputNumber | ✅ Kode ada (registry dan template). Badge corner count belum dibuat. |
| 4 | Spin, Empty, Search Field | ✅ Kode, test unit, dan browser lulus (2026-11-19). |
| 5a | Statistic (Tier 0) | 🟡 Kode, template, unit test, conformance ada (2026-11-19). Browser: lebar root sudah sama (tes menunggu font); belum lulus karena crop tidak sama dan glyph ikon suffix di dalam valueBox tidak di-scale di canvas. Size xs sampai xl. |
| 5b | Progress (Tier 0) | ⛔ Diblokir: butuh lebar dalam persen dari parent (bar), belum ada di model sizing node. Perlu keputusan. |
| A | Pagination, Breadcrumb, Table Toolbar | 🟡 Kode, template, unit test, conformance (2026-11-23). Browser parity lulus (`navigation-toolbar.browser.test.mjs`). Pagination menampilkan halaman sebagai teks (tanpa daftar tombol halaman). Breadcrumb tiga item tetap dengan separator statis "/". Table Toolbar: Filters menunggu Select. |
| A (ditunda) | Radio Group | ⏸ Ditunda sampai Fase 2 (Prototype) selesai. Kode ada, tetapi belum ada state pilihan tunggal dan opsi dari data. Rencana: prop `options` (daftar) dan `value`, dengan sync instance dan single-select di Play dan export. Browser parity belum dibuat. |
| 5+ | Select, Dialog, Tabs, Table, dll. | ❌ Belum ada template. Daftar lengkap dan urutan ada di `docs/specs/web-components.md` (P1 dulu). |

Per component, selesai kalau:
- [ ] Schema JSON (collections, persistent props, slots, features)
- [ ] Template by hand sebagai data schema
- [ ] Auto-bind (collection bind, auto-match, mode write)
- [ ] Diagnostics hanya cek collection yang dibutuhkan
- [ ] State: hover/focus/focus-visible/disabled
- [ ] Play + codegen
- [ ] Test untuk binding dan kind baru
- [ ] `AGENTS.md` terupdate

Catatan: Input (batch 1) memenuhi semua item kode di atas. Item browser tetap terbuka untuk semua component.

**Exit:** semua component P1 di `docs/specs/web-components.md` punya template yang jalan di canvas, Play, dan codegen. **Belum terpenuhi**: component P1 yang belum ada (Select, Table, Dialog, Tabs, dan lainnya, lihat batch 5+).

---

## Fase 2: Prototype + Play (DOM)

Tujuan: preview DOM setia ke canvas dan prototype lengkap.

Prototype (`docs/prototype-spec.md`):
- [x] Conditional (Round 7: model, validator, Play, panel).
- [x] Set variable (decision 17): model, validasi, Play (nilai untuk sesi, dokumen tidak ditulis), panel. `set-variable.browser.test.mjs`.
- [x] Overlay / dropdown / popover (decision 15 dan 16): model, validasi, player, Play, panel. `overlay.browser.test.mjs`, `overlay-panel.browser.test.mjs`. Export overlay tidak direncanakan (prototype preview, bukan kode komponen).
- [ ] Interaksi template Modal: menunggu template Dialog (Fase 1, batch C). Input dan Alert: Play dicek di browser (`alert.browser.test.mjs`, `input-live.browser.test.mjs`).

Fidelity Play:
- [ ] Grid layout di Play. Belum dikerjakan: grid bukan tipe layout di model dokumen (hanya horizontal, vertical, dan none). Butuh keputusan desain dan perubahan canvas, engine, dan Play, bukan perbaikan Play saja.
- [x] Mask di auto layout: mask rect dan ellipse menjadi clip-path pada layer di atasnya, dengan posisi tersimpan (`prototype-fidelity.test.js`). Mask bentuk lain atau pada layer yang dirotasi masih dilaporkan, tidak digambar.
- [x] Motion (Play dan codegen saja, bukan canvas): sudah untuk Button, Input, Checkbox, Radio, Switch, Divider
- [x] Audit stroke overlay: `stroke-area.browser.test.mjs` membandingkan canvas dan Play untuk setiap alignment, bentuk, paint, dash, dan per-side.
Opsional:
- [ ] Generator schema dari source antd (struktur saja, nilai tetap dari variable)

Di luar daftar ini tapi masih rencana (lihat `docs/play-from-tsx.md`, `docs/form-validation.md`, belum dibangun):
- [ ] Play dari TSX (langkah 1 sampai 9)
- [ ] Validasi FormItem (rules, validateStatus, trigger)

**Exit:** flow prototype dengan conditional, variable, dan overlay jalan di Play tanpa beda dengan canvas. **Belum terpenuhi**: variable dan overlay belum ada.

---

## Fase 3: Publish library + dokumentasi live

Tujuan: library bisa dipublish dan tiap component punya dokumentasi dengan live preview.

Status: **belum mulai.**

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

Status: **belum mulai.** Icon saat ini masih dari page `Icons` dan `ICON_SET` (lihat `AGENTS.md`).

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

## Jalur Rust (paralel, `docs/rust-plan.md`)

| Fase Rust | Status |
|---|---|
| 0 WASM bridge | Selesai |
| 1 Paint dan stroke | Selesai (2026-11-13) |
| 2 Shell Tauri | Sedang berjalan (`feat/desktop-shell`) |
| 3 Model dokumen di Rust | Belum mulai |
| 4 Auto design system di Rust | Belum mulai |
| 5 Canvas renderer di Rust | Gated |
| 6 Compiler Play ke HTML/CSS di Rust | Belum mulai |
| 7 Keputusan UI | Gated |

---

## Known issues

- Test `selColorSwatch` tidak ada di repo (triase 2026-10-31) — isu basi, ditutup.
- Hampir semua fix terbaru belum diverifikasi di browser (tanpa browser automation). Checklist ada di `docs/manual-test.md`, `docs/slots.md` bagian 6, dan `docs/input-managed-text.md` bagian 6.
- Suite browser punya kegagalan yang sudah diketahui (lihat `AGENTS.md`, Known issues).
- 2026-11-17, langkah 1 (exporter): `.jsx` untyped tidak lagi memuat sintaks TypeScript (`codegen.js`, `fillHelpers(false)`); hash pin Button dan Input di `icon-button-wave.test.js` di-repin setelah diff hanya memuat anotasi yang dibuang. 2626 tes builder-core lulus. `export-parity`: Button lulus. Input gagal di keadaan kosong: input tidak berada di posisi yang sama antara export dan Play (sm, md, lg, xl, "empty"). Itu selisih geometri yang sudah tercatat sebagai drift (placeholder tanpa elemen Play, gap nilai), belum diperbaiki. Satu percobaan pertama juga gagal karena navigasi halaman, tidak terulang di percobaan kedua.
- 2026-11-17, lanjutan: `export-parity` lulus penuh (Button dan Input). Penyebab selisih Input: `syncParts` (`midas.js`) menghapus salinan placeholder master saat value terisi, lalu menyalin ulang saat ganti Size, sehingga ada dua layer placeholder. Sekarang hanya part yang dibuat instance sendiri yang dihapus. `parts` browser lulus. Unit test studio: 6 gagal di `desktopBridge.test.js`, sama dengan kode sebelum perubahan (sudah ada sebelumnya, bukan dari perubahan ini).
- 2026-11-17, langkah 2 (tes basi): `input-live` dan `limits` lulus setelah locator dipersempit ke `input.input-value` (frame Play memuat InputNumber dari stage yang sama). `strict-parity`: ekspektasi outline Input dimatikan (outline transparan saat rest) dan check placeholder kini memastikan tepat dua baris, Input dan placeholder. Yang masih gagal, keputusan Anda: (1) Input piksel 8,0 sampai 8,5% vs batas 8% (sisa rasterizer?); (2) Button xl outline 0,68px vs 0,5px (geometri, bukan tes). Selisih teks Button xs rest (1,13px) berubah-ubah antar run.
- 2026-11-17, lanjutan: penyebab piksel Input 8% bukan teks (mask teks memperburuk angka). Penyebabnya view menu Play (View options) yang tertinggal terbuka dan menimpa ujung kanan Input saat screenshot; `playTree` sekarang menutupnya dengan Esc. Piksel Input turun ke 0,0 sampai 0,5%. `strict-parity` sekarang lulus penuh (50 pair). Outline Button diukur dari box root (`outlineFromBox`), bukan dari tepi piksel screenshot, karena tepi piksel bergeser 0,7px oleh posisi sub-piksel sementara box cocok dalam 0,02px. Keputusan user: pilihan 1.
- 2026-11-17, langkah 3 (Alert): penyebab rootWidth adalah kelas CSS root yang membawa lebar master 400px ke semua instance. Sekarang `rootClassWidth` (layout.js) dipakai codegen dan Play; instance yang fill atau hug di root tidak membawa lebar itu. Keputusan user: rootWidth 400 hanya default saat dibuat, Play mengikuti canvas, banner tetap fill. `alert.browser.test.mjs`: 30 pair lulus. Builder-core 2629 lulus. Belum dikerjakan: slot kosong 444px.
