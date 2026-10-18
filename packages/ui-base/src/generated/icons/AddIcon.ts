// Ikon "ui/add".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.
import { createIcon } from './createIcon';

// PURE: ikon yang tidak dipakai bisa dibuang bundler aplikasi (tree-shaking).
export const AddIcon = /* @__PURE__ */ createIcon("add", {
  "bold-duotone": {
    "viewBox": "0 0 24 24",
    "body": "<circle opacity=\"0.5\" cx=\"12\" cy=\"12\" r=\"10\" fill=\"currentColor\"/><path d=\"M12 8v8M8 12h8\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>"
  },
  "outline": {
    "viewBox": "0 0 24 24",
    "body": "<path d=\"M12 5v14M5 12h14\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>"
  }
});
