import api from '../../../shared/lib/api';
import type {
  Region,
  RegionMutationResult,
  BulkUploadResult,
  CreateRegionPayload,
  GetRegionsParams,
  RegionListItem,
  SelectOption,
} from '../types';
import type { ApiDetail, ApiList, ApiResponse } from '../../../shared/types';

export async function getRegions(params?: GetRegionsParams): Promise<ApiList<RegionListItem>> {
  const res = await api.get<ApiResponse<ApiList<RegionListItem>>>('/api/v1/regions', { params });
  return res.data.response_output ?? { list: { pagination: null, content: [] } };
}

export async function getRegionById(id: string): Promise<Region> {
  const res = await api.get<ApiResponse<ApiDetail<Region>>>(`/api/v1/regions/${id}`);
  return res.data.response_output!.detail;
}

export async function createRegion(data: CreateRegionPayload): Promise<RegionMutationResult> {
  const res = await api.post<ApiResponse<ApiDetail<Region>>>('/api/v1/regions', data);
  return {
    message: res.data.response_schema.response_message,
    data: res.data.response_output!.detail,
  };
}

export async function updateRegion(
  id: string,
  data: CreateRegionPayload,
): Promise<RegionMutationResult> {
  const res = await api.put<ApiResponse<ApiDetail<Region>>>(`/api/v1/regions/${id}`, data);
  return {
    message: res.data.response_schema.response_message,
    data: res.data.response_output!.detail,
  };
}

export async function deleteRegion(id: string): Promise<{ message: string }> {
  const res = await api.delete<ApiResponse<null>>(`/api/v1/regions/${id}`);
  return { message: res.data.response_schema.response_message };
}

export async function restoreRegion(id: string): Promise<RegionMutationResult> {
  const res = await api.patch<ApiResponse<ApiDetail<Region>>>(`/api/v1/regions/${id}/restore`);
  return {
    message: res.data.response_schema.response_message,
    data: res.data.response_output!.detail,
  };
}

export async function getSelectOptions(): Promise<SelectOption[]> {
  const res = await api.get<ApiResponse<ApiList<SelectOption>>>('/api/v1/regions/selects');
  return res.data.response_output?.list.content ?? [];
}

export async function exportRegions(params?: GetRegionsParams): Promise<Blob> {
  const res = await api.get('/api/v1/regions/export', { params, responseType: 'blob' });
  return res.data as Blob;
}

export async function bulkUploadRegions(file: File): Promise<BulkUploadResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post<ApiResponse<BulkUploadResult>>('/api/v1/regions/bulk-upload', form);
  return res.data.response_output!;
}

export async function downloadRegionTemplate(): Promise<Blob> {
  const res = await api.get('/api/v1/regions/bulk-template', { responseType: 'blob' });
  return res.data as Blob;
}
