import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useToast, Badge } from '../../../../shared/components/ui';
import type { DetailRow } from '../../../../shared/components/ui';
import type { SubmitResult } from '../../../../shared/types';
import {
  isConnectionError,
  mapSubmitError,
  splitFieldErrors,
  getErrorStateType,
} from '../../../../shared/utils';
import type { Role } from '../types';
import {
  useRoleDetailQuery,
  useUpsertRole,
  useRolePermissionsQuery,
} from '../api';
import PermissionTable from '../components/PermissionTable';

export interface FormValues {
  name: string;
  permissions: string[];
}

function buildDefaultValues(role?: Role): FormValues {
  return role
    ? { name: role.name, permissions: [...role.permissions] }
    : { name: '', permissions: [] };
}

export function useRoleForm(id?: string) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const isEdit = !!id;

  const query = useRoleDetailQuery(id);
  const permissionsQuery = useRolePermissionsQuery();
  const upsertMutation = useUpsertRole();

  const role = query.data;

  async function onSubmit(data: FormValues): Promise<SubmitResult> {
    try {
      const res = await upsertMutation.mutateAsync({
        id: isEdit ? id : undefined,
        data: { name: data.name, permissions: data.permissions },
      });

      showToast({
        message: res.message,
        variant: 'success',
      });
      setTimeout(() => navigate('/user-management/role'), 500);
      return { success: true };
    } catch (err: unknown) {
      const fallback = isEdit
        ? t('runtime.saveFailedUpdate', { singular: t('role.label') })
        : t('runtime.saveFailedCreate', { singular: t('role.label') });
      const result = mapSubmitError(err, fallback);
      if (result.fieldErrors) {
        const { fieldErrors, unknownMessage } = splitFieldErrors(
          result.fieldErrors,
          (field) => field,
        );
        if (unknownMessage) showToast({ message: unknownMessage, variant: 'error' });
        return Object.keys(fieldErrors).length > 0
          ? { success: false, fieldErrors }
          : { success: false };
      }
      if (result.toastMessage) {
        showToast({ message: result.toastMessage, variant: 'error' });
      }
      return result;
    }
  }

  function onCancel() {
    navigate(-1);
  }

  const catalog = permissionsQuery.data ?? [];

  const detailRows = useMemo<DetailRow[]>(() => {
    if (!role) {
      return [
        { label: t('table.status'), value: '' },
        { label: t('role.fields.name.label'), value: '' },
        { label: t('role.fields.permissions.label'), value: '' },
      ];
    }

    return [
      {
        label: t('table.status'),
        value: (
          <Badge variant={role.status === 'active' ? 'success' : 'secondary'}>
            {role.status === 'active' ? t('common.active') : t('common.inactive')}
          </Badge>
        ),
      },
      { label: t('role.fields.name.label'), value: role.name },
      { label: t('table.createdBy'), value: role.createdBy },
      { label: t('table.createdDate'), value: role.createdDate },
      {
        label: t('role.fields.permissions.label'),
        value: (
          <PermissionTable
            catalog={catalog}
            value={role.permissions}
            disabled
            testId="role-permissions-view"
          />
        ),
      },
    ];
  }, [role, catalog]);

  const queryStatus: 'loading' | 'error' | 'success' = query.isLoading
    ? 'loading'
    : query.error
      ? 'error'
      : 'success';

  const defaultValues = useMemo(() => buildDefaultValues(role), [role]);

  return {
    queryStatus,
    queryMessage: query.error?.message ?? undefined,
    errorType: query.error ? getErrorStateType(query.error) : undefined,
    isNetworkError: query.error ? isConnectionError(query.error) : false,
    role,
    refresh: () => query.refetch(),
    detailRows,
    defaultValues,
    isSubmitting: upsertMutation.isPending,
    isEdit,
    onSubmit,
    onCancel,
    permissionCatalog: catalog,
  };
}
