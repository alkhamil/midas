// Ikon "ui/chart".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.
import { createIcon } from './createIcon';

// PURE: ikon yang tidak dipakai bisa dibuang bundler aplikasi (tree-shaking).
export const ChartIcon = /* @__PURE__ */ createIcon("chart", {
  "bold-duotone": {
    "viewBox": "0 0 24 24",
    "body": "<path opacity=\"0.5\" d=\"M5 13.5a1.5 1.5 0 0 1 3 0V20H5zM14 15a1.5 1.5 0 0 1 3 0v5h-3z\" fill=\"currentColor\"/><path d=\"M9.5 8.5a1.5 1.5 0 0 1 3 0V20h-3zM18.5 5a1.5 1.5 0 0 1 3 0v15h-3z\" fill=\"currentColor\"/><path d=\"M3 20.75h18\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>"
  },
  "outline": {
    "viewBox": "0 0 24 24",
    "body": "<path d=\"M4 20.5h16M6.5 20.5V13M11 20.5V8M15.5 20.5v-6M20 20.5V4.5\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>"
  }
});
