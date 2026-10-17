// Ikon "ui/danger-circle".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.
import { createIcon } from './createIcon';

// PURE: ikon yang tidak dipakai bisa dibuang bundler aplikasi (tree-shaking).
export const DangerCircleIcon = /* @__PURE__ */ createIcon("danger-circle", {
  "outline": {
    "viewBox": "0 0 24 24",
    "body": "<g stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7.5V13M12 16.5v.01\"/></g>"
  }
});
