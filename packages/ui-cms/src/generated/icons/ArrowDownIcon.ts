// Ikon "ui/arrow-down".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.
import { createIcon } from './createIcon';

// PURE: ikon yang tidak dipakai bisa dibuang bundler aplikasi (tree-shaking).
export const ArrowDownIcon = /* @__PURE__ */ createIcon("arrow-down", {
  "outline": {
    "viewBox": "0 0 24 24",
    "body": "<path d=\"M12 5v14M6 13l6 6 6-6\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>"
  }
});
