import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteRegion, restoreRegion, createRegion, updateRegion, bulkUploadRegions } from './resolver';
import type { CreateRegionPayload } from '../types';

export function useDeleteRegion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRegion(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['regions'] }),
  });
}

export function useRestoreRegion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restoreRegion(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['regions'] }),
  });
}

export function useUpsertRegion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: CreateRegionPayload }) =>
      id ? updateRegion(id, data) : createRegion(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['regions'] });
      if (variables.id) {
        queryClient.invalidateQueries({ queryKey: ['region', variables.id] });
      }
    },
  });
}

export function useBulkUploadRegion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => bulkUploadRegions(file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['regions'] }),
  });
}
