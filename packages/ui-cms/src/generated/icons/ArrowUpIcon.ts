// Ikon "ui/arrow-up".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.
import { createIcon } from './createIcon';

// PURE: ikon yang tidak dipakai bisa dibuang bundler aplikasi (tree-shaking).
export const ArrowUpIcon = /* @__PURE__ */ createIcon("arrow-up", {
  "outline": {
    "viewBox": "0 0 24 24",
    "body": "<path d=\"M12 19V5M6 11l6-6 6 6\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>"
  }
});
