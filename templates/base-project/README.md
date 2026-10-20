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

`src/index.css` cukup mengimpor Tailwind dan `shared/ui/library.css`:

```css
@import 'tailwindcss';
@import './shared/ui/library.css';   /* → @import '<paket library>/tailwind.css': font, token tema, utility Tailwind & spacing */
```

Nama paket library hanya tertulis di dua file kecil (`src/shared/ui/index.ts`: `export * from '<paket>'`, dan `src/shared/ui/library.css`) serta `package.json`. Kode lain mengimpor komponen dari `shared/ui`. Code Builder membangkitkan kedua file itu sesuai library yang dipilih di project, jadi mengganti library tidak menyentuh kode lain.

## Modul baru

Modul hasil Code Builder ditulis ke `src/modules/` oleh `midas generate`, dan didaftarkan lewat `src/app/generated/{routes,navigation,locales,layout}` yang diimpor `router.tsx`, `navigation.tsx`, `moduleLocales.ts` dan `ProtectedAppShell.tsx` — file `generated/` dibangkitkan, jangan diedit manual. Lihat `AGENTS.md` untuk pakem struktur.
