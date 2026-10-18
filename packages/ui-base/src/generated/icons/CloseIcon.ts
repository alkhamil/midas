// Ikon "ui/close".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.
import { createIcon } from './createIcon';

// PURE: ikon yang tidak dipakai bisa dibuang bundler aplikasi (tree-shaking).
export const CloseIcon = /* @__PURE__ */ createIcon("close", {
  "bold-duotone": {
    "viewBox": "0 0 24 24",
    "body": "<path d=\"M6 6l12 12\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path opacity=\"0.5\" d=\"M18 6 6 18\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"/>"
  },
  "outline": {
    "viewBox": "0 0 24 24",
    "body": "<path d=\"m6 6 12 12M18 6 6 18\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>"
  }
});
