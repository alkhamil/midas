import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteUser, restoreUser, createUser, updateUser, bulkUploadUsers } from './resolver';
import type { CreateUserPayload } from '../types';

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => deleteUser(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useRestoreUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => restoreUser(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpsertUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, data }: { userId?: string; data: CreateUserPayload }) =>
      userId ? updateUser(userId, data) : createUser(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      if (variables.userId) {
        queryClient.invalidateQueries({ queryKey: ['user', variables.userId] });
      }
    },
  });
}

export function useBulkUploadUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => bulkUploadUsers(file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}
