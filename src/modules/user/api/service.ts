// Dibangkitkan oleh Midas Code Builder — jangan diedit manual; ubah desain/konfigurasi lalu generate ulang.
import api from '../../../shared/lib/api';
import type { ApiDetail, ApiList, ApiResponse } from '../../../shared/types';
import type { User, UserInput, UserListParams } from '../types';

const BASE = '/api/v1/user';

export async function list(params: UserListParams): Promise<{ rows: User[]; total: number }> {
  const { data } = await api.get<ApiResponse<ApiList<User>>>(BASE, { params });
  const out = data.response_output!.list;
  return { rows: out.content, total: out.pagination?.total_elements ?? out.content.length };
}
export async function detail(id: string): Promise<User> {
  const { data } = await api.get<ApiResponse<ApiDetail<User>>>(`${BASE}/${id}`);
  return data.response_output!.detail;
}
export async function create(input: UserInput): Promise<User> {
  const { data } = await api.post<ApiResponse<ApiDetail<User>>>(BASE, input);
  return data.response_output!.detail;
}
export async function update(id: string, input: UserInput): Promise<User> {
  const { data } = await api.put<ApiResponse<ApiDetail<User>>>(`${BASE}/${id}`, input);
  return data.response_output!.detail;
}
export async function remove(id: string): Promise<void> {
  await api.delete(`${BASE}/${id}`);
}
