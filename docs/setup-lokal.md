# Setup lokal Midas (developer baru)

Panduan dari nol sampai Studio bisa dibuka, ada akun, dan design system "Midas Base" sudah ter-seed.
Semua data (akun, file desain, library) disimpan di server lokal masing-masing — tidak ikut Git.

## 1. Prasyarat

- Node.js **22** (`node -v`)
- Docker Desktop (berjalan)
- Git
- Port kosong: `4000` (API), `5173` (Studio), `5433` (Postgres), `8333` (S3/SeaweedFS), `4873` (Verdaccio)

## 2. Ambil kode

Belum pernah clone:

```bash
git clone https://github.com/alkhamil/midas.git
cd midas
git checkout feat/backend-foundation
```

Sudah punya repo-nya:

```bash
git fetch origin
git checkout feat/backend-foundation
git pull
```

## 3. Install & infrastruktur

```bash
npm install
npm run infra:up
cp apps/server/.env.example apps/server/.env
npm run db:migrate
```

`infra:up` menyalakan Postgres, S3 (SeaweedFS) dan Verdaccio lewat Docker. Bucket S3 dibuat otomatis saat API pertama kali jalan.

## 4. Jalankan API & Studio

Dua terminal terpisah:

```bash
npm run dev:server
```

```bash
npm run dev:studio
```

Buka http://127.0.0.1:5173.

## 5. Buat akun

Database masih kosong, jadi belum ada akun. Di layar login Studio klik **New here? Create an account**, isi Name, Email dan Password (minimal 8 karakter), lalu **Create account**. Akun pertama selalu diizinkan; akun berikutnya mengikuti `ALLOW_REGISTER` di `apps/server/.env`.

## 6. Login CLI

Script seed dan `midas` CLI memakai token akun yang sama. Jalankan langsung di terminal (password diketik tidak terlihat):

```bash
node packages/cli/bin/midas.js login --server http://127.0.0.1:4000 --email EMAIL_KAMU
```

Berhasil bila muncul `Login sebagai … <EMAIL_KAMU>`. Token disimpan di `~/.midas/config.json`.

## 7. Ikon WDS (opsional tapi disarankan)

Set ikon WDS ada di folder `contoh_base_code/` yang **tidak ada di Git**. Minta folder itu ke pemilik repo dan taruh di root repo, sehingga ada `contoh_base_code/public/icons/wds/`.
Tanpa folder ini seed tetap jalan, tetapi library hanya berisi 20 ikon UI bawaan (seed memberi peringatan).

## 8. Seed design system "Midas Base"

```bash
node scripts/seed-base-design-system.mjs --create
```

Script ini:

- membuat file **Midas Base Design System** di workspace akunmu (Cover, Foundations, Icons, page per komponen, Templates);
- publish library `@midas/ui-base` dengan versi yang sama dengan `packages/ui-base/package.json`.

Jalankan ulang tanpa `--create` untuk memperbarui file yang sudah ada (id komponen dipertahankan, versi naik otomatis).

## 9. Cek hasil

- Studio → **Recents / All files** → buka *Midas Base Design System*.
- Base project (aplikasi contoh yang memakai `@midas/ui-base`):

  ```bash
  npm run dev --workspace @midas/base-project
  ```

  Login demo: `admin` / `admin123`.
- Paket UI:

  ```bash
  npm run build --workspace @midas/ui-base
  npm test --workspace @midas/ui-base
  ```

> Jangan jalankan `midas sync` di `packages/ui-base` bila folder ikon WDS tidak ada: sync menulis ulang `src/generated/` dari library di servermu, sehingga ikon WDS akan terhapus dari kode.

## 10. Test lainnya (infra harus jalan)

```bash
npm test --workspace @midas/server
npm test --workspace @midas/cli
npm run build --workspace @midas/base-project
```

## Masalah umum

| Gejala | Penyebab / solusi |
| --- | --- |
| `Email atau password salah` saat `midas login` | Email/password tidak cocok dengan akun di Studio, atau password kurang dari 8 karakter. Ketik password langsung di terminal. |
| `File "Midas Base Design System" tidak ada di workspace …` | Seed belum pernah dijalankan untuk akun ini — tambahkan `--create`. |
| `npm run db:migrate` gagal koneksi | Docker belum jalan atau port `5433` dipakai aplikasi lain; cek `docker compose ps`. |
| Studio kosong / 401 terus | API (`npm run dev:server`) belum jalan, atau sesi habis — login ulang. |
| Port bentrok | Hentikan proses lain di port tersebut atau ubah `PORT` di `apps/server/.env` dan port Docker di `docker-compose.yml`. |
