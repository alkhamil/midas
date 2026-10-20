# SPEC: React Module Generator -> Visual Builder

## 1. Konteks Repo Saat Ini
- Stack: React (Vite / Next.js), TypeScript, Shadcn/Tailwind, Zustand, React Hook Form.
- Layout Standard (JANGAN DIUBAH):
    - `PageHeader`: Judul, breadcrumb, action button
    - `Sidebar`: Menu dinamis dari config
    - `PageContent`: Satu-satunya area yang boleh di-edit oleh Builder. Semua canvas drag-drop hanya di dalam sini.
- Struktur Module Saat Ini: `/modules/[moduleName]/pages/`, `components/`, `hooks/`, `services/`

## 2. Generator Lama (Existing)
Flow lama: Pilih parent menu -> Isi nama menu/module -> Isi permission key -> Pilih fitur [list, create, update, delete, bulk import, export] -> Tambah fields/columns (set filterable, sortable) -> Generate folder & file sesuai arsitektur.

## 3. Goal Baru: Hybrid Visual Builder (Wix-like tapi Guided)
Kita tidak menghapus generator lama. Kita upgrade jadi 3-step Canvas Builder.

**Flow Baru:**
1.  **Step Config:** Input: `parentMenu`, `moduleName`, `moduleLabel`, `permissionKey`, `features[]`, `baseFields[]`
2.  **Canvas 1 - Form Builder (Create/Edit):** Area `PageContent` yang bisa drag n drop Form Field. Fitur: atur grid 12 kolom (col-span), required, validation, relation.
        - Draggable Components: TextInput, NumberInput, Textarea, Select, DatePicker, Switch, Upload, Relation, Section, Divider
3.  **Test Add Data (Mock):** Setelah Canvas 1 selesai, user bisa coba isi form. Data disimpan di localStorage/Zustand dulu (mock).
4.  **Canvas 2 - List Builder:** Area `PageContent` untuk atur tampilan List. Fitur: drag untuk reorder kolom, toggle sortable, filterable, set width, atur Action [view detail, edit, delete, restore], set bulk action & export.
5.  **Canvas 3 - Detail Builder:** Layout detail view, gabungan Form read-only + Action + History/Timeline.

## 4. Output Generator (PENTING)
Saat klik Generate, hasilkan 2 hal:
A. Frontend Module: `form.schema.json`, `list.schema.json`, `detail.schema.json` + Page Renderer generik yang membaca schema tersebut.
B. API Contract untuk Backend: 1 file `api.contract.json`

Struktur `form.schema.json`:
{ grid: 12, fields: [{ id, type, name, label, span, required, validation }] }

Struktur `list.schema.json`:
{ columns: [{ name, label, sortable, filterable, width }], filters: [], actions: [], features: { pagination, export, bulkImport } }

Struktur `api.contract.json`:
{
  module: "products",
  menu: { parent, label, permissionKey },
  model: { name: "Product", fields: [{ name, type: "string|number|boolean|relation", required, filterable, sortable }] },
  endpoints: [
    { method: "GET", path: "/api/products", permission: "products.view", features: { pagination, search: [], filter: [], sort: [], export: bool } },
    { method: "POST", path: "/api/products", permission: "products.create" },
    { method: "PUT", path: "/api/products/:id", permission: "products.update" },
    { method: "DELETE", path: "/api/products/:id", permission: "products.delete" }
  ]
}

## 5. Aturan Mocking (Fase 1 - Tanpa Backend)
- Jangan panggil backend real. Simpan semua schema di Zustand store `useBuilderStore` + persist ke localStorage key `builder_[moduleName]`.
- Simpan data dummy hasil "Test Add Data" di localStorage key `data_[moduleName]`.
- List Builder harus membaca `data_[moduleName]` untuk preview table.
- Gunakan MSW atau fetcher mock yang membaca `api.contract.json` agar kontrak FE dan BE sinkron.

## 6. Library yang Harus Dipakai
- Drag n Drop: `dnd-kit` (@dnd-kit/core, @dnd-kit/sortable)
- Grid Layout (opsional untuk Form): `react-grid-layout`
- Form: `react-hook-form` + `zod`
- State: `zustand`

## 7. Task untuk Agent
1.  Buat store `useBuilderStore`.
2.  Buat Component Registry: `src/builder/registry.tsx`
3.  Buat `FormBuilderCanvas` dan `FormRenderer`
4.  Buat `ListBuilderCanvas` dan `ListRenderer`
5.  Buat fungsi `generateContract()` yang menghasilkan `api.contract.json` dari semua schema.
6.  Jangan ubah `PageHeader` dan `Sidebar`.
