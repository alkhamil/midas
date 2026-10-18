# Base project Midas

Kerangka aplikasi yang dipakai Midas Code Builder untuk project baru (spec §5.2): shell aplikasi (router, navigasi, auth mock, guard permission), modul `auth/login` + `dashboard`, dan `shared/` tipis. Komponen UI dari library design system (saat ini `@midas/ui-cms`).

## Menjalankan

```bash
cp .env.example .env
MIDAS_REGISTRY_TOKEN=... npm install     # @midas/* dari Midas Registry (lihat .npmrc)
npm run dev
```

Login demo (mock): `admin` / `admin123`.

## Styling

`src/index.css` cukup:

```css
@import 'tailwindcss';
@import '@midas/ui-cms/tailwind.css';   /* font, token tema, utility Tailwind & utilitas spacing library */
```

## Modul baru

Modul hasil Code Builder ditulis ke `src/modules/` dan didaftarkan otomatis di `src/app/router.tsx` & `src/app/navigation.tsx` lewat anchor `__GENERATOR_*`. Lihat `AGENTS.md` untuk pakem struktur.
