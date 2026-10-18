// Ikon "ui/filter".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.
import { createIcon } from './createIcon';

// PURE: ikon yang tidak dipakai bisa dibuang bundler aplikasi (tree-shaking).
export const FilterIcon = /* @__PURE__ */ createIcon("filter", {
  "bold-duotone": {
    "viewBox": "0 0 24 24",
    "body": "<path opacity=\"0.5\" d=\"M3.5 4.5h17l-6.5 8v6.5l-4 2v-8.5z\" fill=\"currentColor\"/><path d=\"M3.5 4.5h17l-3 3.75h-11z\" fill=\"currentColor\"/>"
  },
  "outline": {
    "viewBox": "0 0 24 24",
    "body": "<path d=\"M4 5h16l-6 7.5V19l-4 1.5v-8z\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>"
  }
});
