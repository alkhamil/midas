# Integrasi modul Region

File ini dibuat otomatis oleh generator. Hapus setelah modul terintegrasi.

## 1. Salin folder modul (otomatis)

Folder `src/modules/region/` sudah ditulis langsung ke repo oleh dev-server saat klik Generate.
Jika generate di luar dev-server (copy/download manual), salin folder tersebut ke repo.

## 2. Routes (otomatis)

Sudah didaftarkan otomatis di `src/app/router.tsx` saat generate via dev-server.
Referensi manual bila perlu:

```tsx
import {
  RegionListPage,
  RegionCreatePage,
  RegionViewPage,
  RegionEditPage,
} from '../modules/region';

// di dalam children AppShell, sebelum catch-all:
      {
        path: 'regions',
        element: <RegionListPage />,
        handle: {
          breadcrumb: [{ label: 'Regions', labelKey: 'region.breadcrumbs.list' }],
          requiredPermission: 'region.view',
        },
      },
      {
        path: 'regions/create',
        element: <RegionCreatePage />,
        handle: {
          breadcrumb: [{ label: 'Regions', labelKey: 'region.breadcrumbs.list', path: '/regions' }, { label: 'Create', labelKey: 'region.breadcrumbs.create' }],
          requiredPermission: 'region.create',
        },
      },
      {
        path: 'regions/:regionId/view',
        element: <RegionViewPage />,
        handle: {
          breadcrumb: [{ label: 'Regions', labelKey: 'region.breadcrumbs.list', path: '/regions' }, { label: 'Detail', labelKey: 'region.breadcrumbs.detail' }],
          requiredPermission: 'region.view',
        },
      },
      {
        path: 'regions/:regionId/edit',
        element: <RegionEditPage />,
        handle: {
          breadcrumb: [{ label: 'Regions', labelKey: 'region.breadcrumbs.list', path: '/regions' }, { label: 'Edit', labelKey: 'region.breadcrumbs.edit' }],
          requiredPermission: 'region.update',
        },
      },
```

## 3. Navigasi (otomatis)

Sudah ditambahkan otomatis di `src/app/navigation.tsx` saat generate via dev-server.
Referensi manual bila perlu:

```tsx
  {
    label: 'Regions',
    labelKey: 'region.labelPlural',
    path: '/regions',
    icon: <Database className="h-5 w-5" />,
    permissionKey: 'region.view',
  },
```

## 4. Permission keys (otomatis dari base `region`)

| Aksi | Key |
| --- | --- |
| Lihat list & detail + menu navigasi | `region.view` |
| Buat data | `region.create` |
| Ubah data | `region.update` |
| Hapus / restore data | `region.delete` |
| Bulk upload | `region.bulk_upload` |
| Export | `region.export` |

Konstanta tersedia di `permissions.ts` (`RegionPermissions`).
Pastikan permission user (mis. `localStorage["permissions"]`) memuat key di atas
agar menu dan aksi tampil.

## 5. API real (`api/service.ts`)

Saklar sumber data ada di `api/resolver.ts` via flag `USE_MOCK` (di `mock.ts`,
default semua `true` = mock lokal tanpa backend): ubah flag yang relevan menjadi
`false` untuk memakai Real API via `service.ts` (axios `shared/lib/api`).
Nama export resolver sama untuk kedua sumber, jadi `queries.ts`/`mutations.ts`
tidak perlu berubah.

Kontrak endpoint (contoh module regions):

| Aksi | Method & endpoint | Catatan |
| --- | --- | --- |
| List | `GET /api/v1/regions` | Query params sama seperti filter list; response `ApiList`. |
| Detail | `GET /api/v1/regions/:id` | Response entity. |
| Buat data | `POST /api/v1/regions` | Body JSON payload; response `{ message, data }`. |
| Ubah data | `PUT /api/v1/regions/:id` | Body JSON payload; response `{ message, data }`. |
| Hapus (soft) | `DELETE /api/v1/regions/:id` | Response `{ message }`. |
| Restore | `PATCH /api/v1/regions/:id/restore` | Response `{ message, data }`. |
| Export | `GET /api/v1/regions/export` | Query params sama seperti list; response blob `.xlsx`. |
| Bulk upload | `POST /api/v1/regions/bulk-upload` | Multipart field `file` (.xlsx); response `BulkUploadResult`. |
| Template bulk | `GET /api/v1/regions/bulk-template` | Response blob `.xlsx` template. |
| Opsi field | `GET` endpoint per field (lihat `service.ts`) | Response list opsi. |
Error mengikuti envelope axios `{ response: { status, data } }` agar
kompatibel dengan `mapSubmitError` (`response_output.errors` untuk field error).

## 6. Verifikasi

```bash
npm run lint && npm run build
```

Mock aktif secara default (`USE_MOCK` semua `true` di `api/mock.ts`).
Untuk memakai API real, ubah flag yang relevan menjadi `false`.
