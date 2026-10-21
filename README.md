# Midas

Design editor (clone Figma di sisi canvas). Spesifikasi awal: [docs/specs/development-spec.md](docs/specs/development-spec.md). Alur pemakaian: [docs/workflow.md](docs/workflow.md).

## Struktur repo (npm workspaces)

```text
apps/
├── studio/     # Midas Studio (React + Vite): editor canvas, engine di src/engine/midas.js
└── server/     # Midas API (Fastify + Drizzle + Postgres + S3)
infra/          # konfigurasi SeaweedFS (S3) untuk docker-compose
docs/           # workflow, setup lokal, deploy, spesifikasi
```

Fitur yang sudah dihapus: publish library sebagai paket frontend, Code Builder, dan CLI (`midas`). Library yang tersisa hanya untuk membagikan komponen dan variabel antar file desain di dalam Midas.

## Menjalankan secara lokal

Developer baru: ikuti [docs/setup-lokal.md](docs/setup-lokal.md).

Deploy gratis (Render + Neon + Cloudflare R2): [docs/deploy-gratis.md](docs/deploy-gratis.md).

Deploy di Coolify (satu stack: app + Postgres + S3): [docs/deploy-coolify.md](docs/deploy-coolify.md), compose: [`docker-compose.coolify.yml`](docker-compose.coolify.yml).

Butuh Node 22 dan Docker.

```bash
npm install
npm run infra:up                     # Postgres :5433, S3 (SeaweedFS) :8333
cp apps/server/.env.example apps/server/.env
npm run db:migrate
npm run dev:server                   # API di http://127.0.0.1:4000
npm run dev:studio                   # Studio di http://127.0.0.1:5173 (proxy /api → :4000)
```

Buka Studio, lalu buat akun pertama di layar login (akun pertama selalu diizinkan; akun berikutnya mengikuti `ALLOW_REGISTER`).

Test (API butuh infra jalan):

```bash
npm test --workspace @midas/server
npm test --workspace @midas/studio
```

## Library (komponen bersama)

Di Studio: file desain, lalu Assets, lalu **Publish as library**. Pilih komponen yang dibagikan; tiap publish menjadi versi bernomor (1, 2, 3, ...). File lain di workspace bisa menambahkan library itu (komponen dan variabelnya), dan menerima tombol **Update** saat ada versi baru. Snapshot versi disimpan di object storage (`libraries/<id>/<versi>.json`).

## Penyimpanan

Sejak backend tersedia, semua data disimpan di server (spec §7):

| Data | Lokasi |
| --- | --- |
| Daftar file + metadata dokumen (pages, tokens, variables) | Postgres `design_files` |
| Isi setiap page (`nodes`) | Postgres `design_file_pages` (satu baris per page) |
| Aset gambar | Object storage S3 (`files/<id>/assets/<assetId>`) + metadata di `assets` |
| State editor per user (file terakhir dibuka) | Postgres `user_kv` |
| Preferensi tampilan editor (tema, grid, lebar sidebar, plugin) | `localStorage` browser |

- Studio: `apps/studio/src/storage.js` = adapter API dengan bentuk `kv`/`projectStorage` yang sama seperti penyimpanan lama, jadi engine tidak perlu tahu datanya di server.
- Autosave ±1,5 detik setelah perubahan terakhir, hanya page yang berubah. Setiap simpan membawa `version`; bila server punya versi lebih baru → 409 dan user memilih **reload** atau **simpan sebagai salinan**.
- File lama di IndexedDB ditawarkan untuk di-import ke workspace setelah login (`apps/studio/src/legacyStorage.js`).
