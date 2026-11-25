# Redesign Midas: rencana dan catatan perubahan

Dibuat 2026-11-25. Dokumen ini mencatat setiap perubahan tampilan. Tambahkan entri baru di bagian **Log perubahan** untuk setiap perubahan, dengan file dan alasannya.

## Tujuan

- Tampilan lebih rapi dan lebih mudah dipakai, terutama panel **Design**, **Behavior**, dan **Prototype**.
- Figma sebagai acuan tata letak (posisi panel, kepadatan, hierarki, pola interaksi).
- Font dan warna **tetap** seperti sekarang: Inter dengan fallback sistem, serta palet `:root` dan `html[data-theme="light"]` di `apps/studio/src/styles.css`. Yang berubah hanya nilai token yang gagal kontras, dan tata letaknya.

## Prinsip (dari ui-ux-pro-max, dipakai untuk aplikasi desktop)

- Kontras teks minimal **4,5:1** untuk teks biasa dan **3:1** untuk teks besar dan ikon. Tidak boleh ada teks abu-abu di atas abu-abu.
- Fokus keyboard selalu terlihat (`:focus-visible` sudah ada, jangan dihapus).
- Tombol tanpa label teks wajib punya `aria-label` dan `title`.
- Ikon dari SVG, tidak memakai emoji.
- Animasi 150 sampai 300 ms, dan dimatikan saat `prefers-reduced-motion`.
- Tidak ada gaya satu kali pakai di panel: pakai kelas bersama (`inspector-section`, `section-heading`, `cmp-props`, `cmp-prop2`, `cmp-ctl`) dari `styles.css`.
- Satu judul per panel. Judul section memakai `section-heading`.

## Keadaan sekarang (diamati 2026-11-25)

Diamati dengan menjalankan server (`infra:up`, `db:migrate`, `dev:server`, `dev:studio`) dan membuka file "Testing" di browser pane, viewport 1440x900.

Struktur editor sudah benar dan sejalan dengan Figma: rail kiri 48px, panel kiri 236px (halaman dan layer), kanvas di tengah, panel kanan 280px (Design, Behavior, Prototype). Yang perlu diperbaiki adalah detail:

| Temuan | Lokasi | Dampak |
|---|---|---|
| Teks `--muted` tidak lolos kontras: 4,2:1 di atas panel gelap, 3,2:1 di atas panel terang | `styles.css` `:root` dan `html[data-theme="light"]` | Melanggar WCAG AA, terutama label dan judul kecil |
| Pilihan collection di Behavior terpotong ("Butt...") karena badge "Auto-matched" memakan lebar | `behaviorPanel.js` `masterHtml`, kelas `.cmp-prop2` | Nama collection tidak terbaca |
| Label di kolom kiri `.cmp-prop2` dipotong ("Persistent st...") | `.cmp-prop2` lebar kolom tetap 84px | Label tidak lengkap |
| Dua definisi `.cmp-props` dan `.cmp-prop2` di `styles.css` | sekitar baris 1449 dan 1494 | Aturan saling menimpa, sulit dirawat |
| Tab panel kanan 11px dan muted, tinggi 52px | `.inspector-tabs` | Terlalu kecil dan lebih pucat dari tab Figma |

## Log perubahan

| Tanggal | Perubahan | File | Alasan |
|---|---|---|---|
| 2026-11-25 | `--muted` dark dari `#85838e` ke `#a09ea9` (4,7 sampai 6,6:1 di semua permukaan gelap) | `apps/studio/src/styles.css` | Kontras AA |
| 2026-11-25 | `--muted` light dari `#928d9c` ke `#656073` (4,9 sampai 6,0:1 di semua permukaan terang) | `apps/studio/src/styles.css` | Kontras AA |
| 2026-11-25 | Badge "Auto-matched" / "Picked manually" di Behavior diganti titik kecil dengan `title` dan `aria-label`. Satu helper `matchDot` untuk dua pemakai | `apps/studio/src/engine/behaviorPanel.js`, `styles.css` (`.match-dot`) | Pilihan collection tidak lagi terpotong. Terverifikasi: "Button Variant" dst. tampil penuh |
| 2026-11-25 | Lebar kolom label `.cmp-prop2` 84px ke 104px | `styles.css` | "Persistent states" tidak lagi terpotong. Terverifikasi di Behavior |
| 2026-11-25 | Hapus definisi `.cmp-props` dan `.cmp-prop` yang tertimpa atau tidak dipakai (`.cmp-prop select` mati). `.vp-row input` tetap | `styles.css` | Satu definisi per kelas, tanpa kode mati (AGENTS.md) |
| 2026-11-25 | Tab panel kanan: tinggi 52px ke 40px, teks 11px ke 12px | `styles.css` (`.inspector-tabs`) | Lebih padat dan sejalan dengan tab Figma. Terverifikasi di Design, Behavior, Prototype |
| 2026-11-25 | Ikon chrome memakai satu set: Lucide (ISC, boleh untuk komersial, dicopy bukan ditautkan). Tabel `UI_ICONS` di `apps/studio/src/engine/uiIcons.js` menggantikan tabel path lama di `midas.js`. `icon()` menggambar semua ikon dengan satu stroke, `UI_ICON_STROKE` 1.75 | `uiIcons.js`, `midas.js` (`icon`), `THIRD_PARTY_NOTICES` | Keseragaman ikon. Lisensi ISC disertakan |
| 2026-11-25 | Ikon di `Shell.jsx` (rail, Home, Play, panah dan chevron panel) diganti `data-icon` dan digambar dari tabel yang sama. Logo Midas tetap | `components/Shell.jsx` | Tidak ada SVG tulisan tangan di shell |
| 2026-11-25 | Ikon Home (Recents, All files, Templates, Library, Trash, Users, folder, star) digambar dari tabel yang sama. Tabel `HOME_ICONS` dihapus | `midas.js` (`homeIcon`) | Satu tabel ikon |
| 2026-11-25 | Semua SVG inline di `midas.js` dengan stroke 1.3, 1.4, 1.5, atau 1.6 diubah ke 1.75 (49 tempat). Ikon di `play.js` dan ikon komponen (`ICON_SET`) tidak disentuh | `midas.js` | Berat garis sama di seluruh editor |
| 2026-11-25 | Daftar file di Home punya urutan: "Last edited" (default) atau "Name". Pilihannya ada di bar di atas daftar. Urutan tidak berlaku di "Recents" | `midas.js` (`lib.sort`, `bulkBar`, `renderHome`), `styles.css` (`.home-sort`) | Mudah mencari file |

Panel Design: struktur sudah dikelompokkan (Properties, Position, Auto layout, Appearance) dengan judul section yang sama. Belum ada perubahan struktur. Perlu tinjauan Anda sebelum diubah.
Light mode: diperiksa di Behavior, Design, dan Home. Tidak ada elemen yang hilang atau tidak terbaca.

Tes: `apps/studio`, 362 tes, 355 lulus, 7 gagal. Ketujuh kegagalan sama dengan sebelum perubahan ini: 6 di tes bridge desktop dan 1 di tes snapshot dasar (`baseVariables.test.js`, 376 vs 365). Belum dibuktikan di tree bersih. Satu kali `behaviorPanel.test.js` gagal saat dijalankan bersama semua tes dan lulus saat dijalankan sendiri; tidak terulang. `packages/builder-core`: 2907 tes, semua lulus.

## Rencana berikutnya (belum dikerjakan)

1. [x] Konsolidasi `.cmp-props` dan `.cmp-prop2` menjadi satu definisi, dan lebar label dibuat cukup untuk teks terpanjang.
2. [x] Tab panel kanan: tinggi 40px, teks 12px, indikator bawah seperti tab Figma.
3. [ ] Panel Design (belum, lihat catatan di log): kelompokkan section (Position, Layout, Appearance) dengan jarak yang sama.
4. Panel Prototype: aksi per interaksi sudah berbentuk kartu. Periksa jarak dan tombol tambah.
5. [~] Home: urutan file sudah ada. Bagian "Terbaru" dan tampilan daftar (list) belum dibuat.
6. [x] Verifikasi: screenshot setiap state yang diubah (Design, Behavior, Prototype, Home) di browser pane, lalu jalankan `npm test` di `apps/studio` dan `packages/builder-core`.
