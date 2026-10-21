# Deploy gratis: 1 service + Neon + Cloudflare R2

Midas di-deploy sebagai **satu service**: server Fastify juga menyajikan hasil build Studio, jadi Studio dan API satu origin
(cookie sesi langsung berfungsi, tanpa CORS). Di luar service itu hanya perlu Postgres dan bucket S3.

| Komponen | Layanan gratis | Catatan |
|---|---|---|
| Server + Studio | **Render** (Docker, plan Free) | Tidur setelah ±15 menit idle; request pertama 30–60 dtk. |
| Postgres | **Neon** | 0,5 GB. |
| Object storage | **Cloudflare R2** | 10 GB, tanpa biaya egress. |

Alternatif service: Koyeb atau Fly.io (juga membaca `Dockerfile`). Variabel lingkungannya sama.

## 1. Neon (database)
1. Buat project di <https://neon.tech>, salin **connection string** (pilih yang berakhiran `?sslmode=require`).
2. Itu nilai `DATABASE_URL`. Migrasi berjalan otomatis saat server start (`AUTO_MIGRATE=true` di Dockerfile).

## 2. Cloudflare R2 (bucket)
1. Cloudflare dashboard → **R2** → *Create bucket* bernama `midas`.
2. **Manage R2 API Tokens** → buat token *Object Read & Write* untuk bucket itu. Catat *Access Key ID*, *Secret Access Key*,
   dan endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
3. Server tidak membuat bucket sendiri di R2 (token biasanya tidak boleh); bucket harus sudah ada.

## 3. Render (server + Studio)
1. Push repo ke GitHub. Di Render: **New → Blueprint**, pilih repo ini (membaca `render.yaml`), atau **New → Web Service**
   dengan runtime *Docker*.
2. Isi variabel:

| Variabel | Nilai |
|---|---|
| `DATABASE_URL` | connection string Neon |
| `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `S3_REGION` | `auto` |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | dari token R2 |
| `S3_BUCKET` | `midas` |
| `ALLOW_REGISTER` | `true` dulu; ubah ke `false` setelah akun Anda dibuat |
| `BODY_LIMIT_MB` | `100` (instance gratis hanya 512 MB RAM) |

   `COOKIE_SECURE=true`, `HOST=0.0.0.0` dan `AUTO_MIGRATE=true` sudah diatur di Dockerfile.
3. Deploy. Buka `https://<nama-service>.onrender.com`, buat akun (akun pertama selalu boleh), lalu set `ALLOW_REGISTER=false`.

## Menjalankan image secara lokal
```bash
docker build -t midas .
docker run --rm -p 4000:4000 \
  -e DATABASE_URL=postgres://midas:midas@host.docker.internal:5433/midas \
  -e S3_ENDPOINT=http://host.docker.internal:8333 -e S3_ACCESS_KEY=midas -e S3_SECRET_KEY=midas-secret \
  -e COOKIE_SECURE=false midas
```

## Catatan
- Server hanya berisi proses Node; data ada di Neon dan R2, jadi service boleh tidur atau di-redeploy kapan saja.
- Plan gratis Render tidur saat idle. Untuk menjaganya tetap hangat, buat monitor (mis. UptimeRobot) ke `/api/health`.
- Variabel lingkungan lain (`LOG_LEVEL`, `STUDIO_DIST`) ada di `apps/server/.env.example`.
