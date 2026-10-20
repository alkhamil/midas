import type {
  User,
  CreateUserPayload,
  GetUsersParams,
  UserListItem,
  UserMutationResult,
  BulkRowError,
  BulkUploadResult,
} from '../types';
import { t } from 'i18next';
import '../../../../shared/i18n';
import type { ApiList, ApiPagination } from '../../../../shared/types';
import { XLSX_MIME, buildWorkbook, readWorkbookRows } from '../../../../shared/utils';
import {
  BULK_USER_EXAMPLE,
  BULK_USER_HEADERS,
  validateBulkUserRow,
} from '../validation/userBulkValidation';

type RoleOption = { label: string; value: string };

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
  roleOptions: true,
  export: true,
  bulkUpload: true,
  bulkTemplate: true,
};

const mockRoles: { id: string; name: string }[] = [
  { id: '1', name: 'Admin' },
  { id: '2', name: 'Supervisor' },
  { id: '3', name: 'Finance' },
  { id: '4', name: 'Claim Handler' },
];

function roleNameOf(roleId: string): string {
  return mockRoles.find((r) => r.id === roleId)?.name ?? '';
}

const firstNamePool = [
  'Budi',
  'Siti',
  'Rina',
  'Andi',
  'Dewi',
  'Agus',
  'Putri',
  'Joko',
  'Sri',
  'Eko',
  'Nina',
  'Dedi',
  'Lina',
  'Fajar',
  'Ratna',
  'Hendra',
  'Maya',
  'Tono',
  'Vina',
  'Bayu',
];

const lastNamePool = [
  'Santoso',
  'Aminah',
  'Wijaya',
  'Lestari',
  'Pratama',
  'Hidayat',
  'Saputra',
  'Nugraha',
  'Kurniawan',
  'Wibowo',
  'Ramadhan',
  'Setiawan',
  'Susanto',
  'Permata',
];

const toSlug = (value: string) => value.toLowerCase().replace(/\s+/g, '.');

const roleCycle = mockRoles.map((r) => r);

interface MockUserRecord {
  id: string;
  name: string;
  role_id: string;
  username: string;
  email: string;
  password: string;
  status: 'active' | 'inactive';
  created_by: string | null;
  created_date: string;
}

function buildUsers(): MockUserRecord[] {
  const list: MockUserRecord[] = [];
  for (let i = 0; i < 20; i += 1) {
    const name = `${firstNamePool[i % firstNamePool.length]} ${lastNamePool[i % lastNamePool.length]}`;
    const role = roleCycle[i % roleCycle.length];
    const isInactive = i % 7 === 0;
    list.push({
      id: `usr-${String(i + 1).padStart(3, '0')}`,
      name,
      role_id: role.id,
      username: toSlug(name),
      email: `${toSlug(name)}@company.com`,
      password: `${toSlug(name)}123`,
      status: isInactive ? 'inactive' : 'active',
      created_by: 'System',
      created_date: `2024-0${(i % 9) + 1}-${10 + (i % 9)} 09:00`,
    });
  }
  return list;
}

const mockUsers: MockUserRecord[] = buildUsers();

function toListItem(record: MockUserRecord): UserListItem {
  return {
    id: record.id,
    name: record.name,
    role_id: record.role_id,
    role_name: roleNameOf(record.role_id),
    username: record.username,
    email: record.email,
    status: record.status,
    created_date: record.created_date,
    created_by: record.created_by,
  };
}

function toDetail(record: MockUserRecord): User {
  return {
    id: record.id,
    name: record.name,
    role_id: record.role_id,
    role_name: roleNameOf(record.role_id),
    username: record.username,
    email: record.email,
    password: record.password,
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
    pagination: {
      page: safePage,
      size,
      total_pages: totalPages,
      total_elements: totalElements,
    } as ApiPagination,
    content: items.slice((safePage - 1) * size, safePage * size),
  };
}

function sortItems<T>(items: T[], key: string | undefined, dir: string | undefined): T[] {
  const sortKey = key || 'id';
  const direction = dir === 'desc' ? -1 : 1;
  return [...items].sort((a, b) => {
    const av = (a as Record<string, unknown>)[sortKey];
    const bv = (b as Record<string, unknown>)[sortKey];
    if (av == null || bv == null) return 0;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * direction;
    return String(av).localeCompare(String(bv)) * direction;
  });
}

/** Filter + sortir tanpa pagination — dipakai list dan export. */
function filterUserRecords(params?: GetUsersParams): UserListItem[] {
  let items = mockUsers.map(toListItem);
  if (params?.search) {
    const q = params.search.toLowerCase();
    items = items.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q),
    );
  }
  if (params?.status) items = items.filter((u) => u.status === params.status);
  if (params?.role) items = items.filter((u) => u.role_id === params.role);
  return sortItems(items, params?.order, params?.sort);
}

export async function mockGetUsers(params?: GetUsersParams): Promise<ApiList<UserListItem>> {
  await delay(300);
  const items = filterUserRecords(params);
  const result = paginate(items, params?.page ?? 1, params?.size ?? 10);
  return { list: result };
}

export async function mockGetUserById(userId: string): Promise<User> {
  await delay(300);
  const user = mockUsers.find((u) => u.id === userId);
  if (!user) throw new Error(t('user.toast.notFound'));
  return toDetail(user);
}

export async function mockCreateUser(data: CreateUserPayload): Promise<UserMutationResult> {
  await delay(300);
  const errors: { field: string; message: string }[] = [];
  if (mockUsers.some((u) => u.username.toLowerCase() === data.username.toLowerCase())) {
    errors.push({
      field: 'username',
      message: t('validation.unique', { label: t('user.fields.username.label') }),
    });
  }
  if (mockUsers.some((u) => u.email.toLowerCase() === data.email.toLowerCase())) {
    errors.push({
      field: 'email',
      message: t('validation.unique', { label: t('user.fields.email.label') }),
    });
  }
  if (errors.length) {
    throw {
      response: {
        data: {
          response_schema: {
            response_code: 'BCAI-USER-400',
            response_message: 'Data already registered',
          },
          response_output: { errors },
        },
      },
    };
  }

  const id = `usr-${String(mockUsers.length + 1).padStart(3, '0')}`;
  const user: MockUserRecord = {
    id,
    name: data.name,
    role_id: data.role_id,
    username: data.username,
    email: data.email,
    password: data.password,
    status: data.status,
    created_by: 'System',
    created_date: new Date().toISOString().slice(0, 16).replace('T', ' '),
  };
  mockUsers.push(user);
  return { message: t('user.toast.created'), data: toDetail(user) };
}

export async function mockUpdateUser(
  userId: string,
  data: CreateUserPayload,
): Promise<UserMutationResult> {
  await delay(300);
  const user = mockUsers.find((u) => u.id === userId);
  if (!user) throw new Error(t('user.toast.notFound'));
  user.name = data.name;
  user.role_id = data.role_id;
  user.username = data.username;
  user.email = data.email;
  if (data.password) user.password = data.password;
  user.status = data.status;
  return { message: t('user.toast.updated'), data: toDetail(user) };
}

export async function mockDeleteUser(userId: string): Promise<{ message: string }> {
  await delay(300);
  const user = mockUsers.find((u) => u.id === userId);
  if (!user) throw new Error(t('user.toast.notFound'));
  user.status = 'inactive';
  return { message: t('user.toast.deleted') };
}

export async function mockRestoreUser(userId: string): Promise<UserMutationResult> {
  await delay(300);
  const user = mockUsers.find((u) => u.id === userId);
  if (!user) throw new Error(t('user.toast.notFound'));
  user.status = 'active';
  return { message: t('user.toast.restored'), data: toDetail(user) };
}

export async function mockGetRoleOptions(search?: string): Promise<RoleOption[]> {
  await delay(200);
  const q = search?.toLowerCase();
  const filtered = q ? mockRoles.filter((r) => r.name.toLowerCase().includes(q)) : mockRoles;
  return filtered.map((r) => ({ label: r.name, value: r.id }));
}

export async function mockExportUsers(params?: GetUsersParams): Promise<Blob> {
  await delay(300);
  const items = filterUserRecords({ ...params, page: undefined, size: undefined });
  const data = await buildWorkbook(
    ['Name', 'Username', 'Email', 'Role', 'Status', 'Created Date'],
    items.map((r) => [r.name, r.username, r.email, r.role_name, r.status, r.created_date]),
  );
  return new Blob([data], { type: XLSX_MIME });
}

export async function mockDownloadUserTemplate(): Promise<Blob> {
  const data = await buildWorkbook(BULK_USER_HEADERS, [BULK_USER_EXAMPLE]);
  return new Blob([data], { type: XLSX_MIME });
}

export async function mockBulkUploadUsers(file: File | ArrayBuffer): Promise<BulkUploadResult> {
  await delay(500);
  const buffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const { headers, rows } = await readWorkbookRows(buffer);
  const headerIndex = new Map(headers.map((h, i) => [h.trim().toLowerCase(), i]));
  const expected = BULK_USER_HEADERS;
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
  const seenUsername = new Set(mockUsers.map((u) => u.username.toLowerCase()));
  const seenEmail = new Set(mockUsers.map((u) => u.email.toLowerCase()));
  const errors: BulkRowError[] = [];
  let successCount = 0;
  rows.forEach((row, index) => {
    const mapped: Record<string, unknown> = {};
    for (const header of expected) {
      const source = headers[headerIndex.get(header.trim().toLowerCase()) ?? -1] ?? '';
      mapped[header] = row[source] ?? '';
    }
    const { payload, errors: rowErrors } = validateBulkUserRow(
      mapped,
      (field, value) => {
        if (field === 'username') return seenUsername.has(value.toLowerCase());
        if (field === 'email') return seenEmail.has(value.toLowerCase());
        return false;
      },
      (roleName) => mockRoles.find((r) => r.name.toLowerCase() === roleName.toLowerCase())?.id,
    );
    if (!payload) {
      for (const rowError of rowErrors) {
        errors.push({ row: index + 2, field: rowError.field, message: rowError.message });
      }
      return;
    }
    seenUsername.add(payload.username.toLowerCase());
    seenEmail.add(payload.email.toLowerCase());
    mockUsers.push({
      id: `usr-${String(mockUsers.length + 1).padStart(3, '0')}`,
      name: payload.name,
      role_id: payload.role_id,
      username: payload.username,
      email: payload.email,
      password: payload.password,
      status: payload.status,
      created_by: 'System',
      created_date: new Date().toISOString().slice(0, 16).replace('T', ' '),
    });
    successCount += 1;
  });
  return { totalRows: rows.length, successCount, failedCount: rows.length - successCount, errors };
}
