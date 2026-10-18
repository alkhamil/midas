// Ikon "ui/danger-triangle".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.
import { createIcon } from './createIcon';

// PURE: ikon yang tidak dipakai bisa dibuang bundler aplikasi (tree-shaking).
export const DangerTriangleIcon = /* @__PURE__ */ createIcon("danger-triangle", {
  "bold-duotone": {
    "viewBox": "0 0 24 24",
    "body": "<path opacity=\"0.5\" d=\"M10.3 3.5a2 2 0 0 1 3.4 0l8.4 14.5a2 2 0 0 1-1.7 3H3.6a2 2 0 0 1-1.7-3z\" fill=\"currentColor\"/><path d=\"M12 9v5\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><circle opacity=\"1\" cx=\"12\" cy=\"17\" r=\"1\" fill=\"currentColor\"/>"
  },
  "outline": {
    "viewBox": "0 0 24 24",
    "body": "<path d=\"M12 4 21 19.5H3z\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M12 10v4.5M12 17v.01\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>"
  }
});
