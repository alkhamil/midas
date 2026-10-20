import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteRole, restoreRole, createRole, updateRole, bulkUploadRoles } from './resolver';
import type { CreateRolePayload } from '../types';

export function useDeleteRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
  });
}

export function useRestoreRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restoreRole(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
  });
}

export function useUpsertRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: CreateRolePayload }) =>
      id ? updateRole(id, data) : createRole(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      if (variables.id) {
        queryClient.invalidateQueries({ queryKey: ['role', variables.id] });
      }
    },
  });
}

export function useBulkUploadRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => bulkUploadRoles(file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
  });
}
