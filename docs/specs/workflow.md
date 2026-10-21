# Workflow End-to-End Midas

> **Catatan:** dokumen ini adalah spesifikasi awal. Bagian publish library sebagai paket frontend, Code Builder, dan CLI sudah dihapus dari Midas; lihat [docs/workflow.md](../workflow.md) untuk kondisi saat ini.


Dokumen ini menjelaskan cara Midas dipakai setelah [development-spec.md](./development-spec.md) selesai diimplementasikan: dari membuat design system sampai project hasil generate berjalan.

---

## Peran

| Peran | Pekerjaan di Midas |
| --- | --- |
| **Desainer DS** (UI/UX design system) | Membuat dan publish design system |
| **Developer Library** | Menulis kode komponen untuk paket `@midas/ui-*` |
| **Desainer Produk** | Mendesain halaman aplikasi memakai library |
| **Builder** (desainer/dev/PM) | Mengatur halaman di Code Builder lalu Generate |
| **Developer Project** | Melanjutkan project hasil generate (API real, logika khusus) |

---

## Alur 0 — Masuk Midas

1. User login, lalu masuk ke **Workspace**.
2. Kalau browser masih punya file lama di IndexedDB, muncul dialog *"Ditemukan N file lokal — import ke workspace?"*. Setelah di-import, file tersimpan di server (spec §7.7).
3. Semua file tersimpan di server. Indikator di top bar: *Saving… / Saved / Offline — changes pending* (spec §7.6).

## Alur 1 — Membuat dan publish Design System (Desainer DS)

1. Buat file baru, misalnya **"CMS Design System"**.
2. Susun Pages: `Foundations`, `Buttons`, `Forms`, `Table`, `Layout`.
3. Buat **Variables** untuk warna, tipografi, spacing, dan radius.
4. Buat **main component + variants + properties**. Contoh: Button dengan `Type=Primary|Secondary|Destructive|Outline|Ghost`, `Disabled`, `Label`, `Icon`.
5. Klik **Publish Library**, lalu isi form (spec §3.2):
   - Nama library: *CMS Design System*
   - **Nama paket: `@midas/ui-cms`** (tidak bisa diganti setelah publish pertama)
   - Versi `1.0.0` dan catatan rilis
   - Pilih komponen dan cek **Component Mapping** (misalnya `Type=Primary` → `variant="primary"`)
   - Perbaiki peringatan kalau ada, misalnya warna yang tidak memakai Variable
6. Klik **Publish**. Hasilnya:
   - ✅ Library muncul di **Assets → Libraries** untuk semua file Midas di workspace.
   - ✅ **Library Kit** v1.0.0 dibuat otomatis: `theme.ts`, `tokens.css`, tipe props, dan `manifest.json` (spec §3.3).
   - ✅ Kerangka repo `ui-cms` siap diunduh (hanya saat publish pertama, spec §3.4).
   - Status kode: **Pending** (kode komponen belum ada).

## Alur 2 — Membuat kode library (Developer Library)

1. Unduh kerangka repo dari menu Library, lalu push ke Git tim.
2. Ambil Library Kit terbaru ke repo:

   ```bash
   npx @midas/cli sync --library @midas/ui-cms --version 1.0.0
   ```

3. Tulis isi komponen di `src/components/`. Tipe props wajib dari `src/generated/props`.
4. Push ke Git dengan `git tag v1.0.0`. CI lalu menjalankan:
   - lint dan build, lalu membuat **bundle ESM** untuk Studio
   - `npm publish @midas/ui-cms@1.0.0` ke Verdaccio
   - melapor ke Midas API (`POST /api/libraries/:id/versions/1.0.0/code`)
5. Menu Library di Midas menampilkan status setiap komponen (spec §3.5):
   - 🟢 **Ready**: kode ada dan props sesuai
   - 🟡 **Mismatch**: props di kode berbeda dari desain
   - 🔴 **Not implemented**: kode belum ada

   Status library: **ready** (semua komponen siap) atau **partial** (sebagian).

## Alur 3 — Mendesain halaman aplikasi (Desainer Produk)

1. Buat file baru, misalnya **"CMS User Management"**.
2. Di **Assets → Libraries**, aktifkan **CMS Design System v1.0.0**.
3. Buat Page `User` berisi Frame **User List**, **User Form**, dan **User Detail**. Buat juga Page `Dashboard` berisi Frame **Dashboard**.
4. Susun layar memakai **instance komponen library** dan **auto layout**. Warna dan teks memakai Variables.
5. Tidak ada tab Prototype. Alur antar-halaman diatur di Code Builder.

## Alur 4 — Mengatur halaman di Code Builder (Builder)

1. Di left rail, klik **Code Builder** (di bawah Plugins), lalu **New Project**:
   - Nama: *CMS User Management*
   - Library: **`@midas/ui-cms` @ 1.0.0**. Yang bisa dipilih hanya versi yang paket kodenya sudah di-publish.
   - Base project otomatis disiapkan (app shell, auth, router, `.npmrc`).
2. **Add Module**:
   - `user-management` (parent), dengan child `user`, memakai Page `User`. Isi **Entity Fields**: name, email, role, status, beserta tipe, required, sortable, dan filterable.
   - `dashboard` sebagai **custom module**, memakai Page `Dashboard`.
3. **Register Frame + Role** (spec §4.1):
   - User List → `list`, User Form → `create` dan `edit`, User Detail → `view`
   - Dashboard → `custom`
4. Buka setiap layar. Bagian tengah menampilkan **Live DOM** memakai komponen asli `@midas/ui-cms`. Atur di **Inspector** (spec §4.4):
   - **Table:** sumber data entity `user`, kolom, format, pagination, dan row action (view/edit/delete).
   - **Button "Create":** behavior *Navigate to Screen → create*, permission `user.create`.
   - **Form:** pengikatan field, tipe Field, col-span, dan validasi.
   - **Dashboard:** Card statistik dengan Data Source *entity user (count)* atau *custom endpoint* `GET /api/v1/dashboard/summary`.
   - **Teks:** semua jadi kunci i18n, isi terjemahan en/id.
5. Panel **Issues** menampilkan masalah yang harus diperbaiki sebelum Generate (spec §4.6), misalnya:
   - ⚠️ Frame tanpa auto layout
   - ⚠️ Warna hex mentah
   - ⚠️ Komponen yang statusnya *Not implemented*
   - ⚠️ Layar yang belum punya role

   Perbaikannya di tab Design, atau minta Developer Library melengkapi komponennya.
6. Klik **Preview App** untuk mencoba seluruh aplikasi dengan routing nyata dan data mock: login, list, create, kembali ke list, detail, dashboard.
7. Konfigurasi Code Builder otomatis tersimpan ke server.

## Alur 5 — Generate (Builder)

1. Klik **Generate**. Hasil dicek dulu: tidak boleh ada Issue yang menghalangi, dan semua layar harus punya role.
2. Generator di browser menghasilkan project:

   ```text
   src/modules/user-management/user/   ← pola lengkap: api/hooks/components/pages/validation/i18n/permissions
   src/modules/dashboard/              ← custom: pages/components/i18n (+ api/hooks bila ada data source)
   src/app/router.tsx, navigation.tsx  ← route + menu disisipkan lewat penanda
   package.json                        ← "@midas/ui-cms": "1.0.0"
   ```

3. Unduh **.zip**. Push ke Git tersedia di fase lanjut.

## Alur 6 — Melanjutkan project (Developer Project)

1. Ekstrak zip, lalu isi `MIDAS_REGISTRY_TOKEN` dan jalankan `npm install` (paket `@midas/ui-cms` diambil dari Verdaccio).
2. `npm run dev`: aplikasi langsung jalan dengan data mock.
3. Sambungkan ke API real: isi endpoint di `api/service.ts`, lalu ubah `USE_MOCK.<aksi> = false` di `api/mock.ts`.
4. Tambahkan logika khusus sesuai pakem (hooks/components), lalu `npm run lint && npm run build`.

## Alur 7 — Update Design System (siklus berulang)

1. Desainer DS mengubah komponen, misalnya menambah variant `Ghost`, lalu **Publish Library v1.1.0**.
   - File desain yang memakai library mendapat notifikasi **"Update tersedia"**. File tetap di v1.0.0 sampai di-update.
2. Developer Library menjalankan `sync --version 1.1.0`, mengimplementasikan `Ghost`, lalu memberi tag `v1.1.0`. CI publish dan status kembali **Ready**.
3. Builder mengganti versi library project ke **1.1.0** lalu **Generate** ulang. Developer Project cukup mengubah versi di `package.json` dan menjalankan `npm install`.
4. Perubahan yang merusak versi lama (komponen/prop dihapus) memaksa versi naik ke **2.0.0**. Project lama tetap aman di versi sebelumnya.

---

## Ringkasan alur

```text
Desainer DS ──Publish Library──► Library (desain) ──► dipakai file Midas lain
      │                              │
      │                              └─► Library Kit ──sync──► Developer Library
      │                                                            │ tag + CI
      │                                                            ▼
      │                                            Verdaccio: @midas/ui-cms@x.y.z
      │                                                            │ status Ready
Desainer Produk ──desain Frame──► Code Builder ◄───────────────────┘
                                       │ role + props + data + behavior
                                       │ Preview App
                                       ▼
                                   Generate ──► .zip project ──► Developer Project
                                                                  npm install → dev → API real
```
