# AGENTS.md

Muse Code reads this file as project rules when it runs in this directory.

## Project

- Name: generator-module-app
- Stack: React 19 + TypeScript + Vite + Tailwind CSS 4 + TanStack Query +
  React Hook Form + react-router 7. Package manager: npm.
- Frontend mock-only: tanpa backend, tanpa database. Semua data (definisi
  modul, records, auth) dari mock store: seed JSON + localStorage.
- App ini adalah **dynamic module platform**: modul bisnis
  (users, orders, mater-data/*, …) didefinisikan sebagai data
  `ModuleDefinition v1` (bukan folder kode di `src/modules/`), disimpan
  di mock store, dan di-render generik saat runtime. Wizard `/generator`
  membuat definisi lewat publish (Draft/Publish), bukan dengan menulis
  file.

## Skills (baca sebelum bekerja di area terkait)

- `frontend-conventions` — token thema, spacing semantik, layout single-app,
  shared components, auth guard. Wajib untuk semua perubahan UI.
- `module-generator` — wizard generator 6 langkah (config → form
  canvas → test data → list canvas → detail canvas → review), `builder/`,
  `ModuleDefinition v1`, runtime render (routes/nav dinamis), bulk/export
  `.xlsx`, contract JSON.
- `crud-module` — pola modul CRUD dinamis: bentuk definisi, runtime generik
  (`Dynamic*`), mock store records, seeds.

## Common Commands

- Dev: `npm run dev` (Node 22, lihat `nvm use 22`)
- Build: `npm run build` (typecheck `tsc -b` + `vite build`)
- Lint: `npm run lint` (oxlint atas `src`, `vite.config.ts`)
- Preview: `npm run preview`

## Project Layout

- `src/app/` — `navigation.tsx` (nav statis: Dashboard/Generator/Component
  + `useDynamicNavItems` dari definisi), `router.tsx` (routes statis +
  `DynamicModuleRoutes` + `preview/:definitionKey`),
  `ProtectedAppShell.tsx` (shell + session user).
- `src/app/providers/` — session auth (`AuthProvider` + `useAuth`) + guard
  (`RequireAuth`, `PermissionGate`), mirror `boilerplate-fe`.
- `src/modules/` — `auth/` (hanya modul `login/`: `api/` service/mock/
  resolver + `pages/` + `components/` + `hooks/` + `types/`), `dashboard/`
  (halaman Dashboard), `showcase/` (dokumentasi shared components), dan
  `generator/` (`definitions/` = `ModuleDefinition v1` murni + Node-safe,
  `runtime/` = render generik + mock store persisten, `seeds/` = seed JSON,
  `builder/` + `components/` + `pages/` = wizard 6 langkah + tab Daftar
  Modul, `engine/` + `templates/` + `api/` = generate source statis ke
  repo (dev-only), `parser.ts`/`naming.ts`/`registry/` = bantu wizard).
- `src/shared/` — `theme/` (token thema), `lib/`, `hooks/`, `utils/`,
  `types/`, `components/` (`layout/`, `ui/`, `icons/`).
- `docs/BUILDER_SPEC.md` — spec visual builder (arah rombak).
- `.agents/skills/` — project skills (hasil `muse skills validate` harus
  `valid: true` tanpa diagnostics setelah diubah).

## Core Rules

- Thema: `src/shared/theme/theme.ts` satu-satunya sumber kebenaran token;
  dilarang hardcode warna/hex di komponen — pakai utility token
  (`bg-primary`, `text-muted-foreground`, `border-border`) atau
  `var(--theme-*)`.
- Spacing: class semantik `.page-padding`, `.section-gap`, `.stack-gap`,
  `.field-gap`; angka Tailwind hanya untuk penyimpangan khusus.
- File JSX berekstensi `.tsx`; komponen shared mendukung `testId`;
  `shared` tidak import dari `modules`.
- Modul CRUD baru dibuat via wizard `/generator` (publish Draft/Publish),
  bukan dengan menulis folder modul manual — modul statis di
  `src/modules/` hanya yang non-CRUD/shell (`auth/`, `dashboard/`,
  `showcase/`, `generator/`) + hasil Generate ke repo (dev-only,
  menutupi versi dinamis di route sama).
- `definitions/` (types/normalize/validate/configToDefinition/parents) murni
  dan Node-safe: dilarang dependensi Vite/browser (`import.meta.glob`,
  CSS, komponen) — hanya `definitionsApi.ts`/`recordsApi.ts` yang boleh
  memakai `import.meta.glob` untuk seed mock.
- Setelah perubahan: `npm run lint` dan `npm run build`.
