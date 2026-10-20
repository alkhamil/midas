import type { TemplateContext } from '../../engine/context';
import {
  arraySubLoadModels,
  arraySubRelationModels,
  relationSelects,
  rowTypeName,
  tsDataType,
} from '../../engine/fieldGenerator';
import type { FieldModel } from '../../engine/context';
import { resolveRelationTarget, toPascalCase } from '../../naming';
import {
  loadLabelHelper,
  mockFilterLine,
  mockLoadOptionsFn,
  mockOptionsConst,
  mockRelationOptionsFn,
  mockRelationOptionsImport,
  optionMapping,
  optionsEndpoint,
} from '../../engine/sourceGenerator';

/** Semua field ber-loader: paging + relasi (top-level). */
function loadableSelects(ctx: TemplateContext): FieldModel[] {
  return [...loadSelects(ctx), ...relationSelects(ctx)];
}

/** Semua model ber-loader: paging + relasi (termasuk sub-field array). */
function loadableSubModels(fields: FieldModel[]): FieldModel[] {
  return [...arraySubLoadModels(fields), ...arraySubRelationModels(fields)];
}

function optionsSelects(ctx: TemplateContext) {
  return ctx.fields.filter((f) => f.isOptionsQuery);
}

function loadSelects(ctx: TemplateContext) {
  return ctx.fields.filter((f) => f.isLoadOptions);
}

/** Ekspresi nilai sel export per field (mirror tampilan tabel). */
function exportCellValue(field: { name: string; valueType: string }, rowVar: string): string {
  switch (field.valueType) {
    case 'boolean':
      return `(${rowVar}.${field.name} ? 'Yes' : 'No')`;
    case 'stringArray':
      return `(${rowVar}.${field.name} ?? []).join(', ')`;
    case 'rowArray':
      return `(((${rowVar}.${field.name} ?? []).length > 0 ? (${rowVar}.${field.name} ?? []).length + ' baris' : ''))`;
    default:
      return `${rowVar}.${field.name}`;
  }
}

export function serviceTemplate(ctx: TemplateContext): string {
  const { names, features } = ctx;
  const base = `/api/v1/${names.pluralKebab}`;
  const typeImports = [
    names.entity,
    names.mutationResult,
    ...(features.bulkUpload ? ['BulkUploadResult'] : []),
    names.payload,
    names.params,
    names.listItem,
    ...optionsSelects(ctx).map((f) => f.optionType),
    ...loadableSelects(ctx).map((f) => f.optionType),
    ...loadableSubModels(ctx.fields).map((m) => m.optionType),
  ];

  const optionsFns = optionsSelects(ctx)
    .map((f) => {
      const mapping = optionMapping(f);
      const shape = mapping ? 'Record<string, unknown>' : f.optionType;
      const body = mapping
        ? `const content = res.data.response_output?.list.content ?? [];\n  return content.map(${mapping});`
        : `return res.data.response_output?.list.content ?? [];`;
      return `export async function get${f.pascal}Options(): Promise<${f.optionType}[]> {
  const res = await api.get<ApiResponse<ApiList<${shape}>>>('${optionsEndpoint(ctx, f)}');
  ${body}
}`;
    })
    .join('\n\n');

  const loadFieldsAll = [...loadableSelects(ctx), ...loadableSubModels(ctx.fields)];
  const loadFns = loadFieldsAll
    .map((f) => {
      if (f.isRelationOptions) {
        // Relasi: options dari endpoint list modul target.
        const target = resolveRelationTarget(f.config.relation);
        const labelField = f.config.relation?.labelField || 'name';
        const valueField = f.config.relation?.valueField?.trim() || 'id';
        return `export async function ${f.loadOptionsFn}(
  search = '',
  page = 1,
  size = 20,
): Promise<${f.optionType}[]> {
  const res = await api.get<ApiResponse<ApiList<Record<string, unknown>>>>('/api/v1/${target?.apiPlural ?? 'items'}', {
    params: { search, page, size },
  });
  const content = res.data.response_output?.list.content ?? [];
  return content.map((r) => ({
    label: String(r['${labelField}'] ?? ''),
    value: String(r['${valueField}'] ?? ''),
  }));
}`;
      }
      const mapping = optionMapping(f);
      const shape = mapping ? 'Record<string, unknown>' : f.optionType;
      const body = mapping
        ? `const content = res.data.response_output?.list.content ?? [];\n  return content.map(${mapping});`
        : `return res.data.response_output?.list.content ?? [];`;
      // Relasi memakai RelationLabel async — tanpa stub label sinkron.
      const stub = f.isRelationOptions
        ? ''
        : `
/** Label sinkron mock-only; service mengembalikan value (resolve via endpoint bila perlu). */
export function ${loadLabelHelper(f)}(value: string): string {
  return value;
}`;
      return `export async function ${f.loadOptionsFn}(
  search = '',
  page = 1,
  size = 20,
): Promise<${f.optionType}[]> {
  const res = await api.get<ApiResponse<ApiList<${shape}>>>('${optionsEndpoint(ctx, f)}', {
    params: { search, page, size },
  });
  ${body}
}${stub}`;
    })
    .join('\n\n');

  return `import api from '${names.sharedPrefix}shared/lib/api';
import type {
  ${typeImports.join(',\n  ')},
} from '../types';
import type { ApiDetail, ApiList, ApiResponse } from '${names.sharedPrefix}shared/types';

export async function get${names.entityPlural}(params?: ${names.params}): Promise<ApiList<${names.listItem}>> {
  const res = await api.get<ApiResponse<ApiList<${names.listItem}>>>('${base}', { params });
  return res.data.response_output ?? { list: { pagination: null, content: [] } };
}

export async function get${names.entity}ById(id: string): Promise<${names.entity}> {
  const res = await api.get<ApiResponse<ApiDetail<${names.entity}>>>(\`${base}/\${id}\`);
  return res.data.response_output!.detail;
}

export async function create${names.entity}(data: ${names.payload}): Promise<${names.mutationResult}> {
  const res = await api.post<ApiResponse<ApiDetail<${names.entity}>>>('${base}', data);
  return {
    message: res.data.response_schema.response_message,
    data: res.data.response_output!.detail,
  };
}

export async function update${names.entity}(
  id: string,
  data: ${names.payload},
): Promise<${names.mutationResult}> {
  const res = await api.put<ApiResponse<ApiDetail<${names.entity}>>>(\`${base}/\${id}\`, data);
  return {
    message: res.data.response_schema.response_message,
    data: res.data.response_output!.detail,
  };
}

export async function delete${names.entity}(id: string): Promise<{ message: string }> {
  const res = await api.delete<ApiResponse<null>>(\`${base}/\${id}\`);
  return { message: res.data.response_schema.response_message };
}

export async function restore${names.entity}(id: string): Promise<${names.mutationResult}> {
  const res = await api.patch<ApiResponse<ApiDetail<${names.entity}>>>(\`${base}/\${id}/restore\`);
  return {
    message: res.data.response_schema.response_message,
    data: res.data.response_output!.detail,
  };
}
${optionsFns ? `\n${optionsFns}\n` : ''}${loadFns ? `\n${loadFns}\n` : ''}${
    features.export
      ? `
export async function export${names.entityPlural}(params?: ${names.params}): Promise<Blob> {
  const res = await api.get('${base}/export', { params, responseType: 'blob' });
  return res.data as Blob;
}
`
      : ''
  }${
    features.bulkUpload
      ? `
export async function bulkUpload${names.entityPlural}(file: File): Promise<BulkUploadResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post<ApiResponse<BulkUploadResult>>('${base}/bulk-upload', form);
  return res.data.response_output!;
}

export async function download${names.entity}Template(): Promise<Blob> {
  const res = await api.get('${base}/bulk-template', { responseType: 'blob' });
  return res.data as Blob;
}
`
      : ''
  }`;
}

export function mockTemplate(ctx: TemplateContext): string {
  const { names, fields, features, uniqueField } = ctx;
  const base = ctx.config.permissionKey;
  const entityLower = names.entity.toLowerCase();

  const typeImports = [
    names.entity,
    names.mutationResult,
    ...(features.bulkUpload ? ['BulkRowError', 'BulkUploadResult'] : []),
    names.listItem,
    names.payload,
    names.params,
    ...optionsSelects(ctx).map((f) => f.optionType),
    ...loadableSelects(ctx).map((f) => f.optionType),
    ...loadableSubModels(fields).map((m) => m.optionType),
    ...fields.filter((f) => f.config.type === 'formArrayField').map((f) => rowTypeName(f)),
  ];

  const mockFlags = [
    '  list: true,',
    '  detail: true,',
    '  create: true,',
    '  update: true,',
    '  delete: true,',
    '  restore: true,',
    ...optionsSelects(ctx).map((f) => `  ${f.name}Options: true,`),
    ...loadableSelects(ctx).map((f) => `  ${f.name}LoadOptions: true,`),
    ...loadableSubModels(ctx.fields).map((f) => `  ${f.name}LoadOptions: true,`),
    ...loadSelects(ctx).map((f) => `  ${f.name}Label: true,`),
    ...arraySubLoadModels(ctx.fields).map((f) => `  ${f.name}Label: true,`),
    ...(features.export ? ['  export: true,'] : []),
    ...(features.bulkUpload ? ['  bulkUpload: true,', '  bulkTemplate: true,'] : []),
  ].join('\n');

  const optionsConsts = optionsSelects(ctx).map(mockOptionsConst).join('\n\n');
  const loadModels = [...loadableSelects(ctx), ...loadableSubModels(fields)];
  const relationImports = [
    ...loadableSelects(ctx),
    ...loadableSubModels(fields),
  ]
    .filter((f) => f.isRelationOptions)
    .map((f) => mockRelationOptionsImport(f, ctx.names.dir))
    .join('\n');
  const loadFns = loadModels
    .map((f) => (f.isRelationOptions ? mockRelationOptionsFn(f) : mockLoadOptionsFn(f)))
    .join('\n\n');

  const stringFields = fields.filter((f) => f.valueType === 'string');
  const arrayFields = fields.filter((f) => f.valueType === 'stringArray');
  const searchConditions = [
    ...stringFields.map((f) => `r.${f.name}.toLowerCase().includes(q)`),
    ...arrayFields.map((f) => `(r.${f.name} ?? []).join(' ').toLowerCase().includes(q)`),
    'String(r.id).includes(q)',
  ].join(' ||\n        ');

  const filterLines = fields
    .filter((f) => f.filterable && f.filterCriteria)
    .map((f) =>
      mockFilterLine(f)
        .split('\n')
        .map((line, i) => (i === 0 ? `  ${line}` : line))
        .join('\n'),
    )
    .join('\n');

  const exportHeaders = [
    ...fields.map((f) => f.label),
    'Status',
    'Created Date',
  ];
  const exportCells = (rowVar: string): string =>
    [
      ...fields.map((f) => exportCellValue(f, rowVar)),
      `${rowVar}.status`,
      `${rowVar}.created_date`,
    ].join(', ');
  const uniqueFields = fields.filter(
    (f) => f.config.rules.includes('unique') && f.valueType !== 'stringArray',
  );

  const conflictCheck = (exclude: string): string =>
    uniqueField
      ? `
  if (mock${names.entity}Records.some((r) => ${exclude}r.${uniqueField.name} === data.${uniqueField.name})) {
    throw mockConflictError(
      '${uniqueField.name}',
      t('validation.unique', { label: t('${base}.fields.${uniqueField.name}.label') }),
    );
  }`
      : '';

  const validationImport = features.bulkUpload
    ? `import {\n  BULK_${names.entity.toUpperCase()}_EXAMPLE,\n  BULK_${names.entity.toUpperCase()}_HEADERS,\n  validateBulk${names.entity}Row,\n} from '../validation/${names.camel}BulkValidation';\n`
    : '';
  const excelImport =
    features.export || features.bulkUpload
      ? `import { XLSX_MIME, buildWorkbook${features.bulkUpload ? ', readWorkbookRows' : ''} } from '${names.sharedPrefix}shared/utils';\n`
      : '';

  return `import { t } from 'i18next';
import '${names.sharedPrefix}shared/i18n';
import type {
  ${typeImports.join(',\n  ')},
} from '../types';
import type { ApiList } from '${names.sharedPrefix}shared/types';
${excelImport}${validationImport}${relationImports ? `${relationImports}\n` : ''}
export const USE_MOCK = {
${mockFlags}
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
${optionsConsts ? `\n${optionsConsts}\n` : ''}
${loadFns ? `${loadFns}\n` : ''}
interface Mock${names.entity}Record {
  id: number;
${fields.map((f) => `  ${f.name}: ${tsDataType(f)};`).join('\n')}
  status: 'active' | 'inactive';
  created_by: string | null;
  created_date: string;
}

// Mock data sengaja kosong: isi lewat Create / Bulk Upload.
const mock${names.entity}Records: Mock${names.entity}Record[] = [];

function toListItem(record: Mock${names.entity}Record): ${names.listItem} {
  return {
    id: record.id,
${fields.map((f) => `    ${f.name}: record.${f.name},`).join('\n')}
    created_date: record.created_date,
    created_by: record.created_by,
    status: record.status,
  };
}

function toDetail(record: Mock${names.entity}Record): ${names.entity} {
  return {
    id: String(record.id),
${fields.map((f) => `    ${f.name}: record.${f.name},`).join('\n')}
    status: record.status,
    createdBy: record.created_by ?? '',
    createdDate: record.created_date,
  };
}

function paginate<T>(items: T[], page: number, size: number) {
  const totalElements = items.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / size));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  return {
    pagination: { page: safePage, size, total_pages: totalPages, total_elements: totalElements },
    content: items.slice((safePage - 1) * size, safePage * size),
  };
}

function sort${names.entityPlural}(items: ${names.listItem}[], key: string | undefined, dir: string | undefined) {
  const sortKey = key || '${fields[0]?.name ?? 'id'}';
  const direction = dir === 'desc' ? -1 : 1;
  return [...items].sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[sortKey];
    const bv = (b as unknown as Record<string, unknown>)[sortKey];
    if (av == null || bv == null) return 0;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * direction;
    return String(av).localeCompare(String(bv)) * direction;
  });
}

/** Filter + sortir tanpa pagination — dipakai list dan export. */
function filter${names.entityPlural}Records(params?: ${names.params}): ${names.listItem}[] {
  let items = mock${names.entity}Records.map(toListItem);
  if (params?.search) {
    const q = params.search.toLowerCase();
    items = items.filter(
      (r) =>
        ${searchConditions},
    );
  }
  if (params?.status) items = items.filter((r) => r.status === params.status);
${filterLines}
  return sort${names.entityPlural}(items, params?.order, params?.sort);
}

export async function mockGet${names.entityPlural}(params?: ${names.params}): Promise<ApiList<${names.listItem}>> {
  await delay(300);
  const items = filter${names.entityPlural}Records(params);
  const result = paginate(items, (params?.page ?? 0) + 1, params?.size ?? 10);
  return { list: result };
}
${
  features.export
    ? `
export async function mockExport${names.entityPlural}(params?: ${names.params}): Promise<Blob> {
  await delay(300);
  const items = filter${names.entityPlural}Records({ ...params, page: undefined, size: undefined });
  const data = await buildWorkbook(
    ${JSON.stringify(exportHeaders)},
    items.map((r) => [${exportCells('r')}]),
  );
  return new Blob([data], { type: XLSX_MIME });
}
`
    : ''
}${
  features.bulkUpload
    ? `
export async function mockDownload${names.entity}Template(): Promise<Blob> {
  const data = await buildWorkbook(BULK_${names.entity.toUpperCase()}_HEADERS, [BULK_${names.entity.toUpperCase()}_EXAMPLE]);
  return new Blob([data], { type: XLSX_MIME });
}

export async function mockBulkUpload${names.entityPlural}(file: File | ArrayBuffer): Promise<BulkUploadResult> {
  await delay(500);
  const buffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const { headers, rows } = await readWorkbookRows(buffer);
  const headerIndex = new Map(headers.map((h, i) => [h.trim().toLowerCase(), i]));
  const expected = BULK_${names.entity.toUpperCase()}_HEADERS;
  const missing = expected.filter((h) => !headerIndex.has(h.trim().toLowerCase()));
  if (missing.length > 0) {
    return {
      totalRows: rows.length,
      successCount: 0,
      failedCount: rows.length,
      errors: missing.map((field) => ({
        row: 1,
        field,
        message: t('bulk.missingColumn', { field }),
      })),
    };
  }
  if (rows.length === 0) {
    return {
      totalRows: 0,
      successCount: 0,
      failedCount: 0,
      errors: [{ row: 1, message: t('bulk.emptyFile') }],
    };
  }
${uniqueFields
  .map(
    (f) =>
      `  const seen${f.pascal} = new Set(mock${names.entity}Records.map((r) => String(r.${f.name}).toLowerCase()));`,
  )
  .join('\n')}
  const errors: BulkRowError[] = [];
  let successCount = 0;
  rows.forEach((row, index) => {
    const mapped: Record<string, unknown> = {};
    for (const header of expected) {
      const source = headers[headerIndex.get(header.trim().toLowerCase()) ?? -1] ?? '';
      mapped[header] = row[source] ?? '';
    }
    const { payload, errors: rowErrors } = validateBulk${names.entity}Row(mapped, ${uniqueFields.length > 0 ? '(field, value)' : '()'} => {
${uniqueFields.map((f) => `      if (field === '${f.name}') return seen${f.pascal}.has(value.toLowerCase());`).join('\n')}
      return false;
    });
    if (!payload) {
      for (const rowError of rowErrors) {
        errors.push({ row: index + 2, field: rowError.field, message: rowError.message });
      }
      return;
    }
${uniqueFields
  .map(
    (f) =>
      `    seen${f.pascal}.add(String(payload.${f.name}).toLowerCase());`,
  )
  .join('\n')}
    mock${names.entity}Records.push({
      id: Math.max(...mock${names.entity}Records.map((r) => r.id)) + 1,
${fields.map((f) => `      ${f.name}: payload.${f.name},`).join('\n')}
      status: 'active',
      created_by: 'Bulk Upload',
      created_date: new Date().toISOString().slice(0, 16).replace('T', ' '),
    });
    successCount += 1;
  });
  return { totalRows: rows.length, successCount, failedCount: rows.length - successCount, errors };
}
`
    : ''
}

export async function mockGet${names.entity}ById(id: string): Promise<${names.entity}> {
  await delay(300);
  const record = mock${names.entity}Records.find((r) => String(r.id) === id);
  if (!record) throw new Error(t('${base}.toast.notFound'));
  return toDetail(record);
}
${uniqueField ? `
function mockConflictError(field: string, message: string) {
  return {
    response: {
      data: {
        response_schema: {
          response_code: 'MOCK-${entityLower.toUpperCase()}-400',
          response_message: 'Invalid parameters',
        },
        response_output: {
          errors: [{ field, message }],
        },
      },
    },
  };
}
` : ''}
export async function mockCreate${names.entity}(data: ${names.payload}): Promise<${names.mutationResult}> {
  await delay(300);${conflictCheck('')}
  const record: Mock${names.entity}Record = {
    id: Math.max(...mock${names.entity}Records.map((r) => r.id)) + 1,
${fields.map((f) => `    ${f.name}: data.${f.name},`).join('\n')}
    status: 'active',
    created_by: 'System',
    created_date: new Date().toISOString().slice(0, 16).replace('T', ' '),
  };
  mock${names.entity}Records.push(record);
  return { message: t('${base}.toast.created'), data: toDetail(record) };
}

export async function mockUpdate${names.entity}(
  id: string,
  data: ${names.payload},
): Promise<${names.mutationResult}> {
  await delay(300);
  const record = mock${names.entity}Records.find((r) => String(r.id) === id);
  if (!record) throw new Error(t('${base}.toast.notFound'));${conflictCheck('String(r.id) !== id && ')}
${fields.map((f) => `  record.${f.name} = data.${f.name};`).join('\n')}
  return { message: t('${base}.toast.updated'), data: toDetail(record) };
}

export async function mockDelete${names.entity}(id: string): Promise<{ message: string }> {
  await delay(300);
  const record = mock${names.entity}Records.find((r) => String(r.id) === id);
  if (!record) throw new Error(t('${base}.toast.notFound'));
  record.status = 'inactive';
  return { message: t('${base}.toast.deleted') };
}

export async function mockRestore${names.entity}(id: string): Promise<${names.mutationResult}> {
  await delay(300);
  const record = mock${names.entity}Records.find((r) => String(r.id) === id);
  if (!record) throw new Error(t('${base}.toast.notFound'));
  record.status = 'active';
  return { message: t('${base}.toast.restored'), data: toDetail(record) };
}
${optionsSelects(ctx)
  .map(
    (f) => `
export async function mockGet${f.pascal}Options(): Promise<${f.optionType}[]> {
  await delay(200);
  return ${f.mockOptionsVar};
}
`,
  )
  .join('')}`;
}

/**
 * API resolver — saklar sumber data modul ini per operasi.
 * `USE_MOCK` (di `mock.ts`, default semua `true` = mock lokal tanpa backend):
 * ubah flag yang relevan menjadi `false` untuk memakai Real API via `service.ts`.
 * Nama export sama untuk kedua sumber, jadi `queries.ts`/`mutations.ts`
 * tidak perlu berubah.
 */
export function resolverTemplate(ctx: TemplateContext): string {
  const { names, features } = ctx;
  const ops: [string, string, string, string?][] = [
    ['list', `get${names.entityPlural}`, `mockGet${names.entityPlural}`],
    ['detail', `get${names.entity}ById`, `mockGet${names.entity}ById`],
    ['create', `create${names.entity}`, `mockCreate${names.entity}`],
    ['update', `update${names.entity}`, `mockUpdate${names.entity}`],
    ['delete', `delete${names.entity}`, `mockDelete${names.entity}`],
    ['restore', `restore${names.entity}`, `mockRestore${names.entity}`],
  ];
  if (features.export) {
    ops.push(['export', `export${names.entityPlural}`, `mockExport${names.entityPlural}`]);
  }
  if (features.bulkUpload) {
    ops.push(['bulkUpload', `bulkUpload${names.entityPlural}`, `mockBulkUpload${names.entityPlural}`]);
    ops.push(['bulkTemplate', `download${names.entity}Template`, `mockDownload${names.entity}Template`]);
  }
  for (const f of optionsSelects(ctx)) {
    ops.push([`${f.name}Options`, `get${f.pascal}Options`, `mockGet${f.pascal}Options`]);
  }
  // Loader opsi punya nama sama di mock & service (`loadXOptions`) sehingga
  // import mock wajib alias agar tak tabrakan dengan `export const` di bawah.
  // Pakai loadableSelects (paging + relasi): loader relasi wajib ikut
  // di-resolver agar tersedia via barrel `api/index.ts`.
  for (const f of loadableSelects(ctx)) {
    ops.push([
      `${f.name}LoadOptions`,
      f.loadOptionsFn,
      `mock${toPascalCase(f.loadOptionsFn)}`,
      `${f.loadOptionsFn} as mock${toPascalCase(f.loadOptionsFn)}`,
    ]);
  }
  for (const f of loadableSubModels(ctx.fields)) {
    ops.push([
      `${f.name}LoadOptions`,
      f.loadOptionsFn,
      `mock${toPascalCase(f.loadOptionsFn)}`,
      `${f.loadOptionsFn} as mock${toPascalCase(f.loadOptionsFn)}`,
    ]);
  }
  // Helper label sinkron paging: import mock dialias seperti loader.
  for (const f of [...loadSelects(ctx), ...arraySubLoadModels(ctx.fields)]) {
    const helper = loadLabelHelper(f);
    ops.push([
      `${f.name}Label`,
      helper,
      `mock${toPascalCase(helper)}`,
      `${helper} as mock${toPascalCase(helper)}`,
    ]);
  }
  const lines = ops.map(
    ([flag, name, mockName]) =>
      `export const ${name} = USE_MOCK.${flag} ? ${mockName} : service.${name};`,
  );
  const mockImports = ops.map((op) => op[3] ?? op[2]).join(',\n  ');
  return `import {
  USE_MOCK,
  ${mockImports},
} from './mock';
import * as service from './service';

${lines.join('\n')}
`;
}

export function queriesTemplate(ctx: TemplateContext): string {
  const { names, features } = ctx;
  const needList = features.list;
  const needDetail = features.detail || features.create || features.edit;
  const needForm = features.create || features.edit || features.detail;
  const optionQueries = needForm ? optionsSelects(ctx) : [];

  const typeImports = [
    ...(needList ? [names.params, names.listItem] : []),
    ...(needDetail ? [names.entity] : []),
    ...optionQueries.map((f) => f.optionType),
  ];
  const apiListImport = needList
    ? `import type { ApiList } from '${names.sharedPrefix}shared/types';\n`
    : '';
  const resolverImports = [
    ...(needList ? [`get${names.entityPlural}`] : []),
    ...(needDetail ? [`get${names.entity}ById`] : []),
    ...optionQueries.map((f) => `get${f.pascal}Options`),
  ];

  return `import { useQuery } from '@tanstack/react-query';
import { ${resolverImports.join(', ')} } from './resolver';
import type { ${typeImports.join(', ')} } from '../types';
${apiListImport}${needList ? `
export function use${names.entity}ListQuery(params: ${names.params}) {
  return useQuery<ApiList<${names.listItem}>>({
    queryKey: ['${names.pluralKebab}', params],
    queryFn: () => get${names.entityPlural}({ ...params, page: (params.page ?? 1) - 1 }),
    placeholderData: (prev) => prev,
  });
}
` : ''}${needDetail ? `
export function use${names.entity}DetailQuery(id?: string) {
  return useQuery<${names.entity}>({
    queryKey: ['${names.kebab}', id],
    queryFn: () => get${names.entity}ById(id!),
    enabled: !!id,
  });
}
` : ''}${optionQueries
    .map(
      (f) => `
export function ${f.optionsQueryHook}() {
  return useQuery<${f.optionType}[]>({
    queryKey: ['${names.kebab}-${f.name}-options'],
    queryFn: get${f.pascal}Options,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
`,
    )
    .join('')}`;
}

export function mutationsTemplate(ctx: TemplateContext): string {
  const { names, features } = ctx;
  const needUpsert = features.create || features.edit || features.detail;
  const needDelete = features.delete;
  const needBulk = features.bulkUpload;
  const resolverImports = [
    ...(needDelete ? [`delete${names.entity}`, `restore${names.entity}`] : []),
    ...(needUpsert ? [`create${names.entity}`, `update${names.entity}`] : []),
    ...(needBulk ? [`bulkUpload${names.entityPlural}`] : []),
  ];

  return `import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ${resolverImports.join(', ')} } from './resolver';
${needUpsert ? `import type { ${names.payload} } from '../types';\n` : ''}${needDelete ? `
export function useDelete${names.entity}() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => delete${names.entity}(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['${names.pluralKebab}'] }),
  });
}

export function useRestore${names.entity}() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restore${names.entity}(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['${names.pluralKebab}'] }),
  });
}
` : ''}${needUpsert ? `
export function useUpsert${names.entity}() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: ${names.payload} }) =>
      id ? update${names.entity}(id, data) : create${names.entity}(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['${names.pluralKebab}'] });
      if (variables.id) {
        queryClient.invalidateQueries({ queryKey: ['${names.kebab}', variables.id] });
      }
    },
  });
}
` : ''}${needBulk ? `
export function useBulkUpload${names.entity}() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => bulkUpload${names.entityPlural}(file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['${names.pluralKebab}'] }),
  });
}
` : ''}`;
}

export function needsQueriesFile(ctx: TemplateContext): boolean {
  const { features } = ctx;
  return (
    features.list ||
    features.detail ||
    features.create ||
    features.edit ||
    ((features.create || features.edit || features.detail) && ctx.hasOptionsSelects)
  );
}

export function apiIndexTemplate(ctx: TemplateContext): string {
  const { features } = ctx;
  const needMutations =
    features.create || features.edit || features.detail || features.delete || features.bulkUpload;
  return `export * from './resolver';
${needsQueriesFile(ctx) ? `export * from './queries';\n` : ''}${needMutations ? `export * from './mutations';\n` : ''}`;
}
