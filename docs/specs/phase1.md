# ROLE
Kamu adalah Senior Frontend Engineer & Design System Specialist yang ahli dalam arsitektur Midas / Figma JSON document structure.

# CONTEXT APLIKASI SAAT INI
Aplikasi ini adalah **Midas**, editor desain vektor berbasis web (canvas-based, mirip Figma) yang dibangun dengan React + Vite.
- **Tech Stack**: HTML5 Canvas 2D + React shell + Custom Vector Engine (`src/engine/midas.js`).
- **Penyimpanan Data**: Pure client-side `localStorage` di browser (`midas:kv:*` untuk dokumen dan indeks library).
- **Format Dokumen**: Format JSON dokumen Midas (`format: "midas", version: 1`) dengan hierarki `Document -> Pages -> Nodes` (Frame, Component, ComponentSet, Rect, Text, Vector, dsb.).
- **Fitur Engine yang Didukung**:
  - Auto Layout (`layout: 'horizontal' | 'vertical'`, `gap`, `padding`, `layoutSizingH`, `layoutSizingV`: `hug` / `fill` / `fixed`).
  - Variables / Design Tokens (Collections, Modes, Types: `color`, `number`, `string`, `boolean`, `effect`, Aliases, dan node binding via `n.vars`).
  - Component & ComponentSet (Variants via `n.variant`, variant naming `prop=value`, Component Properties `cprops` + `propBind` untuk text, boolean, instance swap).

Tujuan fase ini adalah membuat **Design System lengkap** yang dapat dimuat langsung ke canvas editor Midas.

# GOAL
Buatkan file `design-system.json` yang berisi Design System lengkap, modular, dan siap pakai di dalam editor Midas. Semua komponen dan tokens harus dalam format struktur node Midas yang valid dan dapat di-render langsung.

# TECH SPEC & CONSTRAINTS
1. **Format Output**: 1 file JSON valid bernama `design-system.json` (format dokumen Midas `format: 'midas'` atau page/components payload yang kompatibel).
2. **Struktur Dokumen**: Mengikuti hierarki Midas:
   - `Page: "Design System"`
   - `Frames (Sections)` untuk setiap kategori
   - `ComponentSet` & `Component` dengan `variant` dan Auto Layout
3. **Auto Layout & Constraints**: Semua container/frame dan komponen menggunakan Auto Layout (`layout`, `gap`, `padding`, `layoutSizingH/V`), bukan sekadar koordinat absolute kaku.
4. **Variables (Design Tokens)**: Terdiri dari 3 Collections:
   - `colors`: Primitive (`blue-500`, `gray-900`, dll.) & Semantic (`bg-primary`, `text-primary`, `text-error`, `border-default`).
   - `spacing`: `4`, `8`, `12`, `16`, `24`, `32`, `48`.
   - `radius`: `sm: 4`, `md: 8`, `lg: 16`, `full: 9999`.
5. **Text Styles / Typography**: Skala tipografi yang konsisten: `Heading/H1-H4`, `Body/Regular-Medium`, `Label/Small`.
6. **Integrasi Storage & Loader**:
   - File JSON dapat disimpan ke `localStorage` (misal key `midas:kv:file:design-system` atau di-merge ke file aktif).
   - Buatkan fungsi loader `loadDesignSystem()` untuk mengimpor atau menggabungkan Page Design System ini ke dokumen yang sedang aktif di editor.

# DESIGN SYSTEM YANG HARUS DIBUAT

Buat 1 Page utama bernama **"Design System"** dengan 5 Frame Section utama. Setiap komponen wajib memiliki Variants & Component Properties (Boolean, Text, Variant).

### 1. Elemen Aksi & Interaksi Dasar (Atoms)
- **Frame: 01 - Atoms**
- **Buttons**: `ComponentSet` `Button` dengan properties: `type=Primary|Secondary|Tertiary|Icon-only`, `state=Default|Hover|Disabled|Loading`, `size=sm|md|lg`. Memiliki indikator loading (spinner) pada variant loading.
- **Links**: `ComponentSet` `Link` dengan variant `variant=inline|standalone`, `state=default|hover|visited`.
- **Icons**: Minimal 24 icon sistem (vector path / SVG path data):
  - *Navigation*: home, search, menu, chevron-left, chevron-right, chevron-down.
  - *Action*: add/plus, edit, delete/trash, share, copy, download, check, close/x.
  - *Status*: info, success, warning, error, alert.
  - Dikelompokkan sebagai component tersendiri agar dapat di-swap.
- **Badges / Chips / Tags**: `ComponentSet` `Badge` dengan variant `status=neutral|success|warning|error` dan `size=sm|md`.

### 2. Form & Input
- **Frame: 02 - Forms**
- **Text Input**: `ComponentSet` `Input` dengan `state=default|focus|error|disabled`, `type=text|password|search|textarea`. Dilengkapi label, placeholder, helper text, dan error message.
- **Selection Controls**: `Checkbox`, `Radio`, dan `Switch/Toggle` masing-masing dengan variant `checked=true|false`, `disabled=true|false`.
- **Dropdown / Select**: `ComponentSet` `Select` dengan variant `mode=single|multi`, `state=closed|open`.
- **Sliders & Date Pickers**: `Component` `Slider` (track + thumb) dan `DatePicker` sederhana (trigger input + popover calendar frame).

### 3. Navigasi
- **Frame: 03 - Navigation**
- **Header / Navbar**: `Component` `Navbar` Desktop (Auto Layout horizontal, width 1440px / fill) berisi logo, link navigasi, search input, profil avatar, dan tombol CTA.
- **Footer**: `Component` `Footer` responsif dengan link kolom, hak cipta, dan media sosial.
- **Sidebar / Navigation Drawer**: `Component` `Sidebar` dengan variant `state=collapsed|expanded`.
- **Breadcrumbs**: `Component` `Breadcrumbs` berhirarki.
- **Tabs**: `ComponentSet` `Tabs` dengan variant tab aktif/inaktif dan item switcher.
- **Pagination**: `Component` `Pagination` dengan tombol previous, next, nomor halaman, dan state aktif.

### 4. Informasi & Kontainer (Data Display)
- **Frame: 04 - Data Display**
- **Cards**: Minimal 3 variant: `Card/Product`, `Card/Article`, `Card/Profile` dengan Auto Layout dan slot/placeholder gambar.
- **Tables**: `Component` `Table` dengan header row, data row, sorting state, dan pagination.
- **Lists**: `Component` `List` untuk unordered, ordered, dan description key-value.
- **Accordion / Collapse**: `ComponentSet` `Accordion` dengan `state=collapsed|expanded`.
- **Avatar**: `ComponentSet` `Avatar` dengan variant `size=sm|md|lg|xl`, `type=image|initials|icon`, `status=online|offline|none`.

### 5. Umpan Balik & Status (Feedback)
- **Frame: 05 - Feedback**
- **Alerts / Banners**: `ComponentSet` `Alert` dengan `type=success|warning|error|info`.
- **Toast / Notification**: `ComponentSet` `Toast` dengan icon status, judul, deskripsi, dan tombol dismiss.
- **Modal / Dialog**: `Component` `Modal` dengan backdrop overlay, dialog card, header, content area, dan tombol aksi.
- **Tooltip**: `Component` `Tooltip` dengan indikator arrow penunjuk.
- **Progress Indicator**: `Progress/Bar`, `Spinner`, dan `Skeleton` loader (shimmer placeholder).

# OUTPUT FORMAT
1. Penjelasan arsitektur struktur JSON dan tokens yang dibuat.
2. File `design-system.json` yang siap di-load oleh Midas editor.
3. Fungsi loader `loadDesignSystem()` untuk mengimpor atau menggabungkan ke document Midas.
4. Instruksi pengujian langsung di browser (`npm run dev`).

# ACCEPTANCE CRITERIA
- [ ] JSON valid dan sesuai skema dokumen Midas.
- [ ] 5 kategori di atas tersedia lengkap dengan hierarki terstruktur.
- [ ] Menggunakan Variables (Design Tokens) untuk warna, spacing, dan radius.
- [ ] Setiap ComponentSet memiliki variant lengkap dan Auto Layout yang rapi.
- [ ] Terintegrasi dengan storage browser (`localStorage`) dan dapat dimuat oleh engine Midas tanpa error.
