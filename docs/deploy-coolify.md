# Deploy Midas di Coolify

Stack produksi ada di [`docker-compose.coolify.yml`](../docker-compose.coolify.yml): satu container aplikasi
(Fastify yang juga menyajikan hasil build React Studio), Postgres, dan SeaweedFS sebagai S3 internal. Image
dibangun lewat multi-stage [`Dockerfile`](../Dockerfile) — tidak ada `npm run dev` atau source TypeScript di runtime.

## 1. Buat resource

1. Push repo ini ke Git, lalu di Coolify: **New resource → Docker Compose**.
2. Pilih repo dan isi **Compose file** dengan `docker-compose.coolify.yml`.
3. Di tab **Environment Variables**, isi variabel di bawah. Nilai `${VAR:-default}` di compose akan memakai
   env var dari Coolify; default hanya untuk percobaan lokal.
4. Deploy, lalu buka domain aplikasi.

## 2. Variabel yang perlu diisi

| Variabel | Wajib | Contoh / catatan |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | ya | Password database. Gunakan karakter URL-safe (huruf/angka). |
| `POSTGRES_USER` | tidak | Default `midas`. |
| `POSTGRES_DB` | tidak | Default `midas`. |
| `S3_SECRET_KEY` | ya | Secret S3 internal. Samakan dengan yang dipakai app. |
| `S3_ACCESS_KEY` | tidak | Default `midas`. |
| `S3_BUCKET` | tidak | Default `midas`. |
| `MIDAS_PUBLIC_URL` | ya | URL publik, mis. `https://midas.example.com`. Dipakai di scaffold library/CLI. |
| `COOKIE_SECURE` | ya | `true` untuk HTTPS (Coolify default). Set `false` hanya untuk HTTP lokal. |
| `ALLOW_REGISTER` | tidak | `true` sampai akun pertama dibuat, lalu ubah ke `false`. |
| `BODY_LIMIT_MB` | tidak | Default `100`; naikkan bila mengimpor file desain besar. |
| `REGISTRY_URL` | tidak | Default `https://registry.npmjs.org/` (tanpa Verdaccio). |
| `DATABASE_URL` | tidak | Isi untuk memakai Postgres eksternal (Neon/Supabase); mengabaikan variabel `POSTGRES_*`. |
| `S3_ENDPOINT` | tidak | Isi untuk memakai R2/S3 eksternal. |

Jika memakai Postgres/S3 eksternal, hapus service bawaan beserta entri `depends_on`-nya di compose supaya
stack benar-benar hanya menjalankan container aplikasi.

`HOST`, `PORT`, `AUTO_MIGRATE`, `STUDIO_DIST`, dan `TEMPLATES_DIR` sudah diatur di compose/Dockerfile.

## 3. Domain dan port

Service `app` memakai `expose: "4000"`. Di Coolify, buka service `app` → **Domains** dan arahkan domain ke
port **4000**. Coolify menangani TLS; karena itu `COOKIE_SECURE=true`.

## 4. Setelah deploy

1. Buka domain, buat akun pertama (akun pertama selalu diizinkan).
2. Set `ALLOW_REGISTER=false` di Coolify, lalu redeploy.
3. Login CLI ke server publik:

   ```bash
   node packages/cli/bin/midas.js login --server https://midas.example.com
   ```

Data tersimpan di named volume Postgres dan S3 (prefix mengikuti nama project Coolify). Jangan hapus volume saat redeploy.

## Menjalankan stack di lokal

Coolify memakai `expose`. Untuk Docker Compose biasa, buka blok `ports` yang dikomentari di service `app`, lalu:

```bash
MIDAS_PUBLIC_URL=http://localhost:4000 COOKIE_SECURE=false \
  docker compose -f docker-compose.coolify.yml up -d --build
```
