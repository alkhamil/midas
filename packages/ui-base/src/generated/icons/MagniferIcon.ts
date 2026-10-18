// Ikon "ui/magnifer".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.
import { createIcon } from './createIcon';

// PURE: ikon yang tidak dipakai bisa dibuang bundler aplikasi (tree-shaking).
export const MagniferIcon = /* @__PURE__ */ createIcon("magnifer", {
  "bold-duotone": {
    "viewBox": "0 0 24 24",
    "body": "<circle opacity=\"0.5\" cx=\"11\" cy=\"11\" r=\"7.5\" fill=\"currentColor\"/><path d=\"m16.5 16.5 4 4\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>"
  },
  "outline": {
    "viewBox": "0 0 24 24",
    "body": "<circle cx=\"11\" cy=\"11\" r=\"6.5\" stroke=\"currentColor\" stroke-width=\"1.5\"/><path d=\"m16 16 4.5 4.5\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>"
  }
});
