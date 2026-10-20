import type { TemplateContext } from '../../engine/context';
import { buildRegistration } from '../../engine/registration';

export function moduleIndexTemplate(ctx: TemplateContext): string {
  const { names, features } = ctx;
  const lines: string[] = [];
  if (features.list)
    lines.push(`export { default as ${names.entity}ListPage } from './pages/${names.entity}ListPage';`);
  if (features.create)
    lines.push(
      `export { default as ${names.entity}CreatePage } from './pages/${names.entity}CreatePage';`,
    );
  if (features.detail)
    lines.push(`export { default as ${names.entity}ViewPage } from './pages/${names.entity}ViewPage';`);
  if (features.edit)
    lines.push(`export { default as ${names.entity}EditPage } from './pages/${names.entity}EditPage';`);
  // Locale didaftarkan mandiri dari index modul (aman dihapus bersama folder).
  // index.ts sedalam satu level dari root modul → prefix lebih pendek satu tingkat.
  const depth = names.dir.replace(/^src\/modules\//, '').split('/').filter(Boolean).length;
  const rootPrefix = '../'.repeat(depth + 1);
  lines.push(
    `import { addModuleLocales } from '${rootPrefix}shared/i18n';`,
    `import en${names.entity}Locale from './i18n/en.json';`,
    `import id${names.entity}Locale from './i18n/id.json';`,
    ``,
    `addModuleLocales({ en: [en${names.entity}Locale], id: [id${names.entity}Locale] });`,
  );
  return `${lines.join('\n')}\n`;
}

export function integrationTemplate(ctx: TemplateContext): string {
  const { names, permissions, features } = ctx;
  const reg = buildRegistration(ctx.config);
  const routes = reg.routes.map((route) => route.code).join('\n');
  const hasOptions = ctx.hasOptionsSelects || ctx.hasLoadOptionsSelects;

  return `# Integrasi modul ${names.entity}

File ini dibuat otomatis oleh generator. Hapus setelah modul terintegrasi.

## 1. Salin folder modul (otomatis)

Folder \`${names.dir}\` sudah ditulis langsung ke repo oleh dev-server saat klik Generate.
Jika generate di luar dev-server (copy/download manual), salin folder tersebut ke repo.

## 2. Routes (otomatis)

Sudah didaftarkan otomatis di \`src/app/router.tsx\` saat generate via dev-server.
Referensi manual bila perlu:

\`\`\`tsx
${reg.importBlock}

// di dalam children AppShell, sebelum catch-all:
${routes}
\`\`\`

## 3. Navigasi (otomatis)

Sudah ditambahkan otomatis di \`src/app/navigation.tsx\` saat generate via dev-server.
Referensi manual bila perlu:

\`\`\`tsx
${reg.navSnippet}
\`\`\`

## 4. Permission keys (otomatis dari base \`${permissions.base}\`)

| Aksi | Key |
| --- | --- |
| Lihat list & detail + menu navigasi | \`${permissions.view}\` |
| Buat data | \`${permissions.create}\` |
| Ubah data | \`${permissions.update}\` |
| Hapus / restore data | \`${permissions.delete}\` |
${features.bulkUpload ? `| Bulk upload | \`${permissions.bulkUpload}\` |\n` : ''}${features.export ? `| Export | \`${permissions.export}\` |\n` : ''}
Konstanta tersedia di \`permissions.ts\` (\`${names.entity}Permissions\`).
Pastikan permission user (mis. \`localStorage["permissions"]\`) memuat key di atas
agar menu dan aksi tampil.
${features.export || features.bulkUpload ? `
## 5. API real (\`api/service.ts\`)

Saklar sumber data ada di \`api/resolver.ts\` via flag \`USE_MOCK\` (di \`mock.ts\`,
default semua \`true\` = mock lokal tanpa backend): ubah flag yang relevan menjadi
\`false\` untuk memakai Real API via \`service.ts\` (axios \`shared/lib/api\`).
Nama export resolver sama untuk kedua sumber, jadi \`queries.ts\`/\`mutations.ts\`
tidak perlu berubah.

Kontrak endpoint (contoh module ${names.pluralKebab}):

| Aksi | Method & endpoint | Catatan |
| --- | --- | --- |
| List | \`GET /api/v1/${names.pluralKebab}\` | Query params sama seperti filter list; response \`ApiList\`. |
| Detail | \`GET /api/v1/${names.pluralKebab}/:id\` | Response entity. |
| Buat data | \`POST /api/v1/${names.pluralKebab}\` | Body JSON payload; response \`{ message, data }\`. |
| Ubah data | \`PUT /api/v1/${names.pluralKebab}/:id\` | Body JSON payload; response \`{ message, data }\`. |
| Hapus (soft) | \`DELETE /api/v1/${names.pluralKebab}/:id\` | Response \`{ message }\`. |
| Restore | \`PATCH /api/v1/${names.pluralKebab}/:id/restore\` | Response \`{ message, data }\`. |
${features.export ? `| Export | \`GET /api/v1/${names.pluralKebab}/export\` | Query params sama seperti list; response blob \`.xlsx\`. |\n` : ''}${features.bulkUpload ? `| Bulk upload | \`POST /api/v1/${names.pluralKebab}/bulk-upload\` | Multipart field \`file\` (.xlsx); response \`BulkUploadResult\`. |\n| Template bulk | \`GET /api/v1/${names.pluralKebab}/bulk-template\` | Response blob \`.xlsx\` template. |\n` : ''}${hasOptions ? `| Opsi field | \`GET\` endpoint per field (lihat \`service.ts\`) | Response list opsi. |\n` : ''}Error mengikuti envelope axios \`{ response: { status, data } }\` agar
kompatibel dengan \`mapSubmitError\` (\`response_output.errors\` untuk field error).
` : ''}
## ${features.export || features.bulkUpload ? '6' : '5'}. Verifikasi

\`\`\`bash
npm run lint && npm run build
\`\`\`

Mock aktif secara default (\`USE_MOCK\` semua \`true\` di \`api/mock.ts\`).
Untuk memakai API real, ubah flag yang relevan menjadi \`false\`.
`;
}
