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

## 5. Login

Tidak ada pendaftaran. Saat server start, **seeder** membuat akun administrator (`admin@midas.local` / `admin12345`, atur lewat `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` di `apps/server/.env`). Login dengan akun itu, lalu buat akun lain di **Home → Users**. Ganti password lewat menu avatar → Change password.

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
| Import / request balas **503** `api_unavailable` | API belum listen (migrasi, seed, dan cek bucket jalan dulu, ±beberapa detik) atau sudah mati. Tunggu lalu coba lagi; cek jendela server untuk error |
| Request balas **500** tanpa pesan | Error di server: lihat log API, baris `request failed` / `server error response` menyebut route dan error-nya |
| Proses studio mati dengan kode `3221226505` (0xC0000409) | Fast-fail native di proses Node/Vite (bukan exception JS, tidak ada baris di log). Terjadi setelah sesi HMR panjang. Jalankan ulang lewat `preview_start`/`npm run dev:studio`. Tidak ada crash report di Event Viewer, jadi penyebab pastinya belum diketahui. Diperiksa (Phase 5 smoke): 500 event Application terbaru (14 hari) tidak memuat 0xC0000409, jadi proses yang keluar tidak bisa dipastikan dari log. Jalur WebGPU/mask berjalan di browser, bukan di proses dev server, jadi tidak terkait langsung. Tidak direproduksi dengan file besar. Workaround: jalankan ulang; kalau berulang, catat jam dan langkah terakhir. |
| Server dihentikan tiba-tiba oleh tool preview | Proses yang dijalankan dari tool preview ikut berhenti saat sesi berganti; jalankan ulang dengan `preview_start` |

Catatan: file `.midas` besar (mis. `scripts/ant-design/Ant Design.midas`, ±6,7 MB) tidak berada di folder yang dipantau Vite dan tidak dibaca server saat start. Ia bukan penyebab mati-nya proses.
