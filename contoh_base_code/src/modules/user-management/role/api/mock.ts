import type {
  Role,
  RoleMutationResult,
  RoleListItem,
  CreateRolePayload,
  GetRolesParams,
} from '../types';
import { t } from 'i18next';
import '../../../../shared/i18n';
import type { ApiList } from '../../../../shared/types';
import type { BulkUploadResult, BulkRowError } from '../types';
import { XLSX_MIME, buildWorkbook, readWorkbookRows } from '../../../../shared/utils';
import {
  BULK_ROLE_EXAMPLE,
  BULK_ROLE_HEADERS,
  validateBulkRoleRow,
} from '../validation/roleBulkValidation';
import { listDefinitions } from '../../../generator/runtime/definitionsApi';
import type { ModuleDefinition } from '../../../generator/definitions';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const USE_MOCK = {
  list: true,
  detail: true,
  create: true,
  update: true,
  delete: true,
  restore: true,
  permissions: true,
  export: true,
  bulkUpload: true,
  bulkTemplate: true,
};

/** Katalog permission mock-only (format `{modul}.{aksi}`). */
const mockPermissionCatalog: string[] = [
  'user.view',
  'user.create',
  'user.update',
  'user.delete',
  'user.bulk_upload',
  'user.export',
  'role.view',
  'role.create',
  'role.update',
  'role.delete',
  'role.bulk_upload',
  'role.export',
  'settings.view',
  'dashboard.view',
];

interface MockRoleRecord {
  id: string;
  name: string;
  permissions: string[];
  status: 'active' | 'inactive';
  created_by: string | null;
  created_date: string;
}

const mockRoleRecords: MockRoleRecord[] = [
  {
    id: '1',
    name: 'Admin',
    permissions: [...mockPermissionCatalog],
    status: 'active',
    created_by: 'System',
    created_date: '2024-01-10 09:00',
  },
  {
    id: '2',
    name: 'Supervisor',
    permissions: ['user.view', 'user.create', 'user.update', 'role.view'],
    created_by: 'System',
    created_date: '2024-02-10 09:00',
    status: 'active',
  },
  {
    id: '3',
    name: 'Finance',
    permissions: ['user.view'],
    status: 'active',
    created_by: 'System',
    created_date: '2024-03-10 09:00',
  },
  {
    id: '4',
    name: 'Viewer',
    permissions: ['dashboard.view'],
    status: 'inactive',
    created_by: 'System',
    created_date: '2024-04-10 09:00',
  },
];

function toListItem(record: MockRoleRecord): RoleListItem {
  return {
    id: record.id,
    name: record.name,
    permissions: [...record.permissions],
    status: record.status,
    created_date: record.created_date,
    created_by: record.created_by,
  };
}

function toDetail(record: MockRoleRecord): Role {
  return {
    id: record.id,
    name: record.name,
    permissions: [...record.permissions],
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

function sortRoles(items: RoleListItem[], key: string | undefined, dir: string | undefined) {
  const sortKey = key || 'name';
  const direction = dir === 'desc' ? -1 : 1;
  return [...items].sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[sortKey];
    const bv = (b as unknown as Record<string, unknown>)[sortKey];
    if (av == null || bv == null) return 0;
    return String(av).localeCompare(String(bv)) * direction;
  });
}

export async function mockGetRoles(params?: GetRolesParams): Promise<ApiList<RoleListItem>> {
  await delay(300);
  let items = params?.nodata === 'true' ? [] : mockRoleRecords.map(toListItem);
  if (params?.search) {
    const q = params.search.toLowerCase();
    items = items.filter((r) => r.name.toLowerCase().includes(q) || r.id.includes(q));
  }
  if (params?.status) items = items.filter((r) => r.status === params.status);
  items = sortRoles(items, params?.order, params?.sort);
  const result = paginate(items, (params?.page ?? 0) + 1, params?.size ?? 10);
  return { list: result };
}

export async function mockGetRoleById(id: string): Promise<Role> {
  await delay(300);
  const record = mockRoleRecords.find((r) => r.id === id);
  if (!record) throw new Error(t('role.toast.notFound'));
  return toDetail(record);
}

function mockRoleNameError() {
  return {
    response: {
      data: {
        response_schema: {
          response_code: 'SAL-ROLE-400',
          response_message: 'Parameter tidak valid',
        },
        response_output: {
          errors: [
            {
              field: 'name',
              message: t('validation.unique', { label: t('role.fields.name.label') }),
            },
          ],
        },
      },
    },
  };
}

export async function mockCreateRole(data: CreateRolePayload): Promise<RoleMutationResult> {
  await delay(300);
  if (mockRoleRecords.some((r) => r.name.toLowerCase() === data.name.toLowerCase())) {
    throw mockRoleNameError();
  }
  const record: MockRoleRecord = {
    id: String(mockRoleRecords.length + 1),
    name: data.name,
    permissions: [...data.permissions],
    status: data.status ?? 'active',
    created_by: 'System',
    created_date: new Date().toISOString().slice(0, 16).replace('T', ' '),
  };
  mockRoleRecords.push(record);
  return { message: t('role.toast.created'), data: toDetail(record) };
}

export async function mockUpdateRole(
  id: string,
  data: CreateRolePayload,
): Promise<RoleMutationResult> {
  await delay(300);
  const record = mockRoleRecords.find((r) => r.id === id);
  if (!record) throw new Error(t('role.toast.notFound'));
  if (mockRoleRecords.some((r) => r.id !== id && r.name.toLowerCase() === data.name.toLowerCase())) {
    throw mockRoleNameError();
  }
  record.name = data.name;
  record.permissions = [...data.permissions];
  return { message: t('role.toast.updated'), data: toDetail(record) };
}

export async function mockDeleteRole(id: string): Promise<{ message: string }> {
  await delay(300);
  const record = mockRoleRecords.find((r) => r.id === id);
  if (!record) throw new Error(t('role.toast.notFound'));
  record.status = 'inactive';
  return { message: t('role.toast.deleted') };
}

export async function mockRestoreRole(id: string): Promise<RoleMutationResult> {
  await delay(300);
  const record = mockRoleRecords.find((r) => r.id === id);
  if (!record) throw new Error(t('role.toast.notFound'));
  record.status = 'active';
  return { message: t('role.toast.restored'), data: toDetail(record) };
}

/** Permission keys dari definisi published (format `{permissionKey}.{aksi}`). */
export function definitionPermissions(def: ModuleDefinition): string[] {
  const base = def.permissionKey;
  const out: string[] = [];
  if (def.features.list) out.push(`${base}.view`);
  if (def.features.create) out.push(`${base}.create`);
  if (def.features.edit) out.push(`${base}.update`);
  if (def.features.delete) out.push(`${base}.delete`);
  if (def.features.bulkUpload) out.push(`${base}.bulk_upload`);
  if (def.features.export) out.push(`${base}.export`);
  return out;
}

export async function mockGetPermissions(): Promise<string[]> {
  await delay(200);
  const catalog = [...mockPermissionCatalog];
  try {
    const published = await listDefinitions('published');
    for (const def of published) {
      for (const permission of definitionPermissions(def)) {
        if (!catalog.includes(permission)) catalog.push(permission);
      }
    }
  } catch {
    // Abaikan: katalog statis tetap dikembalikan bila store tak terbaca.
  }
  return catalog;
}

export async function mockExportRoles(params?: GetRolesParams): Promise<Blob> {
  await delay(300);
  let items = mockRoleRecords.map(toListItem);
  if (params?.search) {
    const q = params.search.toLowerCase();
    items = items.filter((r) => r.name.toLowerCase().includes(q) || r.id.includes(q));
  }
  if (params?.status) items = items.filter((r) => r.status === params.status);
  items = sortRoles(items, params?.order, params?.sort);
  const data = await buildWorkbook(
    ['Name', 'Permissions', 'Status', 'Created Date'],
    items.map((r) => [r.name, r.permissions.join(', '), r.status, r.created_date]),
  );
  return new Blob([data], { type: XLSX_MIME });
}

export async function mockDownloadRoleTemplate(): Promise<Blob> {
  const data = await buildWorkbook(BULK_ROLE_HEADERS, [BULK_ROLE_EXAMPLE]);
  return new Blob([data], { type: XLSX_MIME });
}

export async function mockBulkUploadRoles(file: File | ArrayBuffer): Promise<BulkUploadResult> {
  await delay(500);
  const buffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const { headers, rows } = await readWorkbookRows(buffer);
  const headerIndex = new Map(headers.map((h, i) => [h.trim().toLowerCase(), i]));
  const expected = BULK_ROLE_HEADERS;
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
  const seenName = new Set(mockRoleRecords.map((r) => r.name.toLowerCase()));
  const errors: BulkRowError[] = [];
  let successCount = 0;
  rows.forEach((row, index) => {
    const mapped: Record<string, unknown> = {};
    for (const header of expected) {
      const source = headers[headerIndex.get(header.trim().toLowerCase()) ?? -1] ?? '';
      mapped[header] = row[source] ?? '';
    }
    const { payload, errors: rowErrors } = validateBulkRoleRow(
      mapped,
      mockPermissionCatalog,
      (name) => seenName.has(name.toLowerCase()),
    );
    if (!payload) {
      for (const rowError of rowErrors) {
        errors.push({ row: index + 2, field: rowError.field, message: rowError.message });
      }
      return;
    }
    seenName.add(payload.name.toLowerCase());
    mockRoleRecords.push({
      id: String(mockRoleRecords.length + 1),
      name: payload.name,
      permissions: [...payload.permissions],
      status: payload.status ?? 'active',
      created_by: 'System',
      created_date: new Date().toISOString().slice(0, 16).replace('T', ' '),
    });
    successCount += 1;
  });
  return { totalRows: rows.length, successCount, failedCount: rows.length - successCount, errors };
}
