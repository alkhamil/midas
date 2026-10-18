// Ikon "ui/danger-triangle".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.
import { createIcon } from './createIcon';

// PURE: ikon yang tidak dipakai bisa dibuang bundler aplikasi (tree-shaking).
export const DangerTriangleIcon = /* @__PURE__ */ createIcon("danger-triangle", {
  "outline": {
    "viewBox": "0 0 24 24",
    "body": "<path d=\"M12 4 21 19.5H3z\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M12 10v4.5M12 17v.01\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>"
  }
});
