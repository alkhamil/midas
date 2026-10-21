# Setup lokal Midas (developer baru)

Panduan dari nol sampai Studio bisa dibuka dan ada akun.
Semua data (akun, file desain, library) disimpan di server lokal masing-masing — tidak ikut Git.

## 1. Prasyarat

- Node.js **22** (`node -v`)
- Docker Desktop (berjalan)
- Git
- Port kosong: `4000` (API), `5173` (Studio), `5433` (Postgres), `8333` (S3/SeaweedFS)

## 2. Ambil kode & buat branch kerja

Kode terbaru ada di `main`. Kerjakan perubahanmu di branch sendiri (contoh di bawah: `feat/fahmi`), jangan langsung di `main`.

Belum pernah clone:

```bash
git clone https://github.com/alkhamil/midas.git
cd midas
git checkout -b feat/fahmi
```

Sudah punya repo-nya:

```bash
git checkout main
git pull origin main
git checkout -b feat/fahmi
```

Push branch pertama kali dengan `git push -u origin feat/fahmi`, lalu buka pull request ke `main` di GitHub.

## 3. Install & infrastruktur

```bash
npm install
npm run infra:up
cp apps/server/.env.example apps/server/.env
npm run db:migrate
```

`infra:up` menyalakan Postgres, S3 (SeaweedFS) lewat Docker. Bucket S3 dibuat otomatis saat API pertama kali jalan.

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

## 6. Menjalankan test

```bash
npm test --workspace @midas/server    # butuh infra jalan
npm test --workspace @midas/studio
```

## 7. Masalah umum

| Gejala | Solusi |
|---|---|
| API tidak bisa konek database | Pastikan Docker Desktop berjalan lalu `npm run infra:up` |
| Studio memanggil API lama | Hentikan proses di port 4000 lalu jalankan ulang `npm run dev:server` |
