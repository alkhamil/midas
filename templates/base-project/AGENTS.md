# AGENTS.md

Aturan project untuk coding agent (dan developer) di project hasil Midas.

## Project

- Stack: React 19 + TypeScript + Vite + Tailwind CSS 4 + TanStack Query + React Hook Form + react-router 7 + i18next. Package manager: npm.
- Komponen UI, layout, ikon, dan token tema berasal dari library design system (paket `@midas/ui-*` yang dipilih untuk project; namanya hanya tertulis di `src/shared/ui/index.ts`, `src/shared/ui/library.css`, dan `package.json`). Import komponen, ikon, dan tema dari `shared/ui`, **bukan** langsung dari nama paket. **Jangan** menyalin komponen UI ke project dan **jangan** memakai paket ikon pihak ketiga.
- Mesin form (`FormGroup`, `FormItem`, `FormArray`, `FormDefaultValuesWatcher`) ada di `src/shared/components/form`.

## Struktur

- `src/app/` — `router.tsx`, `navigation.tsx`, `moduleLocales.ts`, `ProtectedAppShell.tsx`, `providers/` (auth, guard), dan `generated/` (`routes.tsx`, `navigation.tsx`, `locales.ts`, `layout.ts` — **dibangkitkan Code Builder, jangan diedit manual**; menu & route module baru ditambahkan di sana lewat `midas generate`).
- `src/modules/<modul>/` — satu folder per modul bisnis: `pages/`, `components/`, `api/` (service + mock + resolver + queries/mutations), `hooks/`, `types/`, `validation/`, `i18n/`, `permissions.ts`. Parent-child: `src/modules/<parent>/<child>/`.
- `src/shared/` — tipis: `components/form`, `lib` (axios, queryClient), `hooks`, `utils`, `types`, `constants`, `i18n`.

## Aturan

- Arah dependensi: `modules` → `shared` / library. `shared` tidak import dari `modules`.
- Warna, radius, spacing hanya dari token (`bg-primary`, `text-muted-foreground`, `.page-padding`, `.stack-gap`, `.field-gap`); dilarang hardcode hex.
- Semua teks lewat i18n (en + id); setiap elemen penting punya `testId` / `data-testid` berpola `<modul>-<elemen>`.
- Data lewat `api/resolver.ts` (saklar `USE_MOCK` per aksi) supaya halaman tidak tahu sumbernya mock atau API real.
- Setelah perubahan: `npm run typecheck` dan `npm run build`.
