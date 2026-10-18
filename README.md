# Midas

Design editor (clone Figma di sisi canvas) + Code Builder. Spesifikasi: [docs/specs/development-spec.md](docs/specs/development-spec.md), alur pemakaian: [docs/specs/workflow.md](docs/specs/workflow.md).

## Struktur repo (npm workspaces)

```text
apps/
├── studio/     # Midas Studio (React + Vite): editor canvas, engine di src/engine/midas.js
└── server/     # Midas API (Fastify + Drizzle + Postgres + S3)
packages/
├── cli/        # @midas/cli: login, init, sync, report
└── ui-cms/     # @midas/ui-cms: paket kode library "CMS Design System" (dibuat dengan `midas init`, komponennya ditulis developer)
templates/
└── base-project/   # base project aplikasi (spec §5.2); memakai @midas/ui-cms
scripts/
├── design-system/            # isi design system "CMS": tokens, komponen, ikon, halaman (generator)
├── lib/midas-api.mjs         # klien Midas API untuk script (koneksi, token, simpan dokumen)
├── seed-design-system.mjs    # seed + publish design system CMS di Midas
└── seed-cms-demo.mjs         # file "CMS Demo" (User, Role, Dashboard) + project Code Builder-nya
infra/          # konfigurasi Verdaccio & SeaweedFS untuk docker-compose
docs/specs/     # spesifikasi & workflow
```

## Menjalankan secara lokal

Developer baru: ikuti [docs/setup-lokal.md](docs/setup-lokal.md) (install, akun pertama, login CLI, seed design system).

Butuh Node 22 dan Docker.

```bash
npm install
npm run infra:up                     # Postgres :5433, S3 (SeaweedFS) :8333, Verdaccio :4873
cp apps/server/.env.example apps/server/.env
npm run db:migrate
npm run dev:server                   # API di http://127.0.0.1:4000
npm run dev:studio                   # Studio di http://127.0.0.1:5173 (proxy /api → :4000)
```

Buka Studio, lalu buat akun pertama di layar login (akun pertama selalu diizinkan; akun berikutnya mengikuti `ALLOW_REGISTER`).

Test (API butuh infra jalan):

```bash
npm test --workspace @midas/server
npm test --workspace @midas/cli
npm test --workspace @midas/studio
npm run build --workspace @midas/ui-cms && npm test --workspace @midas/ui-cms
npm run build --workspace @midas/base-project
```

## Design system library → paket frontend

1. Di Studio: file design system → Assets → **Publish as library** (nama paket `@midas/ui-*`, versi, mapping komponen).
2. **Developer kit** di panel yang sama: unduh `.zip` kerangka repo, atau pakai CLI:

```bash
node packages/cli/bin/midas.js login --server http://127.0.0.1:4000
node packages/cli/bin/midas.js init ui-cms --library @midas/ui-cms
cd ui-cms && npx midas sync --version <versi>
```

3. Setelah build: `npx midas report` mengirim status kode tiap komponen (ready / not implemented / mismatch) — tampil di panel Library & dialog Developer kit.
4. `npx midas bundle` (atau `npm run bundle`) membangun bundle ESM + CSS untuk **Live DOM Renderer** Code Builder dan mengunggahnya ke Midas. Data contoh untuk renderer (kolom tabel, menu, handler) diambil dari export `midasPreview` paket.
5. Paket di-publish ke Verdaccio lokal (`http://127.0.0.1:4873/`, scope `@midas`). `@midas/cli` sendiri juga perlu di-publish ke sana sekali (`npm publish` di `packages/cli`) supaya `npm install` di repo paket menemukan devDependency-nya.

## Code Builder

Rail **Code Builder** di Studio (spec §4): buat project untuk file desain yang terbuka (pilih library + versi), tambah **module** (satu page sumber, nama folder kebab-case), pilih frame teratas di canvas lalu **Register frame** dengan role `list` / `create` / `edit` / `view` / `custom`, dan isi **entity fields** untuk module CRUD. Konfigurasi disimpan di server (`/api/builder-projects`).

- Klik nama screen → **Live DOM Renderer**: frame dirender di iframe memakai komponen asli dari bundle library (perlu `midas bundle` untuk versi itu). Klik elemen → **Pilih di canvas**.
- **Issues**: warna hex tanpa Variable, frame tanpa auto layout, shape/gambar bebas, komponen lokal / bagian internal (`_…`) / bukan dari library project, serta konfigurasi yang belum lengkap (module tanpa screen, CRUD tanpa field, frame terhapus, bundle belum diunggah).

Kode: `apps/studio/src/codebuilder/` (`screen.js` pemetaan node → kode & issues, `loader.js` pemuat bundle, `Renderer.jsx`, `Panel.jsx`), `apps/server/src/routes/builder.ts`, `packages/cli/src/bundle.js`.

## Penyimpanan

Sejak backend tersedia, semua data disimpan di server (spec §7):

| Data | Lokasi |
| --- | --- |
| Daftar file + metadata dokumen (pages, tokens, variables) | Postgres `design_files` |
| Isi setiap page (`nodes`) | Postgres `design_file_pages` (satu baris per page) |
| Aset gambar | Object storage S3 (`files/<id>/assets/<assetId>`) + metadata di `assets` |
| State editor per user (file terakhir dibuka, daftar library lama) | Postgres `user_kv` |
| Preferensi tampilan editor (tema, grid, lebar sidebar, plugin) | `localStorage` browser |

- Studio: `apps/studio/src/storage.js` = adapter API dengan bentuk `kv`/`projectStorage` yang sama seperti penyimpanan lama, jadi engine tidak perlu tahu datanya di server.
- Autosave ±1,5 detik setelah perubahan terakhir, hanya page yang berubah. Setiap simpan membawa `version`; bila server punya versi lebih baru → 409 dan user memilih **reload** atau **simpan sebagai salinan**.
- File lama di IndexedDB ditawarkan untuk di-import ke workspace setelah login (`apps/studio/src/legacyStorage.js`).

## Design system CMS, paket kode, dan project demo

Alurnya meniru alur sebenarnya: desainer membuat design system → di-publish sebagai library → developer menulis komponen kodenya → project Code Builder memakai library itu.

```bash
node packages/cli/bin/midas.js login --server http://127.0.0.1:4000
node scripts/seed-design-system.mjs --create     # 1. desain "CMS Design System" + publish @midas/ui-cms (kali berikutnya tanpa --create)
cd packages/ui-cms                               # 2. paket kode (dibuat dengan `midas init`, komponennya ditulis developer)
npm run sync && npm run build && npm test        #    ambil Library Kit, build, test
npx midas report && npm run bundle               #    status kode 18/18 ready + bundle untuk Live DOM Renderer
cd ../.. && node scripts/seed-cms-demo.mjs       # 3. file "CMS Demo" (User, Role, Dashboard) + project Code Builder
npm run dev --workspace @midas/base-project      # base project; login demo: admin / admin123
```

Versi paket kode (`packages/ui-cms/package.json`) harus sama dengan versi library yang dipublish; setelah mempublish versi baru, naikkan versinya lalu `npm run sync`.

`seed-design-system.mjs`: `--create` (buat file baru), `--no-publish` (hanya perbarui file), `--version X.Y.Z`, `--notes TEKS`, `--file NAMA`, `--package @midas/ui-x`. Seed mencari file berdasarkan nama di workspace akun yang login dan berhenti bila tidak ada, kecuali `--create`. Seed berikutnya memakai ulang id komponen, variant, property, Variable, dan ikon, jadi update tidak memutus file yang memakai library.

Design system "CMS" (karakter tegas, rapi, fokus pada data; sidebar gelap, aksen indigo `#4338CA`, font Inter) ditulis sebagai kode di `scripts/design-system/`:

| File | Isi |
| --- | --- |
| `tokens.mjs` | Variables: Color (Light/Dark, termasuk `sidebar`), Radius, Spacing, Typography (`font/family`), skala tipe & elevasi |
| `components.mjs` | 18 komponen (Button, IconButton, Badge, Avatar, Alert, Card, StatCard, TextField, TextAreaField, PasswordField, SelectField, SwitchField, Dialog, Table, Sidebar, PageHeader, FilterToolbar, AppShell) + bagian internal `_SidebarItem`, dengan variant, component property, dan state |
| `icons.mjs` | 27 ikon outline (garis 1,5 px) yang digambar di kotak 24 × 24 |
| `build.mjs` | Builder auto layout mini (frame/row/col/text/icon/instance) → node Midas dengan binding Variables |
| `document.mjs` | Page Cover, Foundations, Icons, dan satu page per komponen dalam folder (Actions, Forms, Feedback, Data Display, Navigation, Layout) |

Komponen berawalan `_` (atau `.`) adalah bagian internal: dirakit komponen lain dan ikut library, tetapi tidak diekspor ke kode dan tidak tampil di Assets file pemakai.

**`seed-cms-demo.mjs`** membuat file desain "CMS Demo" persis seperti Studio membuatnya saat sebuah file memakai library (variabel library disalin bertanda `libId`, komponen disalin ke page `Library · …` dengan `libRef`), berisi 9 layar konten: User (daftar, form, detail), Role (daftar, form, detail), dan Dashboard. Lalu ia mendaftarkan project Code Builder dengan 3 module: `user` dan `role` (CRUD, lengkap dengan field entity) serta `dashboard` (custom). Layar adalah frame konten tanpa sidebar/topbar karena shell aplikasi datang dari base project.

Paket `@midas/ui-cms` tidak bergantung pada router: `Sidebar`/`AppShell` menerima `activePath` dan `onNavigate`, dan `Dialog` tidak memakai portal, sehingga komponen tetap benar saat dirender di iframe Live DOM Renderer.
