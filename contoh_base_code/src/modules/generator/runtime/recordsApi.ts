/** Mock records generik: seed JSON + persist localStorage (mock-only, tanpa BE). */
import type { ApiList } from '../../../shared/types';
import type { LoadOptionsFn } from '../../../shared/components/ui/fields/SelectField';
import { XLSX_MIME, buildWorkbook, readWorkbookRows } from '../../../shared/utils';
import type { GeneratorFieldConfig } from '../types';
import type { ModuleDefinition } from '../definitions';
import { listDefinitions } from './definitionsApi';
import { filterDynamicRecords, paginateRecords } from './filtering';
import {
  bulkExampleRow,
  bulkHeaders,
  exportCellValue,
  exportHeaders,
  validateBulkRow,
  type BulkUploadResult,
} from './bulk';
import type { DynamicDetail, DynamicListItem, DynamicListParams, DynamicOption } from './types';

export type { BulkUploadResult };

export interface MutationResult {
  message: string;
  data: DynamicDetail;
}

const STORAGE_KEY = 'mock_records_v1';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface SeedFile {
  moduleKey: string;
  rows: {
    id: number;
    data: Record<string, unknown>;
    status: 'active' | 'inactive';
    createdBy: string | null;
    createdAt: string;
  }[];
}

// Lazy per modul agar bundle awal tidak memuat seed besar sekaligus.
const seedFiles = import.meta.glob<SeedFile>('../seeds/records/*.json', {
  import: 'default',
});

const recordCache = new Map<string, DynamicListItem[]>();
let persistedLoaded = false;

function loadPersisted(): void {
  if (persistedLoaded) return;
  persistedLoaded = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    for (const [plural, rows] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(rows)) recordCache.set(plural, rows as DynamicListItem[]);
    }
  } catch {
    // Abaikan: mulai dari seed.
  }
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(recordCache)));
  } catch {
    // Abaikan: mode privat / kuota penuh — cache in-memory tetap jalan.
  }
}

async function seedRows(apiPlural: string): Promise<DynamicListItem[]> {
  loadPersisted();
  const cached = recordCache.get(apiPlural);
  if (cached) return cached;
  const entry = Object.entries(seedFiles).find(([file]) => file.endsWith(`/${apiPlural}.json`));
  // Modul baru hasil publish belum punya seed → mulai dari daftar kosong.
  const seed = (entry ? await entry[1]() : { rows: [] }) as SeedFile;
  const rows: DynamicListItem[] = seed.rows.map((row) => ({
    id: row.id,
    status: row.status,
    created_by: row.createdBy,
    created_date: row.createdAt.slice(0, 16).replace('T', ' '),
    ...row.data,
  }));
  recordCache.set(apiPlural, rows);
  return rows;
}

/** Hapus seluruh records satu modul (plural) dari cache + persist. */
export async function deleteModuleRecords(apiPlural: string): Promise<void> {
  await delay(150);
  loadPersisted();
  recordCache.delete(apiPlural);
  persist();
}

/** Kosongkan mock records kembali ke seed JSON (hapus simpanan lokal). */
export function resetMockRecords(): void {
  recordCache.clear();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Abaikan.
  }
}

export async function listRecords(
  def: ModuleDefinition,
  params?: DynamicListParams,
): Promise<ApiList<DynamicListItem>> {
  await delay(200);
  const rows = await seedRows(def.apiPlural);
  const filtered = filterDynamicRecords(def.fields, rows, params ?? {});
  return { list: paginateRecords(filtered, params?.page ?? 1, params?.size ?? 10) };
}

export async function getRecord(def: ModuleDefinition, id: string): Promise<DynamicDetail> {
  await delay(150);
  const rows = await seedRows(def.apiPlural);
  const found = rows.find((row) => String(row.id) === id);
  if (!found) throw new Error('Data not found.');
  const { id: _omitId, status, created_by, created_date, ...data } = found;
  void _omitId;
  return {
    id: String(found.id),
    status,
    createdBy: created_by ?? '',
    createdDate: created_date,
    ...data,
  };
}

/** Loader opsi: config bila ada, else fallback 60 item (meniru template generate). */
function mockLoadOptionsFn(field: GeneratorFieldConfig): LoadOptionsFn {
  const configured = field.options ?? [];
  const base: DynamicOption[] =
    configured.length > 0
      ? configured.map((option) => ({ ...option }))
      : Array.from({ length: 60 }, (_, i) => ({
          label: `${field.label} ${i + 1}`,
          value: `${field.name.toUpperCase()}_${i + 1}`,
        }));
  return async (search = '', page = 1): Promise<DynamicOption[]> => {
    await delay(150);
    const size = 20;
    const q = search.toLowerCase();
    const filtered = q ? base.filter((opt) => opt.label.toLowerCase().includes(q)) : base;
    return filtered.slice((page - 1) * size, page * size);
  };
}

function mockConflictError(field: string, message: string, code: string): unknown {
  return {
    response: {
      data: {
        response_schema: {
          response_code: code,
          response_message: 'Invalid parameters',
        },
        response_output: { errors: [{ field, message }] },
      },
    },
  };
}

function uniqueFields(def: ModuleDefinition): GeneratorFieldConfig[] {
  return def.fields.filter((field) => field.rules.includes('unique'));
}

function nowStamp(): string {
  return new Date().toISOString().slice(0, 16).replace('T', ' ');
}

export async function createRecord(
  def: ModuleDefinition,
  data: Record<string, unknown>,
): Promise<MutationResult> {
  await delay(300);
  const rows = await seedRows(def.apiPlural);
  for (const field of uniqueFields(def)) {
    if (rows.some((row) => row[field.name] === data[field.name])) {
      throw mockConflictError(
        field.name,
        `${field.label} already exists, please use another`,
        `MOCK-${def.apiPlural.toUpperCase()}-400`,
      );
    }
  }
  const record: DynamicListItem = {
    id: Math.max(...rows.map((row) => row.id), 0) + 1,
    status: 'active',
    created_by: 'System',
    created_date: nowStamp(),
    ...pickKnown(def, data),
  };
  rows.push(record);
  persist();
  return { message: `${def.singularLabel} created successfully.`, data: toDetail(def, record) };
}

function pickKnown(
  def: ModuleDefinition,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const field of def.fields) {
    if (data[field.name] !== undefined) picked[field.name] = data[field.name];
  }
  return picked;
}

function toDetail(def: ModuleDefinition, row: DynamicListItem): DynamicDetail {
  const detail: DynamicDetail = {
    id: String(row.id),
    status: row.status,
    createdBy: row.created_by ?? '',
    createdDate: row.created_date,
  };
  for (const field of def.fields) detail[field.name] = row[field.name] ?? null;
  return detail;
}

export async function updateRecord(
  def: ModuleDefinition,
  id: string,
  data: Record<string, unknown>,
): Promise<MutationResult> {
  await delay(300);
  const rows = await seedRows(def.apiPlural);
  const record = rows.find((row) => String(row.id) === id);
  if (!record) throw new Error(`${def.singularLabel} not found`);
  for (const field of uniqueFields(def)) {
    if (
      rows.some((row) => String(row.id) !== id && row[field.name] === data[field.name])
    ) {
      throw mockConflictError(
        field.name,
        `${field.label} already exists, please use another`,
        `MOCK-${def.apiPlural.toUpperCase()}-400`,
      );
    }
  }
  Object.assign(record, pickKnown(def, data));
  persist();
  return { message: `${def.singularLabel} updated successfully.`, data: toDetail(def, record) };
}

export async function deleteRecord(
  def: ModuleDefinition,
  id: string,
): Promise<{ message: string }> {
  await delay(300);
  const rows = await seedRows(def.apiPlural);
  const record = rows.find((row) => String(row.id) === id);
  if (!record) throw new Error(`${def.singularLabel} not found`);
  if (def.deleteMode === 'hard') {
    recordCache.set(
      def.apiPlural,
      rows.filter((row) => String(row.id) !== id),
    );
    persist();
    return { message: `${def.singularLabel} deleted permanently` };
  }
  record.status = 'inactive';
  persist();
  return { message: `${def.singularLabel} deleted successfully` };
}

export async function restoreRecord(
  def: ModuleDefinition,
  id: string,
): Promise<MutationResult> {
  await delay(300);
  if (def.deleteMode !== 'soft') {
    throw new Error(`${def.singularLabel} does not support restore`);
  }
  const rows = await seedRows(def.apiPlural);
  const record = rows.find((row) => String(row.id) === id);
  if (!record) throw new Error(`${def.singularLabel} not found`);
  record.status = 'active';
  persist();
  return { message: `${def.singularLabel} restored successfully`, data: toDetail(def, record) };
}

export async function exportRecords(
  def: ModuleDefinition,
  params?: DynamicListParams,
): Promise<Blob> {
  await delay(300);
  const rows = await seedRows(def.apiPlural);
  const items = filterDynamicRecords(def.fields, rows, { ...params, page: undefined, size: undefined });
  const data = await buildWorkbook(
    exportHeaders(def.fields),
    items.map((row) => [
      ...def.fields.map((field) => exportCellValue(field.type, row[field.name])),
      row.status,
      row.created_date,
    ]),
  );
  return new Blob([data], { type: XLSX_MIME });
}

export async function downloadTemplate(def: ModuleDefinition): Promise<Blob> {
  const data = await buildWorkbook(bulkHeaders(def.fields), [bulkExampleRow(def.fields)]);
  return new Blob([data], { type: XLSX_MIME });
}

export async function bulkUploadRecords(
  def: ModuleDefinition,
  file: File | ArrayBuffer,
): Promise<BulkUploadResult> {
  await delay(500);
  const buffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const { headers, rows } = await readWorkbookRows(buffer);
  const expected = bulkHeaders(def.fields);
  const headerIndex = new Map(headers.map((header, i) => [header.trim().toLowerCase(), i]));
  const missing = expected.filter((header) => !headerIndex.has(header.trim().toLowerCase()));
  if (missing.length > 0) {
    return {
      totalRows: rows.length,
      successCount: 0,
      failedCount: rows.length,
      errors: missing.map((field) => ({
        row: 1,
        field,
        message: `Column "${field}" not found in file.`,
      })),
    };
  }
  if (rows.length === 0) {
    return {
      totalRows: 0,
      successCount: 0,
      failedCount: 0,
      errors: [{ row: 1, message: 'File tidak berisi data.' }],
    };
  }
  const store = await seedRows(def.apiPlural);
  const uniques = uniqueFields(def);
  const taken = new Map<string, Set<string>>();
  for (const field of uniques) {
    taken.set(
      field.name,
      new Set(store.map((row) => String(row[field.name] ?? '')).filter(Boolean)),
    );
  }
  let successCount = 0;
  const errors: BulkUploadResult['errors'] = [];
  const accepted: Record<string, unknown>[] = [];
  rows.forEach((row, index) => {
    const mapped: Record<string, unknown> = {};
    for (const header of expected) {
      const source = headers[headerIndex.get(header.trim().toLowerCase()) ?? -1] ?? '';
      mapped[header] = row[source] ?? '';
    }
    const { payload, errors: rowErrors } = validateBulkRow(def.fields, mapped, (field, value) =>
      taken.get(field)?.has(value) ?? false,
    );
    if (!payload) {
      for (const rowError of rowErrors) {
        errors.push({ row: index + 2, field: rowError.field, message: rowError.message });
      }
      return;
    }
    for (const field of uniques) {
      const value = payload[field.name];
      if (value !== undefined && value !== null && value !== '') {
        taken.get(field.name)?.add(String(value));
      }
    }
    accepted.push(payload);
    successCount += 1;
  });
  let nextId = Math.max(...store.map((row) => row.id), 0) + 1;
  for (const payload of accepted) {
    store.push({
      id: nextId,
      status: 'active',
      created_by: 'Bulk Upload',
      created_date: nowStamp(),
      ...payload,
    });
    nextId += 1;
  }
  persist();
  return { totalRows: rows.length, successCount, failedCount: rows.length - successCount, errors };
}

export function makeOptionsLoader(
  def: ModuleDefinition,
  field: GeneratorFieldConfig,
): LoadOptionsFn {
  void def;
  return mockLoadOptionsFn(field);
}

/** Loader relasi: options dari records modul target (search + paging ikut). */
export function makeRelationOptionsLoader(field: GeneratorFieldConfig): LoadOptionsFn {
  return async (search = '', page = 1): Promise<DynamicOption[]> => {
    await delay(150);
    const relation = field.relation;
    if (!relation) return [];
    const defs = await listDefinitions('published');
    const target = defs.find((d) => d.key === relation.definitionKey);
    if (!target) return [];
    const { list } = await listRecords(target, { search: search || undefined, page, size: 20 });
    const valueField = relation.valueField?.trim() || 'id';
    return list.content.map((row) => {
      const record = row as unknown as Record<string, unknown>;
      return {
        label: String(record[relation.labelField] ?? row.id),
        value: String(record[valueField] ?? row.id),
      };
    });
  };
}
