# Setup lokal Midas (developer baru)

Panduan dari nol sampai Studio bisa dibuka, ada akun, dan design system "CMS" beserta project demo-nya sudah ter-seed.
Semua data (akun, file desain, library) disimpan di server lokal masing-masing — tidak ikut Git.

## 1. Prasyarat

- Node.js **22** (`node -v`)
- Docker Desktop (berjalan)
- Git
- Port kosong: `4000` (API), `5173` (Studio), `5433` (Postgres), `8333` (S3/SeaweedFS), `4873` (Verdaccio)

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

## 7. Seed design system dan paket kodenya

```bash
node scripts/seed-design-system.mjs --create
```

Script ini membuat file **CMS Design System** di workspace akunmu (Cover, Foundations, Icons, page per komponen) dan mempublish library `@midas/ui-cms`. Ikon digambar di `scripts/design-system/icons.mjs`, tidak ada berkas yang perlu dibagikan terpisah.

Kode library **dibangun otomatis saat publish**: server memasang token, tipe props, dan ikon library ke kit komponen standar (`packages/ui-standard`), membuat bundle preview dan paket npm, lalu menetapkan status kode. Pastikan kit standar sudah dibangun sekali di mesin Anda (server membacanya dari `packages/ui-standard`):

```bash
npm run build --workspace @midas/ui-standard
```

Statusnya langsung `ready` untuk komponen standar (lihat panel Library atau dialog **Code**). Tidak ada repo kode atau CLI yang perlu disiapkan.

## 8. Project demo untuk menguji Code Builder

```bash
node scripts/seed-cms-demo.mjs
```

Membuat file **CMS Demo** (layar User, Role, Dashboard dari komponen library) dan project Code Builder-nya: module `user` dan `role` (CRUD) serta `dashboard` (custom), 9 screen.

## 9. Cek hasil

- Studio → **Recents / All files** → buka *CMS Demo* → rail **Code Builder**: klik nama screen → workspace dengan pratinjau + Properties Inspector. Klik komponen di pratinjau untuk mengatur propertinya; klik sidebar/topbar untuk mengatur layout aplikasi.
- Base project (aplikasi contoh yang memakai kit standar `@midas/ui-standard`):

  ```bash
  npm run dev --workspace @midas/base-project
  ```

  Login demo: `admin` / `admin123`.
- Paket UI:

  ```bash
  npm run build --workspace @midas/ui-standard
  npm test --workspace @midas/ui-standard
  ```

## 10. Test lainnya (infra harus jalan)

```bash
npm test --workspace @midas/server
npm test --workspace @midas/cli
npm test --workspace @midas/studio
npm run build --workspace @midas/base-project
```

## Masalah umum

| Gejala | Penyebab / solusi |
| --- | --- |
| `Email atau password salah` saat `midas login` | Email/password tidak cocok dengan akun di Studio, atau password kurang dari 8 karakter. Ketik password langsung di terminal. |
| `File "CMS Design System" tidak ada di workspace …` | Seed belum pernah dijalankan untuk akun ini — tambahkan `--create`. |
| `Library @midas/ui-cms tidak ditemukan` saat `seed-cms-demo.mjs` | Library belum dipublish di workspace akun ini — jalankan `seed-design-system.mjs` dulu. |
| Code Builder: "Route … not found" | Yang melayani port 4000 adalah build server lama. Hentikan lalu jalankan `npm run dev:server` (atau build ulang lalu start). |
| `npm run db:migrate` gagal koneksi | Docker belum jalan atau port `5433` dipakai aplikasi lain; cek `docker compose ps`. |
| Studio kosong / 401 terus | API (`npm run dev:server`) belum jalan, atau sesi habis — login ulang. |
| Port bentrok | Hentikan proses lain di port tersebut atau ubah `PORT` di `apps/server/.env` dan port Docker di `docker-compose.yml`. |

## 10. Mengambil source code hasil Code Builder

Di Studio, **Generate kode…** menampilkan perintah untuk project itu. Di repo aplikasi (salinan `templates/base-project`):

```bash
npx midas login --server http://127.0.0.1:4000     # sekali
npx midas generate --list                           # daftar project di workspace
npx midas generate "CMS Demo" --out .               # tulis module + route + menu + locale ke repo aplikasi
npm install && npm run dev
```

Opsi: `--dry-run` (hanya daftar file), atau **Unduh .zip** di dialog Generate. Generate ulang aman: hanya file hasil generate yang ditimpa/dihapus.
