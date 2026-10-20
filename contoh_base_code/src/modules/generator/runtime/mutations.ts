/** Mutation generik runtime (invalidate cache list/detail modul). */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ModuleDefinition } from '../definitions';
import {
  bulkUploadRecords,
  createRecord,
  deleteRecord,
  restoreRecord,
  updateRecord,
} from './recordsApi';

function listKey(def: ModuleDefinition): [string, string] {
  return ['dynamic-records', def.key];
}

export function useDeleteDynamicRecord(def: ModuleDefinition) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRecord(def, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listKey(def) }),
  });
}

export function useRestoreDynamicRecord(def: ModuleDefinition) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restoreRecord(def, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listKey(def) }),
  });
}

export function useUpsertDynamicRecord(def: ModuleDefinition) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Record<string, unknown> }) =>
      id ? updateRecord(def, id, data) : createRecord(def, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: listKey(def) });
      if (variables.id) {
        queryClient.invalidateQueries({ queryKey: ['dynamic-record', def.key, variables.id] });
      }
    },
  });
}

export function useBulkUploadDynamic(def: ModuleDefinition) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => bulkUploadRecords(def, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listKey(def) }),
  });
}
