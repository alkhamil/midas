# Workflow Midas: dari design system sampai aplikasi jalan

Ada **tiga tahap** yang dikerjakan orang. Kode komponen **tidak ditulis developer**: Midas membangunnya sendiri saat library di-publish.

```
 DESAINER (Studio)               MIDAS (otomatis)                 DESAINER / PM (Studio)          DEVELOPER (aplikasi)
┌──────────────────┐ publish  ┌──────────────────────────┐ ready ┌─────────────────────┐ hasil ┌──────────────────────┐
│ 1. Design system │ ───────► │ 2. Paket kode dibangun   │ ────► │ 3. Project CMS dan  │ ────► │ 4. Download project, │
│    + Publish     │          │    dari desain           │       │    Code Builder     │       │    jalankan, update  │
└──────────────────┘          └──────────────────────────┘       └─────────────────────┘       └──────────────────────┘
```

| Tahap | Siapa | Alat | Hasil |
|---|---|---|---|
| 1. Design system dan publish | Desainer | Studio | Library terpublish |
| 2. Paket kode | **Midas (otomatis)** | server | Status kode `ready`, bundle preview, paket npm |
| 3. Project CMS dan Code Builder | Desainer / PM | Studio | Module, layar, layout, validasi |
| 4. Kode aplikasi | Developer | Download project atau `midas generate` | App yang jalan |

---

## Tahap 1 — Design system dan Publish (Studio)

1. Buat file desain berisi **komponen** (dengan variant dan component property), **ikon**, dan **variabel** (warna, radius, dst).
   - Ikon: letakkan di page bernama **Icons**, atau beri nama komponen `Icon/<kategori>/<nama>`. Ikon dikelompokkan per kategori.
   - Komponen yang namanya diawali `_` atau `.` adalah **bagian internal** (dipakai komponen lain, tidak diekspor ke kode).
2. Buka **Assets → Publish as library**. Di dialog:
   - **Library name**, **Frontend package** (nama bebas, mis. `@midas/ui-cms`; **terkunci setelah publish pertama**), **Version** (semver) dan **Release notes**.
   - **Apa yang dipublish**: centang komponen satu per satu; ada pencarian, **Select all / none**, dan ikon yang dikelompokkan per kategori dengan checkbox grup. Nama export dan nama prop di kode bisa diubah per komponen.
   - Perubahan yang merusak (komponen atau prop dihapus/berganti nama) meminta versi **major**.
3. Hasil: library terpublish **dan kodenya langsung dibangun** (tahap 2). Toast setelah publish menyebut hasilnya, mis. "Code is ready."

**Hasil publish, disimpan di mana, dipakai bagaimana**

| Hasil | Disimpan di | Dipakai untuk |
|---|---|---|
| Record library + versi (mis. `@midas/ui-cms` 1.0.0) | Postgres (`libraries`, `library_versions`) | Muncul di panel Library; dipilih saat membuat project Code Builder |
| Snapshot desain (komponen, variant, variabel, ikon) | S3/R2 `libraries/<id>/<seq>.json` | Sumber untuk membangun kode dan membaca desain di Code Builder |
| Mapping komponen → kode (nama export, prop, Implementation) | Postgres (`component_mappings`) | Menentukan nama komponen dan prop di kode |

Cara pakai: tidak ada yang perlu diunduh atau dijalankan. Library langsung bisa dipilih di Code Builder, dan file desain lain bisa memakai komponennya.

## Tahap 2 — Paket kode dibangun otomatis (Midas)

**Desain adalah sumber utama.** Untuk setiap komponen yang di-publish, Midas menulis komponen React dari desainnya: auto layout menjadi flex, fill/stroke menjadi gaya yang memakai token tema, teks yang terikat component property menjadi prop, boolean property menjadi tampil/sembunyi, instance di dalamnya menjadi komponen lain, dan ikon menjadi komponen ikon. Komponen apa pun (tidak harus ada di kit standar) jadi kode. Bagian internal (nama diawali `_` atau `.`) ikut dibuat untuk dipakai komponen lain, tapi tidak diekspor.

Desain hanya menggambarkan tampilan statis. Untuk **perilaku** (dropdown, dialog, sidebar bersarang, pagination), Midas membawa **kit komponen standar** (`packages/ui-standard`, 20 komponen) sebagai katalog opsional. Di dialog Publish, tiap komponen punya pilihan **Implementation**:

- **From design**: kode ditulis dari desain (tampilan saja).
- **Standard: \<Nama\>**: memakai perilaku komponen standar itu. Default otomatis bila namanya sama dengan komponen standar.

Saat publish, server:

1. Mengganti lapisan `generated` kit standar dengan milik library: **token tema**, **tipe props**, dan **ikon** dari desain.
2. Menulis/menghubungkan komponen sesuai pilihan Implementation, lalu membundel (esbuild) untuk **preview Studio** dan membuat **paket npm** (`dist` + deklarasi tipe + `src`) yang dipakai **Download project**.
3. Menghitung **status kode** tiap komponen:
   - `ready`: ditulis dari desain, atau komponen standar menangani semua props desain.
   - `mismatch`: desain punya props yang tidak ditangani komponen standar yang dipilih.
   - `not_implemented`: kode dari desain gagal dibuat (placeholder diekspor supaya aplikasi tetap bisa dikompilasi).

Library dianggap `ready` bila semuanya `ready`, dan `partial` bila ada yang lain. Statusnya terlihat di panel Library dan di dialog **Code** (Assets → Library → Code), yang juga punya tombol **Rebuild code**.

Konsekuensinya:
- Warna, radius, font, spasi, dan ikon mengikuti desain, tanpa developer.
- Komponen dari desain berupa markup statis; interaksi hanya ada pada komponen yang memakai implementasi standar.
- **Jalur lanjutan (opsional):** bila butuh perilaku khusus, dialog Code punya bagian *Write the components yourself*: unduh repo kerangka (`midas init`), tulis komponen, lalu `npm run build`. Bundle dari repo itu menggantikan yang otomatis. Untuk mengubah satu komponen di app, pakai `midas extract` (tahap 4).

**Hasil tahap ini, disimpan di mana, dipakai bagaimana**

| Hasil | Disimpan di | Dipakai untuk |
|---|---|---|
| Bundle preview (`index.js`, `style.css`) | S3/R2 `libraries/<id>/bundles/<versi>/` | Studio memakainya untuk preview komponen dan app. Tidak perlu diunduh |
| Paket npm (`package.tgz`: `dist`, tipe, `src`) | S3/R2 `libraries/<id>/packages/<versi>/package.tgz` | Dimasukkan otomatis ke "Download project" (`vendor/`) dan `midas generate` |
| Status kode per komponen | Postgres (`component_mappings`, `library_versions`) | Terlihat di panel Library dan dialog Code |

Cara pakai: desainer cukup melihat status `ready` di toast atau dialog Code. Developer tidak mengambil paket ini langsung; paket ikut terbungkus di project yang diunduh.

## Tahap 3 — Project CMS dan Code Builder (Studio)

1. Buat file desain aplikasi (mis. "CMS Demo") yang **memakai library** itu. Susun satu **page per fitur** (User, Role, Region, ...), berisi frame: `X — List`, `X — Form`, `X — Detail`, dan dialog (`Confirm · Delete X`, `Confirm · Restore X`, `Confirm · Discard changes (X)`), serta `Drawer · Filters` bila ada filter.
2. **Flag page**: klik kanan page di daftar Pages, pilih **Use in Code Builder**. Hanya page ber-flag yang bisa menjadi sumber module. Page bersarang (Master Data lalu Region) menjadi menu induk dan anak (`/master-data/region`).
3. Buka panel **Code Builder** (ikon `</>`), buat project, dan pilih library serta versinya. Library yang baru di-publish langsung bisa dipilih.
4. **New module** (wizard lima langkah):
   1. **Page**: pilih page ber-flag.
   2. **Module**: label dan menu induk (diambil dari susunan page); nama folder dan permission key tersedia di bagian lanjutan.
   3. **Screens**: semua frame page tampil dengan role tebakan dari namanya (List, Create + Edit, View, Dialog, atau Skip). Ubah bila perlu.
   4. **Fields**: field entity dibaca dari form di desain (TextField, SelectField, SwitchField, ...). Ubah nama, tipe, dan rules.
   5. **Review** dan **Create module**.
5. Atur **Layout** (klik sidebar/topbar di preview: nama app, urutan menu, ikon, pengguna) dan **properti komponen** per layar: kolom, header, dan lebar tabel; filter; form (grid 12 kolom, layout horizontal/vertikal); validasi (`required`, `min`, `max`, `email`, `pattern`, tanpa emoji); relasi antar module; aksi tombol; teks dialog konfirmasi (dibaca dari desain).
6. Sidebar dan Topbar yang ikut tergambar di frame halaman **diabaikan** (app shell hasil generate sudah punya sendiri); panel Issues memberi tahu bagian yang dilewati.
7. Tombol ▶ **Preview app** memberi pratinjau yang bisa diklik: navigasi, pencarian, filter, pagination, form tervalidasi, simpan, hapus dan pulihkan, dialog konfirmasi, dan peringatan perubahan belum disimpan.
8. Panel **Issues** menunjukkan yang perlu diperbaiki (library belum dipilih, komponen bukan dari library, CRUD tanpa field, frame hilang).

**Hasil tahap ini, disimpan di mana, dipakai bagaimana**

| Hasil | Disimpan di | Dipakai untuk |
|---|---|---|
| Project Code Builder (module, layar, layout, validasi) | Postgres (`builder_projects`) | Dibuka kembali di Studio; sumber untuk generate |

Cara pakai: tidak ada kode yang dibuat di tahap ini. Kode baru dibuat saat developer mengunduh atau menjalankan generate (tahap 4).

## Tahap 4 — Ambil kode dan jalankan (developer)

Pilih salah satu:

1. **Download project (.zip)** di dialog *Generate code*: app lengkap (base project + module hasil generate + paket library di `vendor/`). Cukup `npm install && npm run dev`, tanpa login registry. Paketnya sudah dibuat otomatis saat publish, jadi tidak ada syarat tambahan.
2. **CLI untuk app yang sudah ada**: `npx midas generate "<project>" --out .` (`--list` melihat project, `--dry-run` hanya daftar file). Aman diulang: hanya file hasil generate yang ditimpa dan kode tulisan tangan tidak disentuh.

Hasilnya mencakup halaman per layar, hook dan mock API, i18n, rute, navigasi, dan judul/breadcrumb. Data masih mock (`USE_MOCK` di `api/mock.ts`) sampai endpoint backend dihubungkan.

**Hasilnya ada di komputer developer, bukan di server.** ZIP dirakit saat diminta dan tidak disimpan. Isinya aplikasi lengkap; library masuk sebagai paket di `vendor/` dan dipakai lewat `src/shared/ui`. Contoh pemakaian di kode developer:

```ts
import { AppShell, Button } from '../shared/ui';   // komponen dari library
```

Update library: desainer publish versi baru, di Code Builder pilih versi baru, developer mengunduh atau menjalankan `midas generate` lagi. Hanya file hasil generate yang ditimpa.

**Nama paket library hanya tertulis di `src/shared/ui` dan `package.json`**; kode lain mengimpor komponen dari `shared/ui`. Berpindah library berarti memilih library lain di project lalu generate ulang; Midas menulis ulang `shared/ui` dan menyamakan dependensi.

**Komponen custom:** `npx midas extract <Komponen>` menyalin source komponen library ke `src/shared/components/custom` (beserta helper dan tipe props yang dibutuhkan). Setelah itu app mengimpor salinan itu dan salinan tidak lagi mengikuti update library. File yang sudah ada tidak ditimpa tanpa `--force`. Paket buatan Midas selalu membawa `src/`.

---

## Disimpan di mana

Midas hanya menyimpan data di dua tempat: **Postgres** (data terstruktur) dan **object storage S3/R2** (berkas besar). Server sendiri tidak menyimpan apa pun, jadi boleh di-redeploy kapan saja.

| Apa | Tempat | Rinci |
|---|---|---|
| File desain, folder, page | Postgres | tabel `design_files`, `design_folders`, `design_file_pages` |
| Gambar yang dipakai desain | S3/R2 + Postgres | berkas di bucket, metadata di tabel `assets` |
| Library (nama, nama paket, versi) | Postgres | tabel `libraries`, `library_versions` (status kode, URL bundle) |
| **Snapshot** desain yang di-publish (node komponen, variabel, ikon) | S3/R2 | `libraries/<id>/<seq>.json`; tabel `library_versions` hanya menyimpan kuncinya |
| Mapping komponen → kode (nama export, prop, **Implementation**, status per komponen) | Postgres | tabel `component_mappings` (kolom `props_map` jsonb) |
| **Bundle preview** (dipakai Studio) | S3/R2 | `libraries/<id>/bundles/<versi>/index.js` dan `style.css` |
| **Paket npm** hasil build otomatis | S3/R2 | `libraries/<id>/packages/<versi>/package.tgz` |
| File yang dipakai file desain lain | Postgres | tabel `file_libraries` |
| Project Code Builder (module, layar, layout, validasi) | Postgres | tabel `builder_projects` (kolom `config` jsonb) |
| Akun, sesi, workspace | Postgres | `users`, `sessions`, `workspaces`, `workspace_members` |

Sisi pengguna:
- **Download project (.zip)**: dirakit saat diminta, tidak disimpan. Isinya base project, kode hasil generate, dan paket library di `vendor/`.
- **Developer**: kode ada di repositori mereka sendiri. Nama paket library hanya tertulis di `package.json` dan `src/shared/ui`. Komponen hasil `midas extract` ada di `src/shared/components/custom`.
- **CLI**: token login di `~/.midas/config.json` pada komputer masing-masing.
- **Kode sumber Midas**: komponen standar (`packages/ui-standard`) dan generator (`packages/builder-core`) ada di repo ini, ikut masuk image Docker. Repo ini tidak berisi kode library hasil publish.

## Siklus perubahan

| Yang berubah | Langkah |
|---|---|
| Warna, radius, font, ikon, teks default | Desainer publish versi baru. Kode otomatis dibangun ulang. Di Code Builder pilih versi baru lalu generate ulang. |
| Varian atau prop baru | Publish versi baru. Komponen dari desain ikut berubah; untuk yang memakai komponen standar, cek status (`mismatch` bila belum ditangani). |
| Komponen baru | Publish. Kodenya otomatis ditulis dari desain; pilih Implementation "Standard: ..." bila butuh perilaku. |
| Layar atau field baru | Ubah desain, flag page bila baru, tambah module atau frame di Code Builder, generate ulang. |
| Library diganti | Pilih library lain di project, generate ulang. |

## Status dan masalah umum

| Gejala | Artinya | Solusi |
|---|---|---|
| Library `code partial` | Ada komponen `not_implemented` atau `mismatch` | Buka dialog Code untuk melihat rinciannya |
| `Code could not be built` setelah publish | Build server gagal (pesan ada di toast) | Coba **Rebuild code**; bila tetap gagal, kirim pesan galatnya |
| Komponen `mismatch` | Desain punya props yang tidak ditangani implementasi standar | Hapus prop itu dari desain atau gunakan jalur lanjutan |
| Komponen "from another library" di Issues | Frame memakai komponen yang bukan dari library project | Pakai komponen library yang dipilih |
| Dua sidebar | Frame halaman membawa sidebar sendiri | Sudah ditangani otomatis; cek Issues |

## Jalan pintas untuk pengembangan Midas

Skrip seed membuat data contoh tanpa mengklik: `node scripts/seed-design-system.mjs --create` (opsi: `--package`, `--version`/`--bump`, `--only`, `--exclude`, `--icons`, `--no-publish`) dan `node scripts/seed-cms-demo.mjs` (opsi: `--modules`, `--package`, `--no-project`). Detailnya ada di README. Kit komponen standar dibangun dengan `npm run build --workspace @midas/ui-standard` (dijalankan juga oleh `Dockerfile`).
