// Dibangkitkan oleh Midas Code Builder — jangan diedit manual; ubah desain/konfigurasi lalu generate ulang.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserInput, UserListParams } from '../types';
import * as resolver from './resolver';

const KEY = 'user';

export const useUserList = (params: UserListParams) => useQuery({ queryKey: [KEY, 'list', params], queryFn: () => resolver.list(params) });
export const useUserDetail = (id: string) => useQuery({ queryKey: [KEY, 'detail', id], queryFn: () => resolver.detail(id), enabled: !!id });

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: UserInput) => resolver.create(input), onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }) });
}
export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (v: { id: string; input: UserInput }) => resolver.update(v.id, v.input), onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }) });
}
export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => resolver.remove(id), onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }) });
}
