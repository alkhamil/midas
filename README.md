# Midas

Design editor (clone Figma di sisi canvas) + Code Builder. Spesifikasi: [docs/specs/development-spec.md](docs/specs/development-spec.md), alur pemakaian: [docs/specs/workflow.md](docs/specs/workflow.md).

## Struktur repo (npm workspaces)

```text
apps/
├── studio/     # Midas Studio (React + Vite): editor canvas, engine di src/engine/midas.js
└── server/     # Midas API (Fastify + Drizzle + Postgres + S3)
packages/       # paket bersama (CLI, library UI) — fase berikutnya
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

Test API (butuh infra jalan):

```bash
npm test --workspace @midas/server
```

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
