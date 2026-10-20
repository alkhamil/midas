import api from '../../../../shared/lib/api';
import type {
  Role,
  RoleMutationResult,
  CreateRolePayload,
  GetRolesParams,
  RoleListItem,
  BulkUploadResult,
} from '../types';
import type { ApiDetail, ApiList, ApiResponse } from '../../../../shared/types';

export async function getRoles(params?: GetRolesParams): Promise<ApiList<RoleListItem>> {
  const res = await api.get<ApiResponse<ApiList<RoleListItem>>>('/api/v1/roles', { params });
  return res.data.response_output ?? { list: { pagination: null, content: [] } };
}

export async function getRoleById(id: string): Promise<Role> {
  const res = await api.get<ApiResponse<ApiDetail<Role>>>(`/api/v1/roles/${id}`);
  return res.data.response_output!.detail;
}

export async function createRole(data: CreateRolePayload): Promise<RoleMutationResult> {
  const res = await api.post<ApiResponse<ApiDetail<Role>>>('/api/v1/roles', data);
  return {
    message: res.data.response_schema.response_message,
    data: res.data.response_output!.detail,
  };
}

export async function updateRole(id: string, data: CreateRolePayload): Promise<RoleMutationResult> {
  const res = await api.put<ApiResponse<ApiDetail<Role>>>(`/api/v1/roles/${id}`, data);
  return {
    message: res.data.response_schema.response_message,
    data: res.data.response_output!.detail,
  };
}

export async function deleteRole(id: string): Promise<{ message: string }> {
  const res = await api.delete<ApiResponse<null>>(`/api/v1/roles/${id}`);
  return { message: res.data.response_schema.response_message };
}

export async function getPermissions(): Promise<string[]> {
  const res = await api.get<ApiResponse<ApiList<string>>>('/api/v1/roles/permissions');
  return res.data.response_output?.list.content ?? [];
}

export async function restoreRole(id: string): Promise<RoleMutationResult> {
  const res = await api.patch<ApiResponse<ApiDetail<Role>>>(`/api/v1/roles/${id}/restore`);
  return {
    message: res.data.response_schema.response_message,
    data: res.data.response_output!.detail,
  };
}

export async function exportRoles(params?: GetRolesParams): Promise<Blob> {
  const res = await api.get('/api/v1/roles/export', { params, responseType: 'blob' });
  return res.data as Blob;
}

export async function bulkUploadRoles(file: File): Promise<BulkUploadResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post<ApiResponse<BulkUploadResult>>('/api/v1/roles/bulk-upload', form);
  return res.data.response_output!;
}

export async function downloadRoleTemplate(): Promise<Blob> {
  const res = await api.get('/api/v1/roles/bulk-template', { responseType: 'blob' });
  return res.data as Blob;
}
