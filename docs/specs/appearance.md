# Appearance: pilihan mode dan variant per aksi (audit + desain)

Status: audit dan desain, belum ada kode. Slice A dari handoff. Slice B (Show feedback) dan C (aksi lain) menunggu konfirmasi.

## 1. Audit: aksi yang menampilkan atau membuka component lain

Semua aksi di bawah menunjuk component dengan id (`targetComponentId`, `componentId`, atau `slots.popup`/`showIconId`). Yang disimpan saat ini adalah id component atau id component set, bukan instance dan bukan mode.

| # | Aksi / tempat | Komponen | Picker | Yang disimpan saat ini |
|---|---|---|---|---|
| 1 | **Show feedback** (behavior `show-feedback`) | `feedbackComponentRows` (`apps/studio/src/engine/rulesUi.js:138`) dan `feedbackMotionRows` (`rulesUi.js:114`) | `ctx.componentButton` → `bhComponentButton` (`midas.js:19400`), ditulis di handler pilih (`midas.js:19454`) | Dua tempat: `convention.feedback.<kind>` (file, dipakai semua aksi) dan `<action>.componentId` ("Only this action") |
| 2 | **Show feedback** (aksi di Rules / On click) | `show-feedback` di `rulesUi.js:64` (`typeRow`, `ignoredNote`) | Sama dengan 1, lewat `componentId` | `actions[j].componentId`, `kind`, `level`, `position`, `motion` |
| 3 | **Open dropdown** | `openPick` (`midas.js:19530`) untuk `open-dropdown` (`midas.js:19563`) | `bhComponentButton` (`midas.js:19400`) | `interactions.N.actions.M.targetComponentId`, plus `width`, `height`, `position` |
| 4 | **Open popover / tooltip** | `openPick` untuk `open-popover` (`midas.js:19565`) | Sama dengan 3 | `targetComponentId`, `anchor`, `position` |
| 5 | **Open overlay / dialog** | `openPick` untuk `open-overlay` (`midas.js:19564`) | Sama dengan 3 | `targetComponentId`, `position`, `backdrop` |
| 6 | **Change variant** | `variantRows` (`midas.js:19548`) | `bhSelect` per properti varian (`variant`) | `actions[M].variants` (objek properti → nilai). Tidak memilih component: target adalah component set di layer |
| 7 | **Opens popup** (Select / Dropdown Menu, capability `has-options` slot `popup`) | `slotRow` kind `component` (`capabilitiesUi.js:15`) → `componentButton` | Sama dengan 3 | `behaviors.N.slots.popup`. Saat dibuka, `live.js:1079` membuat aksi `open-dropdown` dengan `targetComponentId` dari slot ini |
| 8 | **Icon swap** (Input password, `input.typeable.showIconId`) | `capabilitiesUi.js:29` | `componentButton` | `inputBehavior.typeable.showIconId` |
| 9 | **Tempat overlay di canvas** (ghost preview) | `placeOverlayOnCanvas` (`midas.js:9420`), `ensureOverlayPlaced` (`midas.js:9403`), tombol di `midas.js:19463` (handler `midas.js:19458`) | Tombol "place" | `actions[M].overlayInstanceId`. Instance yang sudah ditempatkan di canvas |
| 10 | **Feedback motion Play** | `feedbackMotionRows` (`rulesUi.js:127`) | Tidak ada picker. Hanya payload preview | Tidak menyimpan apa pun |

Tidak ditemukan dan perlu dikonfirmasi:
- **Add / Edit drawer**: di kode, "Add row" (`midas.js:2296`) adalah dialog Data window, bukan aksi yang menampilkan component. Kalau yang dimaksud adalah drawer dari Show feedback, itu sudah masuk nomor 1 dengan kind `drawer`.
- **State-bind pickers**: yang dipilih adalah state atau variable (`bindTo`, `Keep in State`), bukan component. Tidak ada component yang ditampilkan, jadi tidak masuk audit ini. Kalau yang dimaksud adalah state yang mengubah mode component, itu bagian dari Appearance (lihat bagian 3).
- **Navigate**: menargetkan frame (`targetFrameId`), bukan component. Di luar audit.

## 2. Yang dipakai untuk menampilkan (sudah ada)

- Preview: `live.js:330` (`componentTarget`), `live.js:1366` (`feedbackComponent`), `live.js:1478` (`changeVariant`), `live.js:1519` (`openLayer`).
- Type mapping: `feedbackStyleOf` (`midas.js:19872`) memilih varian atau mode per level (`success`, `error`, `warning`, `info`). Hanya untuk kind yang punya dimensi type.
- Mode dan varian yang tersedia dari component: `variantProps` (`midas.js:15355`), `variantValues` (`midas.js:15364`), dan collection mode lewat `stateCollectionsOf`.

## 3. Desain: section Appearance bersama

**Bentuk data.** Overrides disimpan di aksi, tidak pernah di master atau di design file:

```
action.appearance = {
  modes:    { [collectionId]: modeId | { stateId } },   // mode per collection yang terikat di component
  variants: { [propName]: value | { stateId } },        // nilai properti varian
  parts:    { [layerId]: boolean | { stateId } },       // (Batch 1) layer opsional
}
```

Kalau `appearance` kosong atau sebuah kunci tidak ada, nilai itu dianggap "Default (as designed)". Nilai yang diikat ke state (`{ stateId }`) dibaca saat runtime, jadi bisa berubah saat aplikasi berjalan.

**Pilihan di picker.** Picker membaca component yang diacu aksi, bukan daftar umum file:
- Untuk instance: pakai mode dan varian yang terikat pada instance itu (instance default yang dirender Midas).
- Untuk component set: pakai properti varian set dan mode dari instance default yang dirender.
- Setiap baris: satu dropdown per collection dan satu per properti varian, dengan "Default (as designed)" di urutan pertama.
- Show feedback menambah pilihan "Follows type" supaya Type mapping tetap mengatur mode ketika tidak ada yang dipin.

**Precedence (dari tertinggi):**
1. Dipin di aksi (`action.appearance`).
2. Type mapping (hanya Show feedback).
3. Mode milik instance itu sendiri.
4. Default (as designed).

**Penerapan.** Preview (`live.js`) dan ghost preview di canvas menerapkan `appearance` di atas mode milik instance. Dua aksi yang menunjuk component yang sama dengan pilihan berbeda harus tampil berbeda, dan pilihan satu aksi tidak boleh mengubah aksi lain.

## 4. Slice berikutnya

- **Slice B**: section Appearance bersama dan penyimpanannya, hanya untuk Show feedback. Diterapkan di Preview dan ghost preview. Cek browser: Alert yang sama dari dua aksi Show feedback dengan dua mode yang dipin berbeda tampil berbeda; Default mengembalikan tampilan desain; mode yang diikat ke state berubah saat runtime.
- **Slice C**: aksi lain dari daftar nomor 3 sampai 8, satu keluarga aksi per commit.
