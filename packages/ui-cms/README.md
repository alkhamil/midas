# @midas/ui-cms

Komponen UI dari design system **CMS Design System** di Midas (spec §3.4).

## Alur kerja

1. Desainer publish versi baru library di Midas.
2. Ambil Library Kit versi itu:

   ```bash
   npx midas sync --version <versi>
   ```

   Ini menimpa `src/generated/` (token tema, tipe props, manifest) dan menyamakan `version` di `package.json`.
3. Implementasikan / sesuaikan komponen di `src/components/`. Props wajib memakai tipe dari `src/generated/props`.
   Komponen kerangka ditandai `midasStub = true` — hapus penanda itu setelah komponen selesai.
4. `npm run build`, lalu publish ke Midas Registry:

   ```bash
   MIDAS_REGISTRY_TOKEN=... npm publish
   ```

## Memakai di project

```tsx
import '@midas/ui-cms/tokens.css';
import { ThemeProvider, Button } from '@midas/ui-cms';
```

Folder: `ui-cms/` · Library id di Midas: `midas-base-ds-bwqqo3y9`.
