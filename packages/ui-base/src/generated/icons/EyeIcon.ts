// Ikon "ui/eye".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.
import { createIcon } from './createIcon';

// PURE: ikon yang tidak dipakai bisa dibuang bundler aplikasi (tree-shaking).
export const EyeIcon = /* @__PURE__ */ createIcon("eye", {
  "bold-duotone": {
    "viewBox": "0 0 24 24",
    "body": "<path opacity=\"0.5\" d=\"M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z\" fill=\"currentColor\"/><circle opacity=\"1\" cx=\"12\" cy=\"12\" r=\"3.5\" fill=\"currentColor\"/>"
  },
  "outline": {
    "viewBox": "0 0 24 24",
    "body": "<path d=\"M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><circle cx=\"12\" cy=\"12\" r=\"3\" stroke=\"currentColor\" stroke-width=\"1.5\"/>"
  }
});
