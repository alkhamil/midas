// Ikon "ui/calendar".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.
import { createIcon } from './createIcon';

// PURE: ikon yang tidak dipakai bisa dibuang bundler aplikasi (tree-shaking).
export const CalendarIcon = /* @__PURE__ */ createIcon("calendar", {
  "bold-duotone": {
    "viewBox": "0 0 24 24",
    "body": "<path opacity=\"0.5\" d=\"M3 10h18v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z\" fill=\"currentColor\"/><path d=\"M6 4.5h12a3 3 0 0 1 3 3V10H3V7.5a3 3 0 0 1 3-3Z\" fill=\"currentColor\"/><path d=\"M8 3v3.5M16 3v3.5\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>"
  },
  "outline": {
    "viewBox": "0 0 24 24",
    "body": "<rect x=\"3.5\" y=\"5\" width=\"17\" height=\"15.5\" rx=\"2.5\" stroke=\"currentColor\" stroke-width=\"1.5\"/><path d=\"M8 3v4M16 3v4M3.5 10h17\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>"
  }
});
