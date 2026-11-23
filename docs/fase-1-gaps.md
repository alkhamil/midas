# Fase 1: yang belum sesuai spec

Dicatat 2026-11-23, setelah batch A di-commit (`b194e93`). Acuan: `docs/specs/web-components.md` (P1). Setiap baris: apa yang kurang, alasannya, dan langkah berikutnya. Daftar ini bukan hasil audit lengkap per prop; prop yang belum dibandingkan satu per satu ditandai "belum dicek".

## Component P1 yang belum ada

| Component | Alasan belum | Langkah berikutnya |
|---|---|---|
| Select, MultiSelect | Butuh dropdown (overlay), yang menunggu Fase 2 | Setelah overlay Prototype ada |
| Table | Komponen terbesar: kolom, baris, selection, sort, density. Perlu daftar data | Setelah Radio Group data-driven, karena pola daftar sama |
| Tabs | Butuh daftar item dengan `activeKey` (pola daftar yang sama) | Setelah Table |
| Dialog, Toast | Overlay, menunggu Fase 2 | Template statis dulu, perilaku open/close di Fase 2 |
| SideNavbar, NavItem, TopBar | Navigasi berisi component lain dan daftar item | Setelah Tabs |
| Radio Group | Ditunda sampai Fase 2 selesai (keputusan user, 2026-11-23). Hanya layout (Direction, gap) dan slot Radio; belum ada `options` data dan `value` pilihan tunggal | Rencana data-driven di bawah |

## Component P1 yang ada tapi berbeda dari spec

| Component | Spec | Yang ada | Alasan | Langkah berikutnya |
|---|---|---|---|---|
| Radio Group | `options` (daftar), `value`, `disabled` untuk grup | Hanya opsi dari slot Radio tangan | Engine belum punya tipe prop daftar, sync opsi, atau pilihan tunggal di level grup | Tahap 1 sampai 4 (tipe prop daftar, sync opsi, selection, panel dan parity) |
| Pagination | Daftar tombol halaman, `pageSizeOptions`, `showSizeChanger` | Halaman sebagai teks, total opsional | Daftar tombol butuh jumlah item (sama seperti Radio Group); size changer butuh Select | Setelah Select dan pola daftar |
| Breadcrumb | `items` daftar dengan `href` | Tiga item tetap, separator "/" statis | Daftar dengan jumlah berubah belum didukung; separator sebagai prop menulis dua layer, dan codegen belum mendukung | Pola daftar, lalu link per item |
| Table Toolbar | `filters` (slot) | Tidak ada filters | Filter butuh Select | Setelah Select |
| List Item | `leading`, `trailing` berupa ReactNode | Hanya icon | Slot konten bebas (instance apa saja) belum dibuat untuk ListItem | Gunakan slot content dengan `holds: 'content'` |
| Button | `variant`: primary, secondary, outline, ghost, destructive | Variant (outlined, filled, solid, ...) dan Color (default, primary, danger) | Keputusan antd-structure; nama variant belum disepakati dengan spec | Samakan nama atau revisi spec, butuh keputusan user |
| Card | `variant`: outlined, elevated, filled | Variant outlined, borderless; Type default, inner | Nama dan jumlah variant berbeda; elevated dan filled belum dibuat | Keputusan user |
| TextField | Nama component TextField | Input (kind text, password, textarea) | Penamaan: Input sudah dipakai untuk semua field | Keputusan user: ganti nama atau tetap Input |
| Textarea | Component sendiri | Input dengan kind textarea | Digabung ke Input (sesuai antd) | Tidak perlu tindakan, catat di spec |
| SearchBar | `loading`, `clearable` | Search Field (Input family dengan suffix search) | Dibuat sebagai Search Field | Cek prop `loading` (belum dicek) |
| Avatar | `status`: online, offline | Tidak ada status | Belum dibuat | Tambah prop status sebagai marker |
| Tag | `variant`: neutral, primary, success, warning, danger, info; `removable` (onRemove) | Color preset dan Variant (filled, solid, outlined); close | Nama variant berbeda; Color preset memakai delapan palet | Samakan saat spec disepakati |
| Link | `variant`: default, muted; `external` | Type (warna) dan Link biasa | Muted dan external belum dibuat (belum dicek detailnya) | Cek prop satu per satu |

## Foundations

| Item | Spec | Keadaan | Catatan |
|---|---|---|---|
| Warna | 12 nama semantik, skala 25 sampai 900, mode Light dan Dark | Base data dari token JSON, nama Ant | Belum dicocokkan nama per nama dengan spec (belum dicek); mode Dark belum diverifikasi |
| Spacing | 4/8/12/16/24/32/48 | Ladder gap dan padding dari space-* roles | Nilai 32 dan 48 belum dipakai component mana pun (belum dicek) |
| Ikon | set di page Icons, 16/20/24 | ICON_SET, ukuran dari icon-xs sampai icon-xl | Ukuran spec 16/20/24 belum dipetakan ke Size |
| Radius | sm, md, lg, full | radius-xs sampai radius-full | Nama tidak dipetakan ke nama spec |
| Tipografi | Heading 1 sampai 6, Body, Caption, Label, Code | Typography styles (text-*, heading-*) | Caption dan Code belum dibuat sebagai style |

## Langkah berikutnya, urut

1. Fase 2 (Prototype): overlay, lalu Select, Dialog, Toast.
2. Pola daftar data (`options`, item, nilai): dipakai Radio Group, Pagination, Breadcrumb, Tabs, Table.
3. Nama variant Button dan Card, dan TextField, sudah disetujui user (2026-11-23): nama yang sekarang dipakai tetap.
