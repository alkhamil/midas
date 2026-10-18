// Dibangkitkan oleh Midas Code Builder — jangan diedit manual; ubah desain/konfigurasi lalu generate ulang.
import api from '../../../shared/lib/api';
import type { ApiDetail, ApiList, ApiResponse } from '../../../shared/types';
import type { Role, RoleInput, RoleListParams } from '../types';

const BASE = '/api/v1/role';

export async function list(params: RoleListParams): Promise<{ rows: Role[]; total: number }> {
  const { data } = await api.get<ApiResponse<ApiList<Role>>>(BASE, { params });
  const out = data.response_output!.list;
  return { rows: out.content, total: out.pagination?.total_elements ?? out.content.length };
}
export async function detail(id: string): Promise<Role> {
  const { data } = await api.get<ApiResponse<ApiDetail<Role>>>(`${BASE}/${id}`);
  return data.response_output!.detail;
}
export async function create(input: RoleInput): Promise<Role> {
  const { data } = await api.post<ApiResponse<ApiDetail<Role>>>(BASE, input);
  return data.response_output!.detail;
}
export async function update(id: string, input: RoleInput): Promise<Role> {
  const { data } = await api.put<ApiResponse<ApiDetail<Role>>>(`${BASE}/${id}`, input);
  return data.response_output!.detail;
}
export async function remove(id: string): Promise<void> {
  await api.delete(`${BASE}/${id}`);
}
