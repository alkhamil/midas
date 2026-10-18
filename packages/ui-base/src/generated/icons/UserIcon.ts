// Ikon "ui/user".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.
import { createIcon } from './createIcon';

// PURE: ikon yang tidak dipakai bisa dibuang bundler aplikasi (tree-shaking).
export const UserIcon = /* @__PURE__ */ createIcon("user", {
  "bold-duotone": {
    "viewBox": "0 0 24 24",
    "body": "<circle opacity=\"1\" cx=\"12\" cy=\"7\" r=\"4\" fill=\"currentColor\"/><path opacity=\"0.5\" d=\"M4 20c0-3.9 3.6-6.5 8-6.5s8 2.6 8 6.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z\" fill=\"currentColor\"/>"
  },
  "outline": {
    "viewBox": "0 0 24 24",
    "body": "<circle cx=\"12\" cy=\"7.5\" r=\"3.75\" stroke=\"currentColor\" stroke-width=\"1.5\"/><path d=\"M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>"
  }
});
