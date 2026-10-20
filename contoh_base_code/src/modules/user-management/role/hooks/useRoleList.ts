import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../../shared/components/ui';
import type { RoleListItem, GetRolesParams } from '../types';
import { useRoleListQuery, useDeleteRole, useRestoreRole } from '../api';
import { mapSubmitError } from '../../../../shared/utils';

export function useRoleList(params: GetRolesParams) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<RoleListItem | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<RoleListItem | null>(null);

  const query = useRoleListQuery(params);
  const deleteMutation = useDeleteRole();
  const restoreMutation = useRestoreRole();

  function handleDeleteClick(role: RoleListItem) {
    setDeleteTarget(role);
  }

  function handleDeleteCancel() {
    setDeleteTarget(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await deleteMutation.mutateAsync(String(deleteTarget.id));
      setDeleteTarget(null);
      showToast({ message: res.message, variant: 'success' });
    } catch (err: unknown) {
      const fallback = t('runtime.deleteFailed', { singular: t('role.label') });
      const result = mapSubmitError(err, fallback);
      showToast({ message: result.toastMessage ?? fallback, variant: 'error' });
    }
  }

  function handleRestoreClick(role: RoleListItem) {
    setRestoreTarget(role);
  }

  function handleRestoreCancel() {
    setRestoreTarget(null);
  }

  async function handleRestore() {
    if (!restoreTarget) return;
    try {
      const res = await restoreMutation.mutateAsync(String(restoreTarget.id));
      setRestoreTarget(null);
      showToast({ message: res.message, variant: 'success' });
    } catch (err: unknown) {
      const fallback = t('runtime.restoreFailed', { singular: t('role.label') });
      const result = mapSubmitError(err, fallback);
      showToast({ message: result.toastMessage ?? fallback, variant: 'error' });
    }
  }

  return {
    roles: query.data?.list.content ?? [],
    totalRecords: query.data?.list.pagination?.total_elements ?? 0,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refresh: () => query.refetch(),
    deleteTarget,
    isDeleting: deleteMutation.isPending,
    handleDeleteClick,
    handleDeleteCancel,
    handleDelete,
    restoreTarget,
    isRestoring: restoreMutation.isPending,
    handleRestoreClick,
    handleRestoreCancel,
    handleRestore,
  };
}
