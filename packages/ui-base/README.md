# @midas/ui-base

Komponen UI dari design system **Midas Base** (file "Midas Base Design System" di Midas). Kode komponen berasal dari `contoh_base_code`; token tema, ikon, dan kontrak props dibangkitkan dari desain (`src/generated`, Library Kit).

## Memakai di aplikasi

```bash
npm install @midas/ui-base react react-dom react-router react-i18next i18next react-hook-form
```

```css
/* src/index.css (Tailwind CSS v4) */
@import 'tailwindcss';
@import '@midas/ui-base/tailwind.css';
```

```tsx
import { registerUiLocales, ThemeProvider, ToastProvider, Button, AddIcon } from '@midas/ui-base';
registerUiLocales(i18n, 'general');   // teks bawaan komponen (en/id), tidak menimpa teks aplikasi

<ThemeProvider><ToastProvider>…<Button icon={<AddIcon />}>Tambah</Button></ToastProvider></ThemeProvider>
```

- Ikon: satu komponen per ikon (`ArrowLeftIcon`, `TrashBinIcon`, … — hanya yang dipakai yang ikut dibundel) atau `<Icon name="arrow-left" variant="bold" />` (memuat semua ikon). Warna mengikuti `currentColor`.
- Tema: `light` / `dark` dari Variables desain (`useTheme().setTheme('dark')`).
- Kontrak props desain: `import type { designProps } from '@midas/ui-base'`.

## Isi paket

| Folder | Isi |
| --- | --- |
| `src/components/ui`, `ui/fields`, `layout` | Komponen (Button, Table, TextField, AppShell, …) |
| `src/generated` | Library Kit — **jangan diedit**, perbarui dengan `npm run sync` |
| `src/internal` | Hooks/utils/types yang dipakai komponen |
| `src/i18n` | Teks bawaan komponen en/id |
| `src/tailwind.css`, `src/styles/utilities.css` | Entry CSS untuk aplikasi, class spacing semantik |

## Alur rilis

1. Desainer publish versi baru di Midas (atau `node scripts/seed-base-design-system.mjs` dari root monorepo untuk seed).
2. `npm run sync -- --version <versi>` → `src/generated` + `version` di package.json.
3. Sesuaikan komponen bila props desain berubah; `npm test` (smoke test) dan `npm run build`.
4. `MIDAS_REGISTRY_TOKEN=... npm publish`, lalu `npx midas report` → status kode tiap komponen tampil di Midas (Library → Developer kit).
