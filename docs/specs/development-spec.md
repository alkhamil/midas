# Development Specification: Midas Code Builder & Design System Library

Dokumen ini mendefinisikan spesifikasi teknis fitur **Code Builder** dan **Design System Library** di Midas, serta pakem **Base Code** yang dihasilkan.

Alur pemakaian setelah spec ini diimplementasikan: [workflow.md](./workflow.md).

Referensi pakem kode: folder `contoh_base_code/` (terutama `AGENTS.md`, `docs/ARSITEKTUR_FOLDER.md`, dan modul hasil generate `src/modules/region/`).

---

## 1. Positioning: Midas vs Figma

Midas adalah clone Figma di sisi canvas (Design, Components, Variables, Plugins), dengan perbedaan berikut:

| Aspek | Figma | Midas |
| --- | --- | --- |
| Tab **Prototype** di inspector kanan | Ada | **Dihapus.** Alur antar-halaman diatur lewat Code Builder (Action Events), bukan prototype. |
| Menu **Code Builder** | Tidak ada | **Baru**, di left rail tepat di bawah menu **Plugins**. |
| Output | Gambar / prototype | Kode React real yang bisa di-run dan di-build, mengikuti pakem §5. |

Konsekuensi di UI Midas saat ini (`src/components/Shell.jsx`):
- `RightPanel`: hapus tombol `data-inspector-tab="prototype"` beserta panel/engine terkait.
- `LeftRail`: tambah tombol `data-rail="code-builder"` setelah `data-rail="plugins"`, beserta panel kirinya.
- Tombol **Present** di top bar: diganti/diarahkan ke **Preview App** milik Code Builder (§4.5).
- Top bar: badge **LOCAL FILE** dan indikator *Saved locally* diganti status simpan ke server (*Saving… / Saved / Offline — changes pending*, §7.6); avatar profil menjadi akun login.

---

## 2. Arsitektur Utama

Tiga lapisan dipisah tegas:

1. **Design (Canvas)** — gambar visual, seperti Figma.
2. **Code Builder** — konfigurasi peran halaman, props fungsional, data, dan behavior.
3. **Design System Library** — design system buatan desainer di Midas, di-publish sebagai library versioned yang dipakai bersama oleh file desain lain dan oleh kode (paket frontend `@midas/ui-<nama>`).

```text
+-----------------------------------------------------------------------------+
|                    Midas Studio (Browser, server-first)                     |
|                                                                             |
|  +----------------+     +----------------------+     +-------------------+  |
|  | Design Canvas  | --> | Code Builder         | --> | Base Code         |  |
|  | (Figma-like)   |     | (Role, Props, Data,  |     | Generator         |  |
|  |                |     |  Behavior, Flow)     |     | (pakem §5, di     |  |
|  |                |     |                      |     |  browser)         |  |
|  +----------------+     +----------------------+     +-------------------+  |
|          state di memori + autosave per page                  |  .zip       |
+----------------------------------|----------------------------|-------------+
                                   | REST API                   v
   +-------------------------------v---+          +---------------------------+
   |  Midas Backend (§7)               |          |  Project hasil generate   |
   |  - Postgres: files, pages, lib,   |          |  (React + Vite + TS)      |
   |    builder projects, auth         |          +-------------+-------------+
   |  - Object storage: aset, bundle   |                        | npm install
   +-------------------+---------------+                        v
                       | baca versi       +---------------------------------+
                       +----------------> |  Midas Registry (Verdaccio)     |
                                          |  - @midas/ui-<nama> (semver)    |
   Repo paket library ----CI publish----->|    satu paket per library       |
                                          +---------------------------------+
```

---

## 3. Modul 1: Design System Library

Design system dibuat desainer UI/UX **di Midas sendiri**, sama seperti membuat file desain biasa. File itu kemudian di-publish sebagai **Library** sehingga:
- file desain lain di Midas bisa memakai komponennya (seperti Team Library di Figma), dan
- project hasil Code Builder bisa memakai paket kode frontend-nya (`npm install`).

Satu Midas bisa punya **banyak library** (mis. `@midas/ui-cms`, `@midas/ui-mobile`), masing-masing dengan nama paket sendiri yang diatur saat publish.

Prinsip pembagian kerja (**hybrid**):

| Bagian | Dibuat oleh | Keterangan |
| --- | --- | --- |
| Visual komponen, variants, component properties, Variables | Desainer (canvas Midas) | Sumber kebenaran desain |
| Token tema (`theme.ts`, CSS variables) | **Otomatis** dari Variables | Di-generate saat publish |
| Tipe props (`ButtonProps`, …) + manifest props untuk Inspector | **Otomatis** dari component properties & variants | Di-generate saat publish |
| Kerangka paket (`package.json` dengan nama paket, `index.ts`, struktur folder) | **Otomatis** saat publish pertama | Di-generate sekali, lalu milik developer |
| Isi komponen (logika, state, aksesibilitas, keyboard, interaksi) | Developer | Mengikuti tipe props hasil generate |

### 3.1. Membuat design system (desainer)

1. Buat file baru di Midas, mis. **"CMS Design System"**.
2. Susun di **Pages** seperti biasa, mis. Page `Foundations` (warna, tipografi, spacing), `Buttons`, `Forms`, `Table`, `Layout`.
3. Buat **main component** + **variants** + **component properties** (mis. Button: `Type = Primary | Secondary | Destructive | Outline | Ghost`, `Size = sm | md`, `Disabled: boolean`, `Label: text`, `Icon: instance swap`).
4. Definisikan warna, tipografi, spacing, radius sebagai **Variables** (bukan nilai hex lepas) — ini yang menjadi token tema.
5. **Ikon** juga berasal dari design system (library UI **tidak** memakai paket ikon pihak ketiga seperti `lucide-react`). Desainer membuat page **Icons** seperti biasa:
   - setiap ikon = **main component** (atau component set bila punya beberapa gaya, mis. variant `Style=Bold | Outline`);
   - isi ikon bebas: vector/pen tool, shape, boolean, hasil import Figma, atau SVG yang di-paste;
   - komponen dianggap ikon bila berada di page bernama **Icons** (atau **Icon**), atau namanya diawali `Icon/` / `Icons/` (mis. `Icon/navigation/arrow-left` → kategori `navigation`, nama `arrow-left`). Desainer bisa mengubahnya per komponen di form publish.
   - Fitur bantu (opsional): Assets → **Import icons** memasukkan folder SVG siap pakai berpola `<gaya>/<kategori>/<nama>.svg` (mis. set WDS) ke page Icons — satu component set per ikon, satu variant per gaya. Import ulang mengganti set dengan nama sama.

### 3.2. Publish Library

Tombol **Publish Library** pada file design system membuka form:

| Field | Contoh | Aturan |
| --- | --- | --- |
| Nama library | CMS Design System | Tampil di daftar library Midas |
| Nama paket frontend | `@midas/ui-cms` | Wajib scope `@midas/`, kebab-case, unik, **tidak bisa diubah** setelah publish pertama |
| Versi | `1.2.0` | Semver; default dihitung otomatis (patch/minor/major) dari perubahan, bisa diubah |
| Catatan rilis | "Tambah variant Ghost pada Button" | Opsional |
| Komponen yang dipublish | ☑ Button ☑ TextField ☐ Draft/… | Default semua main component, kecuali yang diawali `_` / `.` (privat) |

Form memisahkan **Components** dan **Icons**. Ikon terdeteksi otomatis (lihat §3.1 poin 5); setiap baris bisa dipindah (*Icon* ↔ *Component*). Saat publish, Studio mengekspor setiap variant ikon ke SVG — gambar SVG dipakai apa adanya, selain itu diekspor dari layer-nya (vector, shape, boolean) — dan mengirimnya di snapshot (`snapshot.icons`).

Untuk setiap komponen (bukan ikon), form juga menampilkan **Component Mapping**:
- **Export name** di kode (default dari nama komponen, PascalCase: "Text Field" → `TextField`).
- **Props mapping**: component property / variant → prop kode (mis. `Type=Primary` → `variant="primary"`, `Disabled` → `disabled`).
- Pengecekan otomatis: nama export bentrok, variant tanpa mapping, warna/tipografi yang tidak memakai Variables → peringatan.

Saat publish, Midas:
1. Menyimpan snapshot desain versi tersebut (komponen + Variables) di backend (§7).
2. Membuat library tersedia untuk file Midas lain: muncul di **Assets → Libraries**, bisa di-*enable* per file, komponennya bisa di-drag ke canvas; instance di file lain mendapat notifikasi **update tersedia** saat versi baru keluar.
3. Membangkitkan **Library Kit** versi tersebut (§3.3): token tema, tipe props, manifest props.
4. Pada publish pertama, membuat **kerangka repo paket** (§3.4) untuk developer.

### 3.3. Library Kit (hasil generate otomatis)

```text
src/generated/                # JANGAN diedit manual — ditimpa setiap sync
├── theme.ts                  # ThemeName, ThemeTokens, themes, applyTheme() dari Variables
├── tokens.css                # CSS variables --theme-* per tema (:root = tema pertama, [data-theme="dark"], …)
├── tailwind-theme.css        # @theme inline: --color-* / --radius-* → var(--theme-*) untuk Tailwind v4
├── props/
│   ├── Button.ts             # export interface ButtonProps { variant?: 'primary' | …; label?: string; … } + buttonDefaults
│   └── index.ts
├── icons/
│   ├── createIcon.tsx        # IconProps, IconStyle (gaya dari variant Style), defaultIconStyle
│   ├── ArrowLeftIcon.ts      # satu komponen per ikon: <ArrowLeftIcon variant="bold" size={16} />
│   ├── registry.ts           # IconName, iconNames, iconRegistry
│   ├── Icon.tsx              # <Icon name="arrow-left" /> (memuat semua ikon — untuk bundle kecil pakai ikon bernama)
│   └── index.ts
├── index.ts
├── README.md
└── manifest.json             # daftar komponen + props (nama, tipe, nilai enum, default) + token, untuk Properties Inspector
```

Aturan pembangkitan:
- **Tema** = nama mode dari collection Variables yang punya lebih dari satu mode (mis. Light/Dark → `light`, `dark`); collection satu mode berlaku untuk semua tema. Alias di-resolve per tema.
- **Nama token** = path Variable dalam camelCase, tanpa grup awal `color/` untuk warna: `color/primary-foreground` → `primaryForeground` → `--theme-primary-foreground`; `radius/md` → `radiusMd`. Number → `px`. Utility Tailwind (`tailwind-theme.css`): warna → `--color-*`, `radius/*` → `--radius-*`, `font/family` → `--font-sans` (font default UI), `font/mono` → `--font-mono`. Variable `effect` belum didukung (muncul sebagai peringatan).
- **Props**: variant → union string (`"primary" | "ghost"`) atau boolean bila nilainya true/false; property text → `string`, boolean → `boolean`, instance swap / slot → `ReactNode` (slot pertama → `children`). Semua prop opsional; default = varian pertama dan default component property. Setiap komponen juga punya `testId`.
- **Ikon**: komponen yang dipublish sebagai ikon tidak dipetakan sebagai komponen ber-props; Library Kit membangkitkan komponen ikon React dari SVG hasil export (`snapshot.icons`). Gaya = nilai variant (tanpa variant → `default`). Warna yang paling banyak dipakai di SVG diganti `currentColor` (ikon ikut warna teks), opacity/duotone dan warna lain dipertahankan; `<script>`, atribut `on*`, serta `<title>`/`<desc>`/`<metadata>` dari export dibuang. Default gaya = `outline` bila ada. Setiap ikon diberi anotasi `/* @__PURE__ */` sehingga aplikasi hanya membundel ikon yang dipakai.
- Snapshot library membawa aset yang dipakai komponen (data URL), sehingga file lain yang memakai library dan Library Kit mendapat gambar/ikon yang sama.
- Hasilnya deterministik per versi, sehingga sync bisa diulang dengan aman.

Developer memakai CLI `@midas/cli` (dipublish ke Midas Registry):

```bash
npx @midas/cli login --server https://midas.example.com     # token disimpan di ~/.midas/config.json
npx @midas/cli init ui-cms --library @midas/ui-cms           # repo baru: kerangka + Library Kit (sekali)
npx midas sync --version 1.2.0                               # di repo: timpa src/generated + samakan version package.json
```

Di CI, token diberikan lewat `MIDAS_TOKEN` (dibuat dengan `POST /api/auth/tokens`). Kerangka repo juga bisa diunduh sebagai `.zip` dari tombol **Developer kit** di panel Library Studio.

### 3.4. Repo paket frontend (developer)

Kerangka yang dibuat pada publish pertama (repo terpisah per library, mis. `ui-cms`):

```text
ui-cms/
├── package.json              # "name": "@midas/ui-cms" (dari form publish)
├── .npmrc                    # publish ke Midas Registry (§3.6)
├── midas.config.json         # { "libraryId": "...", "package": "@midas/ui-cms" }
├── src/
│   ├── generated/            # Library Kit (§3.3)
│   ├── components/           # isi komponen — ditulis developer (awalnya kerangka bertanda midasStub)
│   │   ├── Button/Button.tsx #   function Button(props: ButtonProps) { … }
│   │   └── TextField/TextField.tsx
│   ├── layout/               # AppShell, Sidebar, PageHeader, PageContent, …
│   ├── tailwind.css          # entry CSS untuk aplikasi: token + utility Tailwind + @source './index.js'
│   └── index.ts              # export semua komponen + ThemeProvider + ikon + token
└── .github/workflows/release.yml   # CI: sync → build → publish → midas report
```

Contoh nyata: `packages/ui-base` (`@midas/ui-base`) — komponen dari `contoh_base_code` (struktur `components/ui`, `ui/fields`, `layout` dipertahankan), ikon lucide diganti ikon Library Kit, hooks/utils yang dipakai komponen disalin ke `src/internal` (tanpa xlsx), teks bawaan komponen en/id di `src/i18n` (`registerUiLocales(i18n, ns)` — tidak menimpa teks aplikasi). Peer dependency: `react`, `react-dom`, `react-router`, `react-i18next`, `i18next`, `react-hook-form`; CSS dependency (mis. react-datepicker) dibundel ke `styles.css`. Design system-nya ditulis di `scripts/design-system/` dan di-seed dengan `scripts/seed-base-design-system.mjs` (v2: primary `#0058CA`, Inter, ikon outline & bold-duotone).

Aplikasi cukup:

```css
@import 'tailwindcss';
@import '@midas/ui-base/tailwind.css';
```

Isi minimal sebuah library frontend mengikuti apa yang di `contoh_base_code` sekarang berada di `src/shared/components/ui`, `src/shared/components/layout`, dan `src/shared/theme`:

| Kelompok | Komponen |
| --- | --- |
| UI | `Button`, `Card`, `Table` (+ `Column`), `Badge`, `Dialog`, `Drawer`, `Alert`, `Tooltip`, `FilterToolbar`, `DetailCard`, `RowActionButton`, `RelationLabel`, `LoadingOverlay`, `FormSkeleton`, `ErrorStatePage`, `NavigationGuard`, `Toast` (`ToastProvider`, `useToast`) |
| Ikon | Dari Library Kit (`src/generated/icons`): `<NamaIcon>` per ikon + `<Icon name>`. Komponen library memakai ikon ini, bukan paket ikon pihak ketiga. |
| Field | `TextField`, `PasswordField`, `TextAreaField`, `SelectField`, `SelectMultipleField`, `CheckboxField`, `CheckboxGroupField`, `RadioButtonField`, `RadioGroupField`, `SwitchField`, `DatePickerField`, `DateRangeField`, `FileUploadField`, `ColorField`, `EditorField`, `FormArrayField` |
| Layout | `AppShell`, `Sidebar`, `PageHeader`, `PageContent`, `AvatarUser` |
| Theme | `ThemeProvider`, `theme.ts`, `tokens.css` (dari Library Kit) |

Yang **tidak** masuk library (tetap di base code, lihat §5.2): `FormGroup`, `FormItem`, `FormArray`, `FormDefaultValuesWatcher` (mesin form tanpa visual), lib API, i18n, auth.

Aturan komponen library:
- Props komponen wajib memakai tipe dari `src/generated/props` — kontrak desain = kontrak kode.
- Wajib memakai token tema; dilarang hardcode warna/hex.
- Setiap komponen mendukung prop `testId`.

### 3.5. Siklus versi & status

```text
Desainer: Publish Library v1.2.0 (design)
   │  status design: published  → file Midas lain bisa pakai v1.2.0
   ▼
Developer: sync Kit v1.2.0 → lengkapi/ubah komponen → git tag v1.2.0
   ▼
CI: build → npm publish @midas/ui-cms@1.2.0 → npx midas report
   │  POST /api/libraries/:id/versions/1.2.0/code
   ▼
Midas: status kode per komponen + per versi (ready / partial)
   ▼
Code Builder project memilih @midas/ui-cms@1.2.0
```

- Versi design dan versi paket kode **sama nomornya**.
- Selain semver, setiap publish punya nomor urut `seq` (1, 2, 3, …). Studio memakai `seq` untuk mendeteksi "update tersedia" dan mencatat versi yang dipakai sebuah file; semver dipakai untuk paket kode.
- `id` library = id file design system sumbernya (satu file = satu library). Layer salinan komponen library di file lain menyimpan `libRef = <libraryId>:<nodeId>`, sehingga instance tetap tersambung setelah update.
- Status per komponen (`midas report`, dijalankan setelah build): **Ready** (di-export dan props sesuai desain), **Not implemented** (tidak di-export, atau masih kerangka `midasStub`), **Mismatch** (ada prop desain yang tidak diterima props komponen — dicek dengan TypeScript: untuk setiap prop di `src/generated/props`, tipe desainnya harus bisa diberikan ke prop komponen dengan nama sama; `testId` tidak dicek). Status versi: **ready** bila semua komponen ready, **partial** bila tidak, **pending** sebelum ada laporan. Ditampilkan di panel Library dan dialog **Developer kit** di Studio.
- Code Builder hanya bisa memilih versi yang paketnya sudah ter-publish. Instance komponen berstatus *Not implemented* ditampilkan sebagai **Issue** (§4.6).
- Komponen berawalan `_` atau `.` = **bagian internal** (atom yang dirakit komponen lain, mis. `_Option` di SelectField): ikut snapshot library agar instance tetap tersambung, tetapi tidak dipetakan ke kode, tidak masuk Library Kit, dan disembunyikan dari Assets file pemakai.
- Breaking change memaksa kenaikan versi **major**: komponen/prop dihapus atau diganti nama, nilai variant dihapus, tipe prop berubah, **token (Variable) dihapus**, **ikon atau gaya ikon dihapus**.

### 3.6. Private Registry (Verdaccio)

- Registry memakai **Verdaccio** (registry npm private, open source), bukan npm publik dan bukan server `.tgz` buatan sendiri. Alasan: `npm publish`/`npm install` berjalan standar, mendukung semver, sudah punya auth dan penyimpanan tarball.
- Semua paket library memakai scope `@midas/`; scope ini diarahkan ke registry Midas, paket lain tetap dari npm publik.
- Project hasil generate membawa `.npmrc`:

```text
@midas:registry=https://<registry-host>/
//<registry-host>/:_authToken=${MIDAS_REGISTRY_TOKEN}
```

dan dependency dengan nama paket library yang dipilih project:

```json
{
  "dependencies": {
    "@midas/ui-cms": "1.2.0"
  }
}
```

- Generator menulis versi **pasti** (tanpa `^`), sehingga upgrade versi dilakukan **eksplisit** per project dan update design system tidak merusak project lama.
- Hak akses: CI library punya token publish; developer project hanya token read.

---

## 4. Modul 2: Code Builder

### 4.1. Konsep

**Code Builder Project** = satu aplikasi hasil generate. Isinya:

- **Module** — satu folder di `src/modules/` (bisa parent-child). Satu Module bersumber dari satu Page di Midas.
- **Screen** — satu Frame di canvas yang didaftarkan ke Module, dengan **peran (role)** tertentu.

| Role Screen | Keterangan | Contoh Frame |
| --- | --- | --- |
| `list` | Tabel data + search/filter + aksi baris | User List |
| `create` | Form tambah data | User Form Create |
| `edit` | Form ubah data (bisa memakai Frame yang sama dengan `create`) | User Form Edit |
| `view` | Detail read-only | User Detail |
| `custom` | Halaman non-CRUD: dashboard, laporan, landing, halaman informasi, settings | Dashboard |

Tipe Module:
- **CRUD module** — memiliki entity + minimal satu screen `list`/`create`/`edit`/`view`. Output mengikuti pola penuh `region/` (§5.4).
- **Custom module** — hanya berisi screen `custom`. Output berisi `pages/` + `components/` + `i18n/`, dan `api/`/`hooks/`/`types/` hanya bila ada data binding (§5.5).

Satu Module boleh mencampur screen CRUD dan `custom` (mis. modul `order` punya list/create/view + `order-summary` custom).

### 4.2. Alur Pendaftaran

1. Desainer menggambar Frame di canvas dalam satu Page (mis. Page `User` berisi Frame *User List*, *User Form*, *User Detail*).
2. Buka menu **Code Builder** (left rail, di bawah Plugins) → buat / pilih Code Builder Project, lalu pilih **library + versi** yang dipakai (mis. `@midas/ui-cms@1.2.0`; hanya versi yang paket kodenya sudah ter-publish).
3. **Add Module**: pilih Page sumber, isi `moduleName` (kebab-case), `label`, parent (opsional, untuk parent-child), dan `permissionKey` base (default = `moduleName`).
4. **Register Screen**: pilih Frame di Page tersebut lalu tentukan role-nya (§4.1). Untuk CRUD module, isi **Entity Fields** (nama, tipe, required, sortable, filterable) — field ini dipakai untuk `types/`, `validation/`, mock, dan kolom tabel.
5. Atur Props, Data, dan Behavior per node lewat Properties Inspector (§4.4).
6. **Preview App** (§4.5), lalu **Generate** (§6).

### 4.3. Layout Workspace

```text
+----------------------------------------------------------------------------------------------+
| [ Midas ]  Code Builder · Project: CMS User Management       [ Preview App ] [ Generate ]   |
+------------------+-------------------------------------------+-------------------------------+
| SIDEBAR KIRI     | AREA TENGAH (Live DOM Renderer)           | PROPERTIES INSPECTOR          |
|                  |                                           |                               |
| 📦 CMS User      |  [ 📄 User List · role: list ]            | Node: Table (DataTable)       |
|  └ 📂 user-mgmt  |  +-------------------------------------+  |                               |
|     ├ 📂 user    |  | Search: [Cari user...      ]        |  | ⚙️ Props                      |
|     │ ├ 📄 List  |  +-------------------------------------+  |  Pagination: ☑  Size: [10 ▼]  |
|     │ ├ 📄 Form  |  | Nama  | Email  | Role   | Aksi      |  |                               |
|     │ └ 📄 Detail|  | Budi  | b@mail | Admin  | [✎][🗑]   |  | 🔌 Data                       |
|     └ 📂 role    |  +-------------------------------------+  |  Source: entity `user` (list) |
|  └ 📄 Dashboard  |                                           |  Columns: ☑ name ☑ email      |
|     (custom)     |                                           |                               |
| ➕ Add Module    |                                           | 🔗 Behavior                   |
| ➕ Register Frame|                                           |  Row action Edit ➔ screen edit|
| ⚠️ Issues (2)    |                                           |  Button Create ➔ screen create|
+------------------+-------------------------------------------+-------------------------------+
```

- **Page-per-page focus:** satu screen dibuka dalam satu waktu.
- **Live DOM Renderer:** Frame dirender memakai komponen asli dari paket library yang dipilih project, mis. `@midas/ui-cms` (bukan objek canvas statis), sehingga yang dilihat = hasil kode.
- **Issues panel:** daftar node yang tidak bisa dipetakan ke kode (§4.6) dan konfigurasi wajib yang belum diisi.

### 4.4. Properties Inspector

Inspector hanya mengatur **props fungsional, data, dan behavior** — properti visual tetap diatur di tab Design. Kontrol inspector dibangkitkan dari **manifest props** komponen library (§3.3). Contoh:

- **Button**
  - Props: `variant` (`primary`, `secondary`, `destructive`, `outline`, `ghost`), `disabled`, `loading`, label (i18n key), `icon` + posisi.
  - Behavior: `Submit Form`, `Navigate to Screen`, `Open Dialog`, `Call Action` (delete, restore, export, bulk upload, atau custom endpoint).
  - Permission: aksi diikat ke permission key (mis. `user.create`) → tombol hanya tampil bila `can()` true.
- **Table**
  - Data: entity list (CRUD) atau data source custom; pagination, sorting.
  - Columns: urutan, visibilitas, lebar, format (`text`, `badge`, `date`, `currency`, `relation`).
  - Row actions: `view`, `edit`, `delete`, `restore` (+ permission).
- **FilterToolbar / Search**: field yang di-search, filter (`select`, `date-range`, …), sumber opsi.
- **Form & Field**
  - Field binding: key payload (`name`, `email`, `role`).
  - Tipe field: komponen Field dari library (§3.4).
  - Grid: `col-span` 1–12.
  - Validation: `required`, `minLength`, `maxLength`, `min`, `max`, `pattern`, pesan error (i18n).
  - Sumber opsi (select/radio/checkbox group): statis atau endpoint.
- **Custom screen (non-CRUD)**: setiap komponen yang menampilkan data (Card statistik, Table, chart, dst.) dapat diberi **Data Source** (§4.7).
- **Text** (semua screen): teks otomatis menjadi i18n key (en/id); inspector menyediakan terjemahan.

### 4.5. Preview App (pengganti Prototype)

- Menjalankan seluruh screen dengan routing nyata, auth mock, dan data mock — sama dengan perilaku project hasil generate saat `USE_MOCK` aktif.
- Navigasi antar-screen berasal dari Behavior (`Navigate to Screen`, row action, submit sukses → kembali ke list), bukan dari koneksi prototype.

### 4.6. Pemetaan Node Canvas → Kode

| Node di canvas | Hasil di kode |
| --- | --- |
| Instance komponen library | Komponen dari paket library project (mis. `@midas/ui-cms`) dengan props dari variant + inspector |
| Frame dengan auto layout | `div` dengan utility Tailwind (`flex`/`grid`, `gap`) dan class spacing semantik bila cocok (`.stack-gap`, `.field-gap`, `.page-padding`) |
| Text | Teks lewat `t('<modul>.<key>')` (i18n), styling dari token tipografi |
| Warna/fill | Hanya lewat token tema/variables; nilai hex mentah → **Issue** |
| Shape/vector/gambar bebas yang bukan komponen | Image/SVG asset bila ditandai sebagai aset; selain itu → **Issue** (tidak di-generate) |
| Frame tanpa auto layout (posisi absolut) | **Issue**: minta diubah ke auto layout |

Prinsip: generator tidak pernah membuat ulang HTML/CSS komponen library.

### 4.7. Data Source untuk Screen Custom

Screen `custom` dapat memakai data dari:
- **Entity CRUD** yang sudah ada di project (mis. jumlah user dari modul `user`).
- **Custom endpoint**: method, path, params, bentuk response. Generator membuat `service.ts` + `mock.ts` + query hook seperti pola CRUD, dengan mock data yang bisa diisi dari Builder.
- **Static**: data tetap di komponen (mis. halaman informasi).

---

## 5. Modul 3: Pakem Base Code

### 5.1. Stack

React 19, TypeScript, Vite, Tailwind CSS 4, TanStack Query, React Hook Form, react-router 7, i18next/react-i18next, axios. Package manager npm, Node 22.

### 5.2. Base project (ikut setiap project baru)

Saat Code Builder Project dibuat, sistem menyiapkan base project bersih: tooling + shell, **tanpa** komponen UI/layout (keduanya dari library). Template-nya ada di `templates/base-project` (workspace monorepo, ikut typecheck & build): login mock (`admin` / `admin123`), dashboard, `AppShell` dari library, i18n en/id dengan `registerUiLocales(i18n, 'general')`, dan `src/index.css` cukup `@import 'tailwindcss'; @import '@midas/ui-base/tailwind.css';`.

```text
<project>/
├── package.json             # tooling + paket library terpilih, mis. @midas/ui-cms (versi pasti)
├── .npmrc                   # scope @midas → Midas Registry (§3.6)
├── .env.example             # VITE_API_BASE_URL, MIDAS_REGISTRY_TOKEN
├── index.html
├── vite.config.ts
├── tsconfig*.json
├── AGENTS.md                # aturan project untuk coding agent
└── src/
    ├── main.tsx
    ├── App.tsx              # QueryClient + Theme + Toast + Router providers
    ├── index.css            # Tailwind v4 + import CSS library
    ├── app/
    │   ├── router.tsx       # anchor: // __GENERATOR_IMPORTS__, // __GENERATOR_ROUTES__
    │   ├── navigation.tsx   # anchor: // __GENERATOR_NAV_ITEMS__
    │   ├── ProtectedAppShell.tsx
    │   └── providers/       # AuthProvider, useAuth, RequireAuth, PermissionGate
    ├── modules/
    │   ├── auth/login/      # login (mock/real)
    │   └── dashboard/       # halaman awal default
    └── shared/              # tipis — tanpa UI/layout
        ├── components/form/ # FormGroup, FormItem, FormArray, FormDefaultValuesWatcher
        ├── lib/             # api.ts (axios), queryClient.ts
        ├── hooks/           # useDebounce, useUrlPagination, useConfirmNavigation, …
        ├── utils/           # submitError (mapSubmitError), excel, validators
        ├── types/           # api (ApiResponse, ApiList, ApiDetail), auth, form, navigation
        ├── constants/
        └── i18n/            # init i18next + addModuleLocales + locales general en/id
```

### 5.3. Aturan umum

- Arah dependensi: `modules` → `shared` / library. `shared` tidak boleh import dari `modules`.
- File JSX berekstensi `.tsx`.
- Token tema dari library; dilarang hardcode warna.
- Spacing pakai class semantik (`.page-padding`, `.section-gap`, `.stack-gap`, `.field-gap`); angka Tailwind hanya untuk penyimpangan khusus.
- Setiap elemen penting punya `data-testid` / `testId` dengan pola `<modul>-<elemen>`.
- Form selalu tersusun `FormGroup` → `FormItem` / `FormArray` → komponen Field library.
- Semua teks lewat i18n (en + id).
- Response API memakai envelope `{ response_schema: { response_code, response_message }, response_output }`; list memakai `ApiList` (`list.pagination` + `list.content`).
- Modul bisa parent-child: parent hanya namespace folder/menu, isi nyata di child.

### 5.4. Struktur CRUD module

Mengikuti modul referensi `contoh_base_code/src/modules/region/`:

```text
src/modules/<parent>/<modul>/          # <parent>/ opsional
├── index.ts                 # export Page* + addModuleLocales(en, id)
├── permissions.ts           # <Modul>Permissions: view/create/update/delete/bulk_upload/export
├── types/index.ts           # <Entity>, <Entity>ListItem, Create<Entity>Payload, Get<Entity>sParams, …
├── api/
│   ├── service.ts           # axios ke endpoint real (/api/v1/<resource>)
│   ├── mock.ts              # USE_MOCK per aksi + mock store
│   ├── resolver.ts          # pilih mock / service per aksi (nama export sama)
│   ├── queries.ts           # use<Entity>ListQuery, use<Entity>DetailQuery, opsi field
│   ├── mutations.ts         # useUpsert<Entity>, useDelete<Entity>, useRestore<Entity>, useBulkUpload<Entity>
│   └── index.ts
├── hooks/                   # use<Entity>List, use<Entity>ListFilter, use<Entity>Form, use<Entity>Export
├── components/              # <Entity>Table, <Entity>Form, <Entity>BulkUploadDialog
├── pages/                   # <Entity>ListPage, <Entity>CreatePage, <Entity>EditPage, <Entity>ViewPage
├── validation/              # <entity>Validation.ts (rules RHF per field), <entity>BulkValidation.ts
└── i18n/                    # en.json, id.json
```

Pembagian tanggung jawab:
- **pages/** — tipis: ambil state dari hooks, susun komponen, cek permission (`useAuth().can`).
- **hooks/** — state layar (filter, paginasi, dialog konfirmasi, submit, toast, error mapping).
- **api/** — akses data saja; `queries`/`mutations` tidak tahu sumbernya mock atau real.
- **components/** — komposisi komponen library sesuai gambar di canvas.

Endpoint standar (prefix `/api/v1/<resource>`): `GET` list, `GET /:id`, `POST`, `PUT /:id`, `DELETE /:id`, `PATCH /:id/restore`, `GET /export`, `POST /bulk-upload`, `GET /bulk-template`. Fitur yang tidak dipilih tidak di-generate.

### 5.5. Struktur Custom module (non-CRUD)

```text
src/modules/<modul>/
├── index.ts                 # export Page* + addModuleLocales
├── permissions.ts           # minimal <modul>.view (bila halaman perlu dibatasi)
├── pages/                   # <Nama>Page.tsx per screen custom
├── components/              # potongan UI yang dipakai ulang di halaman
├── i18n/                    # en.json, id.json
├── api/                     # hanya bila ada Data Source endpoint (pola service/mock/resolver/queries)
├── hooks/                   # hanya bila ada state/data
└── types/                   # hanya bila ada Data Source endpoint
```

Screen `custom` di dalam CRUD module ikut di `pages/` modul tersebut.

### 5.6. Contoh output

`pages/UserListPage.tsx` (CRUD, disingkat):

```tsx
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Plus } from 'lucide-react';
import { Card, Button, FilterToolbar } from '@midas/ui-cms'; // nama paket library yang dipilih project
import { useAuth } from '../../../../app/providers';
import { useUserList, useUserListFilter } from '../hooks';
import { UserTable } from '../components';
import { UserPermissions } from '../permissions';

function UserListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = useAuth();
  const filter = useUserListFilter();
  const list = useUserList(filter.queryParams);

  return (
    <div data-testid="user-list-page">
      <Card
        testId="user-list-card"
        title={t('runtime.listTitle', { singular: t('user.label') })}
        actions={
          can(UserPermissions.create) && (
            <Button data-testid="user-create-button" icon={<Plus />} onClick={() => navigate('/user-management/user/create')}>
              {t('runtime.createTitle', { singular: t('user.label') })}
            </Button>
          )
        }
      >
        <FilterToolbar
          testId="user-filter"
          searchValue={filter.searchQuery}
          onSearchChange={filter.handleSearchChange}
          filterFields={filter.filterFields}
          filterValues={filter.filterValues}
          onApply={filter.handleApply}
          onReset={filter.handleReset}
        />
        <UserTable data={list.users} totalRecords={list.totalRecords} isLoading={list.isLoading} onDelete={list.handleDeleteClick} />
      </Card>
    </div>
  );
}

export default UserListPage;
```

`components/UserForm.tsx` (inti susunan form):

```tsx
<FormGroup<FormValues> testId="user-form" defaultValues={defaultValues} onSubmit={handleSubmit}>
  {() => (
    <div className="grid grid-cols-12 field-gap">
      <div className="col-span-6">
        <FormItem name="name" label={t('user.fields.name.label')} rules={getNameRules(t)} testId="user-name">
          <TextField placeholder={t('user.fields.name.placeholder')} />
        </FormItem>
      </div>
    </div>
  )}
</FormGroup>
```

---

## 6. Generate & Registrasi

Saat klik **Generate**:

1. Validasi: tidak ada Issue blocking (§4.6), semua screen punya role, CRUD module punya entity fields, nama modul unik.
2. Tulis file modul sesuai §5.4 / §5.5. Target tulis dibatasi di `src/modules/`; file yang sudah ada tidak ditimpa tanpa konfirmasi overwrite.
3. Registrasi otomatis di shell:
   - Import + routes di `src/app/router.tsx` (anchor `// __GENERATOR_IMPORTS__`, `// __GENERATOR_ROUTES__`), dengan `handle.breadcrumb` dan `handle.requiredPermission`.
   - Item menu di `src/app/navigation.tsx` (anchor `// __GENERATOR_NAV_ITEMS__`), di bawah parent bila ada.
4. Tulis paket library yang dipilih project beserta versinya (versi pasti, mis. `"@midas/ui-cms": "1.2.0"`) di `package.json`, plus `.npmrc` (§3.6). Semua import komponen di kode hasil generate memakai nama paket tersebut.
5. Generator berjalan **di browser** (TypeScript murni, tanpa backend) dan menghasilkan **Download .zip** project lengkap (JSZip). **Push ke repo** dijalankan lewat backend (§7.4) pada fase lanjut.
6. Hasil wajib lolos `npm run lint` dan `npm run build`.

Generate ulang modul yang sama menimpa file hasil generate milik modul itu (setelah konfirmasi) dan tidak menggandakan registrasi route/nav.

---

## 7. Backend & Penyimpanan

### 7.1. Prinsip: server sebagai sumber data

Midas berpindah dari **local-first (IndexedDB)** menjadi **server-first**: semua data kerja (file desain, library, Code Builder project, aset) disimpan di backend — **PostgreSQL** untuk data terstruktur dan **object storage** untuk file biner. IndexedDB tidak lagi menjadi penyimpanan data.

Alasan:
- Fitur inti memang butuh data bersama: library dipakai lintas file/project, Code Builder, CI, registry.
- Menghapus kompleksitas sinkron local-first (antrean perubahan, merge offline, konflik dua arah).
- Satu sumber kebenaran untuk semua user dan device.

Konsekuensi yang diterima:
- Midas **wajib login dan online** untuk dipakai.
- Autosave berjalan lewat jaringan (§7.6).

Yang tetap berjalan di browser: engine canvas, Code Builder (state di memori), **Base Code Generator** dan **Preview App** (§6, §4.5).

### 7.2. Komponen backend

| Komponen | Teknologi (usulan) | Tanggung jawab |
| --- | --- | --- |
| Midas API | Node.js (Fastify/NestJS) + TypeScript | REST API, auth, file desain, library, Code Builder project |
| Database | PostgreSQL | User, workspace, file desain (meta + page JSONB), library, mapping, builder project |
| Object storage | S3-compatible (lokal: SeaweedFS, karena MinIO tidak lagi menyediakan image Docker publik; produksi: S3/penyedia S3-compatible) | Aset gambar/ikon, thumbnail, snapshot design system per versi, Library Kit, bundle library untuk Studio |
| Registry | Verdaccio | Tarball setiap paket library (`@midas/ui-*`) per versi |
| CI library | Pipeline di setiap repo paket library | Sync Library Kit, build, bundle ESM, `npm publish`, lapor versi ke Midas API |
| Midas CLI | `@midas/cli` | `sync` Library Kit ke repo paket (§3.3) |

### 7.3. Model data

Struktur penyimpanan mengikuti pembagian yang sudah dipakai `projectStorage` di `src/storage.js` (meta file terpisah dari isi per page, aset terpisah), sehingga engine canvas tidak perlu diubah.

| Sekarang (IndexedDB key) | Postgres / object storage |
| --- | --- |
| `file:<id>:meta` | `design_files` (`meta JSONB`: nama, `pageMeta`, tokens, variables, thumbnail) |
| `file:<id>:page:<pageId>` | `design_file_pages` (`nodes JSONB` per page) |
| aset | object storage + metadata di `assets` |
| `last`, `libraries`, `library:*`, `libuse:*` | `user_kv` (state editor per user) |
| `settings` (tema, grid, sidebar, plugin) | tetap `localStorage` (preferensi per browser) |

```text
users                (id, email, name, password_hash/sso, created_at)
workspaces           (id, name)
workspace_members    (workspace_id, user_id, role: owner | editor | viewer)

design_files         (id, workspace_id, name, meta JSONB, version, thumbnail_asset_id,
                      created_by, created_at, updated_at, deleted_at)
design_file_pages    (file_id, page_id, name, parent_id, sort_order, nodes JSONB,
                      version, updated_by, updated_at)                -- PK (file_id, page_id)
assets               (id, file_id, storage_key, mime, size, hash, created_at)
user_kv              (user_id, key, value)                          -- state editor per user
sessions             (id, user_id, expires_at)                     -- sesi login (cookie httpOnly)

libraries            (id = id file sumber → design_files, workspace_id, name,
                      package_name UNIQUE, created_by, created_at)
library_versions     (id, library_id, seq, version (semver), release_notes, snapshot_key,
                      components_count, variables_count, manifest JSONB,
                      design_status: published | deprecated,
                      code_status: pending | ready | partial, bundle_url, published_by, published_at)
                      -- UNIQUE (library_id, seq) dan (library_id, version)
component_mappings   (library_version_id, component_key, component_name, export_name, props_map JSONB,
                      code_status: ready | not_implemented | mismatch)
file_libraries       (file_id, library_id, seq)                       -- library yang di-enable di file + versi yang dipakai

builder_projects     (id, workspace_id, name, file_id → design_files, library_id → libraries, library_version (semver),
                      config JSONB, version, created_by, created_at, updated_at)
                      -- config = { modules: [{ id, name (kebab), label, parentId, permissionKey, pageId,
                      --            entity: { fields: [...] }, screens: [{ id, frameId, pageId, name, role }] }] }
```

Catatan:
- `nodes` disimpan per page agar autosave hanya menulis page yang berubah, bukan seluruh file.
- Aset dideduplikasi lewat `hash`; Postgres hanya menyimpan metadata + `storage_key`.
- Snapshot design system per versi library disimpan **immutable** di object storage (`snapshot_key`), sehingga file yang memakai versi lama tidak terpengaruh perubahan file sumber.

### 7.4. Endpoint utama

| Area | Endpoint | Keterangan |
| --- | --- | --- |
| Auth | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` | Session cookie (httpOnly) |
| | `POST /api/auth/tokens` | Token CLI/CI (`mdt_…`, berlaku `TOKEN_DAYS`), dikirim sebagai `Authorization: Bearer` — dipakai `midas login` dan CI |
| Files | `GET /api/files`, `POST /api/files` | Daftar & buat file desain |
| | `GET /api/files/:id` | Meta file + daftar page (tanpa `nodes`) |
| | `PATCH /api/files/:id` | Update meta (nama, tokens, variables, urutan page); body membawa `version` |
| | `DELETE /api/files/:id` | Soft delete |
| | `GET /api/files/:id/pages/:pageId` | Isi satu page (`nodes`) — dimuat saat page dibuka |
| | `PUT /api/files/:id/pages/:pageId` | Simpan satu page; body membawa `version` |
| | `DELETE /api/files/:id/pages/:pageId` | Hapus page |
| | `POST /api/files/:id/assets` | Upload aset (multipart) → `{ id, url }` |
| | `GET /api/files/:id/export` | Unduh file portabel `.midas` (pengganti Export lokal) |
| | `POST /api/files/import` | Import file `.midas` / migrasi dari IndexedDB (§7.7) |
| Library | `GET /api/libraries` | Daftar library di workspace + versi terbaru + status kode |
| | `GET /api/libraries/:id` | Detail library + riwayat versi |
| | `GET /api/libraries/:id/snapshot?seq=` | Snapshot desain (default versi terbaru) — dipakai file lain untuk menyalin komponen & variables |
| | `POST /api/libraries/:id/draft` | Bahan form publish: mapping default (digabung dengan mapping versi sebelumnya), saran nama paket & versi, daftar breaking change |
| | `GET /api/libraries/package-available?name=` | Cek format & ketersediaan nama paket |
| | `POST /api/libraries/:id/versions` | **Publish Library**: buat library pada publish pertama (nama paket dikunci), validasi semver + breaking change, simpan snapshot & mapping |
| | `GET /api/libraries/:id/versions/:version/mappings` | Component mapping satu versi |
| | `POST /api/libraries/import-legacy` | Pindahkan library dari penyimpanan lama (`user_kv` / IndexedDB) |
| | `GET /api/libraries/resolve?package=` | Cari library dari nama paket (dipakai CLI) |
| | `GET /api/libraries/:id/kit?version=` | Library Kit satu versi (default terbaru) sebagai `{ files }` — dipakai `midas sync` |
| | `GET /api/libraries/:id/scaffold?version=&format=zip` | Kerangka repo paket (§3.4) + Library Kit; JSON untuk `midas init`, zip untuk tombol **Developer kit** di Studio |
| | `POST /api/libraries/:id/versions/:version/code` | Laporan `midas report` (token CI): `{ components: [{ exportName, status, detail? }], bundleUrl? }` → status per komponen + versi |
| | `GET /api/libraries/:id/versions/:version/code` | Status kode per komponen satu versi (Studio) |
| | `GET/PUT /api/files/:id/libraries` | Library yang dipakai sebuah file desain + versi (`seq`) yang dipakai |
| | `PUT /api/libraries/:id/versions/:version/bundle` | Unggah bundle ESM + CSS untuk Studio (`midas bundle`) → `bundle_url` (dengan hash isi) |
| | `GET /api/libraries/:id/versions/:version/bundle/index.js\|style.css` | Sajikan bundle (cache `immutable`) |
| Code Builder | `GET/POST /api/builder-projects`, `GET/PUT/DELETE /api/builder-projects/:id` | Konfigurasi project/module/screen; `GET ?fileId=` per file; `PUT` membawa `version` (409 bila basi) |
| | `POST /api/builder-projects/:id/push` | (Fase lanjut) push hasil generate ke Git; token Git disimpan di server |
| State editor | `GET /api/kv?prefix=`, `GET/PUT/DELETE /api/kv/:key` | State editor per user (`user_kv`) |
| | `GET /api/auth/status`, `POST /api/auth/register` | Cek apakah pendaftaran dibuka; akun pertama selalu boleh daftar |

### 7.5. Library di dalam Midas Studio

Live DOM Renderer (§4.3) dan Preview App (§4.5) butuh komponen library asli di browser:
- `midas bundle` (di repo paket, setelah `npm run build`) membangun **bundle ESM** + CSS per versi dengan Vite milik repo: semua dependency ikut dibundel **kecuali React** (`react`, `react-dom`, `react/jsx-runtime`). CSS Tailwind paket dikompilasi penuh (`source(none)` + `@source` paket); font yang di-inline dipangkas ke subset latin. Hasil diunggah ke object storage; URL-nya (dengan hash isi) disimpan di `library_versions.bundle_url`.
- Studio memuat bundle sesuai library + versi Code Builder project: import React di bundle diarahkan ke modul shim yang mengekspor React milik Studio (satu instance, hook & context bekerja), lalu `import()` dari blob URL. Bundle immutable per versi sehingga di-cache browser.
- Entry bundle juga mengekspor `__midasRuntime` (router data `createMemoryRouter`/`RouterProvider`, `I18nextProvider`, `i18next`) bila paket memakainya, untuk membungkus screen.
- Komponen yang butuh data di kode (kolom tabel, menu sidebar, handler) mengambil contoh props dari export **`midasPreview`** paket (`{ [exportName]: props }`); props dari desain menimpanya.
- Manifest props dari versi yang sama dipakai untuk merender kontrol Properties Inspector.

### 7.6. Autosave & konflik

- **Load:** buka file → `GET /api/files/:id` (meta) + `GET /api/files/:id/pages` (semua page) + daftar aset. Target berikutnya: page lain dimuat saat dibuka (lazy) lewat `GET .../pages/:pageId`, karena engine saat ini masih memuat seluruh page sekaligus.
- **Autosave:** perubahan ditahan di memori dan dikirim dengan debounce ±1,5 detik **per page yang berubah** (`PUT .../pages/:pageId`); perubahan meta (nama, variables, urutan page) lewat `PATCH /api/files/:id`. Indikator di top bar: *Saving… / Saved / Offline — changes pending*.
- **Optimistic concurrency:** setiap request simpan membawa `version` terakhir yang diketahui; server menolak dengan **409 Conflict** bila versi server lebih baru. Studio lalu menawarkan **Reload** (ambil versi server) atau **Save as copy**.
- **Koneksi putus:** perubahan yang belum terkirim disimpan sementara di memori (dan opsional di `localStorage`/IndexedDB sebagai **buffer pemulihan**, bukan penyimpanan data), lalu dikirim ulang otomatis saat online. Menutup tab dengan perubahan pending memunculkan peringatan.
- **Kolaborasi real-time** (multi-cursor, edit bersamaan di page yang sama) di luar cakupan tahap ini; untuk itu nantinya penyimpanan beralih ke log operasi per perubahan.

### 7.7. Migrasi dari IndexedDB

- `projectStorage` di `src/storage.js` diganti dengan **API client** yang mempertahankan fungsi yang sama (`loadProject`, `saveProject`, `saveActivePage`, `deleteProject`, `exportProject`), sehingga engine canvas tidak berubah. `getQuota` dihapus.
- **Import sekali jalan:** setelah login pertama, bila browser masih punya file di IndexedDB, Studio menampilkan dialog *"Ditemukan N file lokal — import ke workspace?"* → setiap file dikirim lewat `POST /api/files/import` (meta + pages + aset). File lokal yang sudah ter-import ditandai dan bisa dihapus dari browser setelah user konfirmasi.
- Format file portabel `.midas` (Export/Import) tetap didukung untuk backup dan pindah antar workspace.

### 7.8. Tahapan backend

1. **Tahap 1 (bersama Phase 1):** Midas API + Postgres + object storage: auth, workspace sederhana, **file desain & aset** (§7.6), migrasi IndexedDB (§7.7), library + versi + mapping + Library Kit + status kode. Verdaccio + bundle library untuk Studio.
2. **Tahap 2 (bersama Phase 2–4):** Code Builder project tersimpan di server.
3. **Tahap 3:** Push ke Git, manajemen workspace/member & hak akses, kolaborasi real-time.

---

## 8. Milestones

1. **Phase 1 — Design System Library & Registry** ✅ (kecuali bundle ESM untuk Studio — dipindah ke Phase 2 bersama Live DOM Renderer)
   - Fitur **Publish Library** di Midas: form nama library + nama paket + versi + Component Mapping; library bisa di-enable di file lain (Assets → Libraries).
   - Generator **Library Kit** (theme dari Variables, tipe props + manifest dari component properties) + kerangka repo paket + `@midas/cli sync`.
   - Library pertama: pindahkan UI/layout dari `contoh_base_code` ke repo paket (mis. `@midas/ui-cms`) memakai Library Kit.
   - Setup Verdaccio + CI publish library (build, manifest props, bundle ESM untuk Studio).
   - Midas API tahap 1 (§7.8): auth, Postgres + object storage, file desain & aset di server (autosave per page), migrasi dari IndexedDB, Library + versi + nama paket, Component Mapping, status kode per komponen.
   - Base project template (§5.2) yang memakai library lewat `.npmrc`.
2. **Phase 2 — Midas Shell & Code Builder Workspace** ✅
   - ✅ Hapus tab Prototype; tambah menu Code Builder di bawah Plugins.
   - ✅ Bundle ESM library untuk Studio (`midas bundle` → `PUT …/bundle`, dimuat Live DOM Renderer).
   - ✅ Project → Module → Register Frame + role, entity fields (backend tahap 2: `builder_projects`); Live DOM Renderer (iframe, komponen asli library, klik → pilih layer di canvas); Issues panel (pemetaan §4.6 + konfigurasi project).
3. **Phase 3 — Properties Inspector & Behavior**
   - Inspector dari manifest props; data binding entity/custom endpoint; behavior (navigate, submit, action); permission per aksi; i18n teks.
   - Preview App (routing + mock).
4. **Phase 4 — Base Code Generator**
   - Generator CRUD module (§5.4) dan Custom module (§5.5); registrasi router/nav; export zip.
   - Verifikasi otomatis hasil: lint + build.
5. **Phase 5 — Kolaborasi & Integrasi Git**
   - Backend tahap 3 (§7.8): push ke Git, workspace & member + hak akses, kolaborasi real-time.
