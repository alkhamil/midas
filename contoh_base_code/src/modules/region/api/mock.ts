import { t } from 'i18next';
import '../../../shared/i18n';
import type {
  Region,
  RegionMutationResult,
  BulkRowError,
  BulkUploadResult,
  RegionListItem,
  CreateRegionPayload,
  GetRegionsParams,
  SelectOption,
} from '../types';
import type { ApiList } from '../../../shared/types';
import { XLSX_MIME, buildWorkbook, readWorkbookRows } from '../../../shared/utils';
import {
  BULK_REGION_EXAMPLE,
  BULK_REGION_HEADERS,
  validateBulkRegionRow,
} from '../validation/regionBulkValidation';

export const USE_MOCK = {
  list: true,
  detail: true,
  create: true,
  update: true,
  delete: true,
  restore: true,
  selectOptions: true,
  export: true,
  bulkUpload: true,
  bulkTemplate: true,
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mockSelectOptions: SelectOption[] = [
  { label: 'Option 1', value: 'option_1' },
  { label: 'Option 2', value: 'option_2' },
];


interface MockRegionRecord {
  id: number;
  text: string;
  number: number;
  textarea: string;
  textarea2: string;
  password: string;
  select: string;
  status: 'active' | 'inactive';
  created_by: string | null;
  created_date: string;
}

// Mock data sengaja kosong: isi lewat Create / Bulk Upload.
const mockRegionRecords: MockRegionRecord[] = [];

function toListItem(record: MockRegionRecord): RegionListItem {
  return {
    id: record.id,
    text: record.text,
    number: record.number,
    textarea: record.textarea,
    textarea2: record.textarea2,
    password: record.password,
    select: record.select,
    created_date: record.created_date,
    created_by: record.created_by,
    status: record.status,
  };
}

function toDetail(record: MockRegionRecord): Region {
  return {
    id: String(record.id),
    text: record.text,
    number: record.number,
    textarea: record.textarea,
    textarea2: record.textarea2,
    password: record.password,
    select: record.select,
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

function sortRegions(items: RegionListItem[], key: string | undefined, dir: string | undefined) {
  const sortKey = key || 'text';
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
function filterRegionsRecords(params?: GetRegionsParams): RegionListItem[] {
  let items = mockRegionRecords.map(toListItem);
  if (params?.search) {
    const q = params.search.toLowerCase();
    items = items.filter(
      (r) =>
        r.text.toLowerCase().includes(q) ||
        r.textarea.toLowerCase().includes(q) ||
        r.textarea2.toLowerCase().includes(q) ||
        r.password.toLowerCase().includes(q) ||
        r.select.toLowerCase().includes(q) ||
        String(r.id).includes(q),
    );
  }
  if (params?.status) items = items.filter((r) => r.status === params.status);
  if (params?.text) {
    const qText = params.text.toLowerCase();
    items = items.filter((r) => String(r.text ?? '').toLowerCase().includes(qText));
  }
  if (params?.number !== undefined && params.number !== '') items = items.filter((r) => Number(r.number) === Number(params.number));
  if (params?.textarea) {
    const qTextarea = params.textarea.toLowerCase();
    items = items.filter((r) => String(r.textarea ?? '').toLowerCase().includes(qTextarea));
  }
  if (params?.textarea2) {
    const qTextarea2 = params.textarea2.toLowerCase();
    items = items.filter((r) => String(r.textarea2 ?? '').toLowerCase().includes(qTextarea2));
  }
  if (params?.select) items = items.filter((r) => r.select === params.select);
  return sortRegions(items, params?.order, params?.sort);
}

export async function mockGetRegions(params?: GetRegionsParams): Promise<ApiList<RegionListItem>> {
  await delay(300);
  const items = filterRegionsRecords(params);
  const result = paginate(items, (params?.page ?? 0) + 1, params?.size ?? 10);
  return { list: result };
}

export async function mockExportRegions(params?: GetRegionsParams): Promise<Blob> {
  await delay(300);
  const items = filterRegionsRecords({ ...params, page: undefined, size: undefined });
  const data = await buildWorkbook(
    ["Text","Number","Textarea","Textarea","Password","Select","Status","Created Date"],
    items.map((r) => [r.text, r.number, r.textarea, r.textarea2, r.password, r.select, r.status, r.created_date]),
  );
  return new Blob([data], { type: XLSX_MIME });
}

export async function mockDownloadRegionTemplate(): Promise<Blob> {
  const data = await buildWorkbook(BULK_REGION_HEADERS, [BULK_REGION_EXAMPLE]);
  return new Blob([data], { type: XLSX_MIME });
}

export async function mockBulkUploadRegions(file: File | ArrayBuffer): Promise<BulkUploadResult> {
  await delay(500);
  const buffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const { headers, rows } = await readWorkbookRows(buffer);
  const headerIndex = new Map(headers.map((h, i) => [h.trim().toLowerCase(), i]));
  const expected = BULK_REGION_HEADERS;
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

  const errors: BulkRowError[] = [];
  let successCount = 0;
  rows.forEach((row, index) => {
    const mapped: Record<string, unknown> = {};
    for (const header of expected) {
      const source = headers[headerIndex.get(header.trim().toLowerCase()) ?? -1] ?? '';
      mapped[header] = row[source] ?? '';
    }
    const { payload, errors: rowErrors } = validateBulkRegionRow(mapped, () => {

      return false;
    });
    if (!payload) {
      for (const rowError of rowErrors) {
        errors.push({ row: index + 2, field: rowError.field, message: rowError.message });
      }
      return;
    }

    mockRegionRecords.push({
      id: Math.max(...mockRegionRecords.map((r) => r.id)) + 1,
      text: payload.text,
      number: payload.number,
      textarea: payload.textarea,
      textarea2: payload.textarea2,
      password: payload.password,
      select: payload.select,
      status: 'active',
      created_by: 'Bulk Upload',
      created_date: new Date().toISOString().slice(0, 16).replace('T', ' '),
    });
    successCount += 1;
  });
  return { totalRows: rows.length, successCount, failedCount: rows.length - successCount, errors };
}


export async function mockGetRegionById(id: string): Promise<Region> {
  await delay(300);
  const record = mockRegionRecords.find((r) => String(r.id) === id);
  if (!record) throw new Error(t('region.toast.notFound'));
  return toDetail(record);
}

export async function mockCreateRegion(data: CreateRegionPayload): Promise<RegionMutationResult> {
  await delay(300);
  const record: MockRegionRecord = {
    id: Math.max(...mockRegionRecords.map((r) => r.id)) + 1,
    text: data.text,
    number: data.number,
    textarea: data.textarea,
    textarea2: data.textarea2,
    password: data.password,
    select: data.select,
    status: 'active',
    created_by: 'System',
    created_date: new Date().toISOString().slice(0, 16).replace('T', ' '),
  };
  mockRegionRecords.push(record);
  return { message: t('region.toast.created'), data: toDetail(record) };
}

export async function mockUpdateRegion(
  id: string,
  data: CreateRegionPayload,
): Promise<RegionMutationResult> {
  await delay(300);
  const record = mockRegionRecords.find((r) => String(r.id) === id);
  if (!record) throw new Error(t('region.toast.notFound'));
  record.text = data.text;
  record.number = data.number;
  record.textarea = data.textarea;
  record.textarea2 = data.textarea2;
  record.password = data.password;
  record.select = data.select;
  return { message: t('region.toast.updated'), data: toDetail(record) };
}

export async function mockDeleteRegion(id: string): Promise<{ message: string }> {
  await delay(300);
  const record = mockRegionRecords.find((r) => String(r.id) === id);
  if (!record) throw new Error(t('region.toast.notFound'));
  record.status = 'inactive';
  return { message: t('region.toast.deleted') };
}

export async function mockRestoreRegion(id: string): Promise<RegionMutationResult> {
  await delay(300);
  const record = mockRegionRecords.find((r) => String(r.id) === id);
  if (!record) throw new Error(t('region.toast.notFound'));
  record.status = 'active';
  return { message: t('region.toast.restored'), data: toDetail(record) };
}

export async function mockGetSelectOptions(): Promise<SelectOption[]> {
  await delay(200);
  return mockSelectOptions;
}
