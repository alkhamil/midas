# Midas

Design editor (clone Figma di sisi canvas) + Code Builder. Spesifikasi: [docs/specs/development-spec.md](docs/specs/development-spec.md), alur pemakaian: [docs/specs/workflow.md](docs/specs/workflow.md).

## Struktur repo (npm workspaces)

```text
apps/
├── studio/     # Midas Studio (React + Vite): editor canvas, engine di src/engine/midas.js
└── server/     # Midas API (Fastify + Drizzle + Postgres + S3)
packages/
├── cli/        # @midas/cli: login, init, sync, report
└── ui-base/    # @midas/ui-base: library UI pertama (komponen contoh_base_code + ikon & token dari desain)
templates/
└── base-project/   # base project aplikasi (spec §5.2) yang memakai @midas/ui-base
scripts/
└── seed-base-design-system.mjs   # seed + publish design system "Midas Base" di Midas
infra/          # konfigurasi Verdaccio & SeaweedFS untuk docker-compose
docs/specs/     # spesifikasi & workflow
```

## Menjalankan secara lokal

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
npm run build --workspace @midas/ui-base && npm test --workspace @midas/ui-base
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
4. Paket di-publish ke Verdaccio lokal (`http://127.0.0.1:4873/`, scope `@midas`). `@midas/cli` sendiri juga perlu di-publish ke sana sekali (`npm publish` di `packages/cli`) supaya `npm install` di repo paket menemukan devDependency-nya.

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

## Design system Midas Base & base project

```bash
node packages/cli/bin/midas.js login --server http://127.0.0.1:4000
node scripts/seed-base-design-system.mjs          # buat/perbarui file "Midas Base Design System" + publish @midas/ui-base
cd packages/ui-base && npm run sync && npm run build && npx midas report
npm run dev --workspace @midas/base-project        # login demo: admin / admin123
```

`scripts/seed-base-design-system.mjs` membaca ikon WDS dari `contoh_base_code/public/icons/wds` bila ada (`--icons DIR` untuk folder lain).
