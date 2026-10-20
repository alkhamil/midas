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

## Tahap 4 — Ambil kode dan jalankan (developer)

Pilih salah satu:

1. **Download project (.zip)** di dialog *Generate code*: app lengkap (base project + module hasil generate + paket library di `vendor/`). Cukup `npm install && npm run dev`, tanpa login registry. Paketnya sudah dibuat otomatis saat publish, jadi tidak ada syarat tambahan.
2. **CLI untuk app yang sudah ada**: `npx midas generate "<project>" --out .` (`--list` melihat project, `--dry-run` hanya daftar file). Aman diulang: hanya file hasil generate yang ditimpa dan kode tulisan tangan tidak disentuh.

Hasilnya mencakup halaman per layar, hook dan mock API, i18n, rute, navigasi, dan judul/breadcrumb. Data masih mock (`USE_MOCK` di `api/mock.ts`) sampai endpoint backend dihubungkan.

**Nama paket library hanya tertulis di `src/shared/ui` dan `package.json`**; kode lain mengimpor komponen dari `shared/ui`. Berpindah library berarti memilih library lain di project lalu generate ulang; Midas menulis ulang `shared/ui` dan menyamakan dependensi.

**Komponen custom:** `npx midas extract <Komponen>` menyalin source komponen library ke `src/shared/components/custom` (beserta helper dan tipe props yang dibutuhkan). Setelah itu app mengimpor salinan itu dan salinan tidak lagi mengikuti update library. File yang sudah ada tidak ditimpa tanpa `--force`. Paket buatan Midas selalu membawa `src/`.

---

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
