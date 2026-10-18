// Dibangkitkan oleh Midas Code Builder — jangan diedit manual; ubah desain/konfigurasi lalu generate ulang.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RoleInput, RoleListParams } from '../types';
import * as resolver from './resolver';

const KEY = 'role';

export const useRoleList = (params: RoleListParams) => useQuery({ queryKey: [KEY, 'list', params], queryFn: () => resolver.list(params) });
export const useRoleDetail = (id: string) => useQuery({ queryKey: [KEY, 'detail', id], queryFn: () => resolver.detail(id), enabled: !!id });

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: RoleInput) => resolver.create(input), onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }) });
}
export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (v: { id: string; input: RoleInput }) => resolver.update(v.id, v.input), onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }) });
}
export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => resolver.remove(id), onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }) });
}
