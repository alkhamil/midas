// Ikon "ui/danger-circle".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.
import { createIcon } from './createIcon';

// PURE: ikon yang tidak dipakai bisa dibuang bundler aplikasi (tree-shaking).
export const DangerCircleIcon = /* @__PURE__ */ createIcon("danger-circle", {
  "bold-duotone": {
    "viewBox": "0 0 24 24",
    "body": "<circle opacity=\"0.5\" cx=\"12\" cy=\"12\" r=\"10\" fill=\"currentColor\"/><path d=\"M12 7v6\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><circle opacity=\"1\" cx=\"12\" cy=\"16.5\" r=\"1\" fill=\"currentColor\"/>"
  },
  "outline": {
    "viewBox": "0 0 24 24",
    "body": "<circle cx=\"12\" cy=\"12\" r=\"9\" stroke=\"currentColor\" stroke-width=\"1.5\"/><path d=\"M12 7.5V13M12 16.5v.01\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>"
  }
});
