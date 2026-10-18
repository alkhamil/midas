// Ikon "ui/chart".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.
import { createIcon } from './createIcon';

// PURE: ikon yang tidak dipakai bisa dibuang bundler aplikasi (tree-shaking).
export const ChartIcon = /* @__PURE__ */ createIcon("chart", {
  "outline": {
    "viewBox": "0 0 24 24",
    "body": "<path d=\"M4 20.5h16M6.5 20.5V13M11 20.5V8M15.5 20.5v-6M20 20.5V4.5\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>"
  }
});
