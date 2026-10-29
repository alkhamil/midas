# Rencana lanjutan: dokumentasi library dan perilaku komponen

Dibuat 2026-10-29, untuk dilanjutkan nanti. Belum ada yang dikerjakan dari daftar di bawah.

## Keadaan sekarang

Sudah jalan (di branch `feat/naz`):

- Publish library menghasilkan paket React `@midas/<nama>`, dengan gaya berupa class Tailwind berawalan `mds:` yang dikompilasi server menjadi `dist/styles.css`. Proyek pemakai tidak perlu Tailwind.
- Server Midas menjadi registry npm (`/api/registry`, token API) dan situs dokumentasi (`/docs/<nama>`): install, versi dan release notes, halaman per komponen dengan preview.
- Lapisan perilaku (`packages/builder-core/src/library-behavior.js`): hover, pressed, focus, disabled untuk komponen ber-State. Perilaku penuh untuk Button, IconButton, Link, Checkbox, Radio/RadioGroup, Switch, TextField, Textarea, PasswordInput, NumberInput, Select, SegmentedControl, Accordion, FormItem, SideNavbar, TopBar.
- Tes: builder-core 267, server 34 (database uji terpisah).

**Belum di-commit** (setelah commit `7220931`): perilaku komponen, perbaikan ikon (kontur tambahan), tree-shaking ikon, `@theme inline` untuk dark mode, SideNavbar/TopBar, dan perubahan di `docs-site.ts`, `package.ts`, `library-package.js`, `component-codegen.js`, `icon-svg.js`, `tailwind.js`. 

## Yang akan dikerjakan

1. ~~Hapus `examples/react-app`.~~ **Sudah dihapus (2026-10-29).**
2. **UI dokumentasi menjadi showcase interaktif**, dibangun dengan komponen library yang di-publish (Sidebar, Top Bar, Button, Select, Switch, Badge, Card, dan lainnya):
   - Beranda: hero, tombol install yang bisa disalin, galeri semua komponen sebagai kartu hidup.
   - Halaman komponen: playground besar dengan kontrol props dari komponen library, kode JSX yang ikut berubah, tabel props, Do/Don't, accessibility.
   - Versi dan release notes, pilihan versi di Top Bar, pencarian komponen, tombol dark/light.
   - Aplikasi dibundel server saat publish seperti `preview.js`; navigasi di sisi klien; link `/docs/<nama>/components/<komponen>` tetap berlaku.
3. **State komponen yang terasa seperti website sungguhan:** kursor (pointer, not-allowed), fokus ring hanya untuk keyboard, state tekan, disabled yang benar. Memakai lapisan perilaku sendiri. **Jangan memakai atau mengubah fitur Behavior milik Fahmi** (`packages/builder-core/src/behavior.js`, `generate/`, bagian Behavior di `apps/studio/src/engine/midas.js`).
4. **Menu Library di Studio mendapat navigasi ke halaman dokumentasi.** Saat ini link dokumentasi hanya ada di dialog "React package".
5. **Perilaku tambahan yang dibutuhkan dokumentasi:** Tabs, Tooltip, Dialog, Drawer, Pagination, dan item SideNavbar sebagai props (daftar item, item aktif, `onSelect`) supaya sidebar bisa dipakai berpindah halaman.
6. **Empat design tip di file Web Design System** (frame tanpa auto layout):
   - Avatar › Size=xs, Shape=Circle (8 tempat)
   - Spinner › Size=sm, Tone=Primary (6 tempat)
   - Side Navbar › State=Expanded, Tone=Primary (4 tempat)
   - App Shell › Sidebar=Expanded (2 tempat)

## Urutan yang disarankan

1. Commit pekerjaan yang belum di-commit (lihat di atas).
2. (`examples/` sudah dihapus.)
3. Perbaiki empat design tip lewat generator desain, lalu terapkan ke file.
4. Link dokumentasi di menu Library.
5. State seperti website, lalu perilaku tambahan (nomor 3 dan 5).
6. Aplikasi dokumentasi (nomor 2), diuji di server uji terpisah.
7. Publish ulang dan cek di library Anda.

## Pertanyaan yang belum dijawab

Kalau library yang di-publish tidak punya komponen yang dibutuhkan dokumentasi (misalnya tanpa Sidebar):
- **A (saran saya):** dokumentasi memakai elemen biasa yang diberi gaya dari token library, jadi tetap tampil untuk library apa pun.
- **B:** dokumentasi hanya aktif untuk library yang punya set komponen minimal.

## Catatan kerja

- Server dev: `npm run dev:server` (port 4000), Studio di 5174. Tes server selalu memakai database terpisah, jangan database dev:

  ```bash
  export DATABASE_URL=postgres://midas:midas@127.0.0.1:5433/midas_pkgtest S3_BUCKET=midas-pkgtest
  docker exec midas-postgres-1 psql -U midas -d postgres -c "create database midas_pkgtest"
  npx tsx src/db/migrate.ts
  node --env-file-if-exists=.env --import tsx --test test/*.test.ts
  docker exec midas-postgres-1 psql -U midas -d postgres -c "drop database midas_pkgtest"
  ```

- Migrasi `0008_library_docs` (kolom `docs_public`) sudah dijalankan di database dev.
- Library Web Design System sudah di-publish ulang oleh Anda (versi 1, dibangun dengan generator 8). Perilaku SideNavbar/TopBar dan perubahan berikutnya butuh publish ulang.
- Cache browser untuk `/docs/<nama>/_/preview.js`: `max-age=3600` pada URL yang sama setelah library dihapus lalu di-publish ulang bisa menampilkan bundel lama. Perbaikan yang diusulkan: ETag dan `no-cache` di `apps/server/src/routes/docs.ts` (belum diterapkan).
- Node: Dockerfile, `engines`, dan `.nvmrc` sudah ke Node 26 tetapi belum dijalankan di Node 26; coba build image Docker sebelum deploy.
- Node 22.13 lokal; skrip bantu dan snapshot dev ada di folder scratchpad sesi, bukan di repo.
