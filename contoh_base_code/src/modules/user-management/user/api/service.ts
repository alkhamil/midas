import api from '../../../../shared/lib/api';
import type {
  User,
  CreateUserPayload,
  GetUsersParams,
  UserListItem,
  UserMutationResult,
  BulkUploadResult,
} from '../types';
import type { SelectOption } from '../../../../shared/components/ui';
import type { ApiDetail, ApiList, ApiResponse } from '../../../../shared/types';

export async function getUsers(params?: GetUsersParams): Promise<ApiList<UserListItem>> {
  const res = await api.get<ApiResponse<ApiList<UserListItem>>>('/api/v1/users', {
    params: { ...params, page: (params?.page ?? 1) - 1 },
  });
  return res.data.response_output ?? { list: { pagination: null, content: [] } };
}

export async function getUserById(userId: string): Promise<User> {
  const res = await api.get<ApiResponse<ApiDetail<User>>>(`/api/v1/users/${userId}`);
  return res.data.response_output!.detail;
}

export async function createUser(data: CreateUserPayload): Promise<UserMutationResult> {
  const res = await api.post<ApiResponse<ApiDetail<User>>>('/api/v1/users', data);
  return {
    message: res.data.response_schema.response_message,
    data: res.data.response_output!.detail,
  };
}

export async function updateUser(
  userId: string,
  data: CreateUserPayload,
): Promise<UserMutationResult> {
  const res = await api.put<ApiResponse<ApiDetail<User>>>(`/api/v1/users/${userId}`, data);
  return {
    message: res.data.response_schema.response_message,
    data: res.data.response_output!.detail,
  };
}

export async function deleteUser(userId: string): Promise<{ message: string }> {
  const res = await api.delete<ApiResponse<null>>(`/api/v1/users/${userId}`);
  return { message: res.data.response_schema.response_message };
}

export async function restoreUser(userId: string): Promise<UserMutationResult> {
  const res = await api.patch<ApiResponse<ApiDetail<User>>>(`/api/v1/users/${userId}/restore`);
  return {
    message: res.data.response_schema.response_message,
    data: res.data.response_output!.detail,
  };
}

export async function getRoleOptions(search?: string): Promise<SelectOption[]> {
  const res = await api.get<ApiResponse<ApiList<{ id: number | string; name: string }>>>(
    '/api/v1/roles',
    {
      params: { search, page: 0, size: 999999, status: 'active' },
    },
  );
  const content = res.data.response_output?.list.content ?? [];
  return content.map((r) => ({
    label: r.name,
    value: String(r.id),
  }));
}

export async function exportUsers(params?: GetUsersParams): Promise<Blob> {
  const res = await api.get('/api/v1/users/export', { params, responseType: 'blob' });
  return res.data as Blob;
}

export async function bulkUploadUsers(file: File): Promise<BulkUploadResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post<ApiResponse<BulkUploadResult>>('/api/v1/users/bulk-upload', form);
  return res.data.response_output!;
}

export async function downloadUserTemplate(): Promise<Blob> {
  const res = await api.get('/api/v1/users/bulk-template', { responseType: 'blob' });
  return res.data as Blob;
}
