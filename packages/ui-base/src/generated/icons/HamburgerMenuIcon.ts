// Ikon "ui/hamburger-menu".
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.
import { createIcon } from './createIcon';

// PURE: ikon yang tidak dipakai bisa dibuang bundler aplikasi (tree-shaking).
export const HamburgerMenuIcon = /* @__PURE__ */ createIcon("hamburger-menu", {
  "bold-duotone": {
    "viewBox": "0 0 24 24",
    "body": "<path d=\"M4 6.5h16M4 17.5h16\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path opacity=\"0.5\" d=\"M4 12h16\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"/>"
  },
  "outline": {
    "viewBox": "0 0 24 24",
    "body": "<path d=\"M4 6.5h16M4 12h16M4 17.5h16\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>"
  }
});
