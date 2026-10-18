// Ikon "ui/check-circle".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.
import { createIcon } from './createIcon';

// PURE: ikon yang tidak dipakai bisa dibuang bundler aplikasi (tree-shaking).
export const CheckCircleIcon = /* @__PURE__ */ createIcon("check-circle", {
  "outline": {
    "viewBox": "0 0 24 24",
    "body": "<circle cx=\"12\" cy=\"12\" r=\"9\" stroke=\"currentColor\" stroke-width=\"1.5\"/><path d=\"M8.5 12.5 11 15l4.5-5\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>"
  }
});
