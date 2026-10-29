# Paket React dari library

Library yang di-publish di Midas bisa dijadikan **paket npm React**. Desain adalah sumber kodenya: komponen, props, ikon, dan token tema dibangkitkan dari desain, bukan ditulis ulang oleh developer.

```
Desainer: Publish library (Studio)          → snapshot versi tersimpan di server (S3)
Siapa saja: File menu / menu library → "React package…"
Server: snapshot → file paket → bundle esbuild → tarball .tgz   (dibangun saat pertama diminta, lalu disimpan)
Developer: npm install @midas/<nama>      (dari server Midas, lihat "Memasang dari server Midas")
           atau npm install ./midas-<nama>-<versi>.tgz   (file hasil unduhan)
```

## Dialog proses publish

Saat **Publish library**, Studio membuka dialog proses, bukan lagi sekadar pil "Publishing…":

- **Publish library:** mengumpulkan komponen (beserta komponen yang dipakainya), lalu mengunggah versi.
- **React package:** memuat versi, membaca desain, menulis komponen (dengan penghitung), menggambar ikon, membangun token tema, kompilasi JavaScript, kompilasi stylesheet (Tailwind), mengepak tarball, menyimpan. Tiap langkah menampilkan detailnya (jumlah komponen, ukuran).
- **Hal yang perlu ditinjau:** daftar masalah per komponen dan layer, tiap kartu memuat pesan dan **cara memperbaikinya** (misalnya "Bind this colour to a Variable…", "Publish that component too, or detach the instance"). *Error* (komponen gagal dibangkitkan) tampil di atas, lalu *Not generated* (bagian yang tidak bisa jadi kode), lalu *Design tip* (tetap jadi kode, tapi desain bisa dirapikan). Tips yang sama di banyak variant digabung ("6 places").
- **Gagal:** langkah yang berjalan menjadi merah, dan panel menjelaskan **Where / What happened / What to do** (koneksi putus, sesi habis, terlalu besar, server error, atau error kompilasi di komponen tertentu). Library tetap ter-publish bila hanya paketnya yang gagal; tombol **Try again** mengulang bagian yang gagal.

Dialog yang sama dipakai oleh menu **React package…** bila paket belum dibangun.

## Memasang dari server Midas

Server Midas sendiri berfungsi sebagai registry npm (hanya baca), jadi project frontend mengambil paket langsung darinya, tanpa Verdaccio atau server lain.

1. Di Studio buat token di **API tokens** (token yang sama dengan untuk MCP; hanya membaca).
2. Di project frontend, `.npmrc`:

```
@midas:registry=https://<alamat-midas>/api/registry/
//<alamat-midas>/api/registry/:_authToken=mdt_…
```

3. `npm install @midas/web-design-system`

Versi baru muncul setelah **Publish library** (`npm update` untuk mengambilnya). Di CI, taruh token sebagai secret dan tulis `.npmrc` saat build. Unduhan `.tgz` tetap tersedia sebagai cadangan.

## Situs dokumentasi

Setiap library yang di-publish punya situs dokumentasi di server Midas: `/docs/<nama library>` (misalnya `/docs/web-design-system`). Isinya dibuat otomatis dari versi yang di-publish:

- **Getting started:** cara install (`.npmrc` dan `npm install`), cara memakai `tokens.css` dan `styles.css`, dan catatan untuk proyek ber-Tailwind.
- **Versions & release notes:** semua versi dengan tanggal dan catatan rilis. Selektor **Version** di atas halaman membuka dokumentasi versi lama (`?v=<nomor>`).
- **Halaman per komponen:** deskripsi, kategori dan status, tabel props, Do / Don't dan accessibility, diambil dari frame **Documentation** di halaman komponen pada desain (dikirim bersama snapshot saat publish), serta **preview langsung**: komponen dirender dari paket yang sama, dengan kontrol untuk tiap prop, tombol tema gelap, dan contoh kode JSX yang ikut berubah.
- **Icons:** semua ikon dengan namanya.

Siapa yang bisa membuka: anggota workspace yang sudah login selalu bisa. Di dialog **React package** ada pilihan *Anyone with the link can read it* untuk membukanya tanpa login (mati secara default). Paketnya sendiri tetap perlu API token.

## Memakai paket

```tsx
import '@midas/web-design-system/tokens.css';
import '@midas/web-design-system/styles.css';
import { Button, TextField, MagniferIcon } from '@midas/web-design-system';

<Button variant="primary" size="md" label="Save" showLeadingIcon />
<TextField state="error" placeholder="Search" showLeadingIcon leadingIcon={<MagniferIcon size={16} />} />
```

`data-theme="dark"` pada elemen induk mengganti tema (lihat Token di bawah). Peer dependency hanya `react` dan `react-dom` (>=18).

## Tailwind

Komponen ditulis dengan class Tailwind, tetapi **project yang memasang paket tidak perlu Tailwind**: saat paket dibangun, server menjalankan Tailwind dan menyimpan hasilnya di `dist/styles.css`, hanya berisi class yang dipakai komponen.

- Semua class berawalan `mds:` (`mds:flex`, `mds:bg-primary`), jadi tidak bentrok dengan Tailwind milik project.
- Isi `styles.css` ada di `@layer midas`. Di project ber-Tailwind 4, import `styles.css` **sebelum** `tailwindcss` supaya class project (`<Button className="px-6" />`) menang atas gaya komponen. Tailwind 3 tidak memakai layer, jadi utilitasnya selalu menang.
- Warna yang terikat ke token ditulis sebagai warna tema (`mds:bg-primary`); sisanya properti arbitrer (`mds:[gap:12px]`).

Untuk project yang ingin menulis `bg-primary`, `text-muted-foreground`, dan seterusnya dengan warna library:

```css
@import '@midas/web-design-system/styles.css';
@import 'tailwindcss';
@import '@midas/web-design-system/tokens.css';
@import '@midas/web-design-system/tailwind.theme.css';   /* Tailwind 4: hanya warna library */
```

Tailwind 3: `presets: [require('@midas/web-design-system/tailwind.preset')]`. Di kedua kasus palet bawaan Tailwind diganti dengan token library, dan nilainya `var(--theme-…)`, jadi mode dark ikut tanpa perubahan.

## Isi paket

```
package.json        name @midas/<nama library>, version 1.0.<seq>
README.md           komponen dan props-nya
src/                sumber TSX (dibaca developer)
  components/       satu file per komponen, props bertipe, gaya = class Tailwind
  icons/            satu file per ikon + createIcon.ts
  tokens.css
dist/               yang dipasang: index.js (ESM, React tetap peer), .d.ts per komponen,
                    tokens.css, styles.css (hasil kompilasi Tailwind),
                    tailwind.theme.css (v4), tailwind.preset.cjs (v3)
```

Nama paket = `@midas/` + nama library (kebab-case). Setiap publish adalah versi baru: `1.0.<seq>`.

## Dari desain ke kode

| Di desain | Di kode |
| --- | --- |
| Component set (Variant × Size × State …) | satu komponen; tiap properti variant jadi prop `union` (`size: "sm" \| "md"`); Yes/No jadi `boolean` |
| Nilai pertama setiap variant | nilai default prop |
| Component property **text** | prop `string`, default = teks desain |
| Component property **boolean** | prop `boolean` yang menampilkan/menyembunyikan layer |
| Component property **instance swap** | prop `ReactNode` (slot); kosong = instance bawaan desain |
| Instance komponen lain di dalamnya | pemanggilan komponen itu (`<Button variant="outline" …/>`) |
| Komponen vektor kecil (ikon) | komponen SVG (`<ArrowLeftIcon size color />`), menggambar dengan `currentColor` |
| Layer vektor bebas (panah, busur) | `<svg>` inline dengan warna tokennya |
| Variable (token) | `--theme-*` di `tokens.css`; mode pertama = `:root`, mode lain = `[data-theme="<mode>"]` |
| Warna yang terikat Variable | class warna tema (`mds:bg-primary` = `var(--theme-primary)`) |
| Radius, spacing, ukuran | class Tailwind (`mds:[gap:12px]`) |
| Komponen berawalan `_` atau `.` | dibangkitkan untuk dipakai komponen lain, tidak diekspor |

Semua komponen menerima `className`, `style`, `testId`, dan atribut `div` biasa. Penamaan: `Text Field` → `TextField`, prop `Show leading icon` → `showLeadingIcon`, ikon `Outline / Arrows / Arrow Left` → `ArrowLeftIcon`.

## Perilaku

Desain hanya berisi gambar setiap variant. Paket menambahkan lapisan perilaku yang memilih variant yang sesuai dengan apa yang dilakukan pengguna, dan memberi komponen props yang biasa dipakai developer. Semua komponen yang punya properti **State** di desain bereaksi pada pointer dan keyboard (`hover`, `pressed`, `focus`, `disabled`) tanpa kode apa pun, dan menerima `disabled`.

Yang berfungsi penuh (terkendali lewat props, atau memegang state sendiri bila props tidak diberikan):

| Komponen | Props | Perilaku |
| --- | --- | --- |
| Button, Icon Button, Link | `onClick`, `disabled`, `loading` | Enter dan Spasi mengklik; tidak bisa diklik saat disabled atau loading |
| Checkbox | `checked`, `defaultChecked`, `onCheckedChange`, `disabled` | klik atau Spasi mengubah centang; mendukung `"indeterminate"` |
| Radio, RadioGroup | `value`, `onValueChange` (grup), `checked`, `onCheckedChange` | satu pilihan per grup |
| Switch | `checked`, `defaultChecked`, `onCheckedChange` | klik atau Spasi |
| Text Field, Textarea | `value`, `defaultValue`, `onValueChange`, `onChange`, `placeholder`, `invalid`, `disabled`, `readOnly`, `maxLength`, `type` | `<input>` / `<textarea>` sungguhan; tombol hapus bila `clearable`; hitungan karakter bila ada `maxLength` |
| Password Input | `value`, `onValueChange`, `placeholder` | ikon mata menampilkan dan menyembunyikan teks |
| Number Input | `value`, `onValueChange`, `min`, `max`, `step` | tombol minus dan plus, panah atas dan bawah |
| Select | `options`, `value`, `defaultValue`, `onValueChange`, `searchable`, `clearable`, `placeholder` | daftar opsi sungguhan (tidak terpotong induknya), panah, Enter, Esc, pencarian |
| Segmented Control | `value`, `defaultValue`, `onValueChange` | klik atau panah kiri dan kanan |
| Accordion | `open`, `defaultOpen`, `onOpenChange` | klik judul membuka dan menutup |
| Form Item | `children`, `invalid`, `disabled` | label, hint, dan pesan error di sekitar kontrol yang Anda taruh di dalamnya |

Daftar ini ada di halaman dokumentasi tiap komponen (tanda **Interactive**), dengan preview yang bisa diklik. Kodenya ada di `packages/builder-core/src/library-behavior.js`.

## Batasan tahap ini

- **Perilaku datang dari lapisan tersendiri** (`src/behavior/`), bukan dari desain. Tampilan tetap dari desain; lapisan ini menyimpan state dan memilih variant yang cocok. Lihat bagian Perilaku di bawah untuk apa yang sudah berfungsi.
- Komponen yang tidak punya perilaku buatan tetap berupa gambar dari desain (Table, Dialog, Drawer, Tabs, Date Picker, Tooltip, Toast, dan lainnya). Komponen yang punya properti State tetap bereaksi pada hover, tekan, fokus, dan `disabled`.
- Gambar (fill image) belum ikut; layer itu dilaporkan sebagai peringatan di dialog.
- Satu komponen dengan banyak variant menghasilkan file besar (Button 5 × 3 × 4 = 60 variant ≈ 60 KB); bundle akhir tetap kecil setelah gzip dan tree-shaking.
- Registry hanya membaca dan hanya melayani paket `@midas/*` milik workspace token; versi lama muncul di daftar setelah paketnya pernah dibangun.

## API

| Endpoint | Fungsi |
| --- | --- |
| `GET /api/libraries/:id/package?seq=N` | info paket versi `N` (default terbaru): nama, versi, ukuran, komponen + props, ikon, peringatan, `downloadUrl` |
| `GET /docs/<nama>`, `/versions`, `/icons`, `/components/<komponen>` | situs dokumentasi (`?v=<nomor>` untuk versi lama); `/_/styles.css`, `/_/tokens.css`, `/_/preview.js` untuk isi paketnya |
| `GET` / `PUT /api/libraries/:id/docs` | membaca dan mengubah apakah dokumentasi terbuka untuk siapa pun yang punya link (`{ "public": true }`) |
| `GET /api/registry/@midas%2f<nama>` | registry npm: daftar versi paket (butuh token `Authorization: Bearer mdt_…`) |
| `GET /api/registry/@midas/<nama>/-/<file>.tgz` | tarball satu versi, alamat yang diberikan daftar di atas |
| `GET /api/libraries/:id/package.tgz?seq=N` | tarball (`npm install ./file.tgz`) |
| `GET /api/libraries/:id/package/build?seq=N` | membangun (atau mengambil) paket sambil mengalirkan kejadian, satu JSON per baris (NDJSON): `step` (id, label, status, detail, current/total), `issue`, lalu `done` atau `error` (step, message, fix, where) |

Hasil build disimpan di S3 di samping snapshot (`libraries/<id>/<seq>.pkg<GENERATOR_VERSION>.tgz|json`). Naikkan `GENERATOR_VERSION` di `apps/server/src/lib/package.ts` saat generator atau bentuk info berubah, supaya paket lama dibangun ulang. Unpublish library ikut menghapus paketnya.

## Kode

- `packages/builder-core/src/library-package.js` — `libraryPackage(snapshot, opts)`: props, ikon, token, kerangka paket (murni, tanpa I/O).
- `packages/builder-core/src/icon-svg.js` — vektor bezier → bagian SVG.
- `packages/builder-core/src/component-codegen.js` — satu komponen dari node desain.
- `apps/server/src/routes/registry.ts` — registry npm bawaan.
- `packages/builder-core/src/tailwind.js` — style → class Tailwind, tema dan preset dari token.
- `apps/server/src/lib/docs-site.ts` dan `apps/server/src/routes/docs.ts` — situs dokumentasi.
- `apps/server/src/lib/package.ts` — bundle esbuild (dari memori), kompilasi Tailwind (`@tailwindcss/node`) dan tarball.
- `apps/studio/src/engine/midas.js` — `libPackageDialog`.

## Deploy

Server memakai Node 26 (LTS terbaru; `.nvmrc`, `engines` dan image Docker). Server sekarang memakai `@midas/builder-core`, `esbuild`, dan Tailwind (`@tailwindcss/node`) saat berjalan, jadi `Dockerfile` dan `Dockerfile.coolify` ikut menyalin `packages/builder-core` ke image runtime.
