import { t } from 'i18next';
import '../../../../shared/i18n';
import type { RoleListItem } from '../types';
import { Table, Badge } from '../../../../shared/components/ui';

import { formatDateTime } from '../../../../shared/utils';
import { Eye, Pencil, RotateCcw, Trash2 } from 'lucide-react';

interface Props {
  testId?: string;
  data: RoleListItem[];
  totalRecords: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  stickyAction?: boolean;
  onView?: (role: RoleListItem) => void;
  onEdit?: (role: RoleListItem) => void;
  onDelete?: (role: RoleListItem) => void;
  onRestore?: (role: RoleListItem) => void;
  isDeleting?: boolean;
  isRestoring?: boolean;
  isEmptyState?: boolean;
  isFilteredEmptyState?: boolean;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  filteredEmptyStateTitle?: string;
  filteredEmptyStateDescription?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

function RoleTable({
  testId,
  onView,
  onEdit,
  onDelete,
  onRestore,
  isDeleting = false,
  isRestoring = false,
  data,
  isEmptyState,
  isFilteredEmptyState,
  ...rest
}: Props) {
  const columns = [
    {
      key: 'name',
      header: t('role.fields.name.label'),
      sortable: true,
      className: 'w-64',
    },
    {
      key: 'permissions',
      header: t('role.fields.permissions.label'),
      render: (role: RoleListItem) => role.permissions.join(', ') || '-',
    },
    { key: 'created_by', header: t('table.createdBy') },
    {
      key: 'created_date',
      header: t('table.createdDate'),
      render: (role: RoleListItem) => formatDateTime(role.created_date),
    },
    {
      key: 'status',
      header: t('table.status'),
      sortable: false,
      className: 'w-32',
      render: (role: RoleListItem) => (
        <Badge variant={role.status === 'active' ? 'success' : 'secondary'}>
          {role.status === 'active' ? t('common.active') : t('common.inactive')}
        </Badge>
      ),
    },
  ];

  return (
    <Table<RoleListItem>
      actionWidth="w-40"
      testId={testId}
      columns={columns}
      data={data}
      rowKey={(r) => String(r.id)}
      fixedLayout={true}
      renderAction={(role) => (
        <div className="flex justify-evenly w-full gap-1">
          {onView && (
            <button
              data-testid={`role-view-${role.id}`}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md hover:bg-muted"
              title={`View ${role.name}`}
              onClick={() => onView(role)}
            >
              <Eye className="h-4 w-4 text-info" />
            </button>
          )}
          {onEdit && (
            <button
              data-testid={`role-edit-${role.id}`}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md hover:bg-muted"
              title={`Edit ${role.name}`}
              onClick={() => onEdit(role)}
            >
              <Pencil className="h-4 w-4 text-warning" />
            </button>
          )}
          {role.status === 'active' && onDelete && (
            <button
              data-testid={`role-delete-${role.id}`}
              className={`flex h-7 w-7 items-center justify-center rounded-md ${isDeleting ? 'cursor-not-allowed opacity-40' : 'hover:bg-muted cursor-pointer'}`}
              title={`Delete ${role.name}`}
              onClick={() => onDelete(role)}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4 text-danger" />
            </button>
          )}
          {role.status === 'inactive' && onRestore && (
            <button
              data-testid={`role-restore-${role.id}`}
              className={`flex h-7 w-7 items-center justify-center rounded-md ${isRestoring ? 'cursor-not-allowed opacity-40' : 'hover:bg-muted cursor-pointer'}`}
              title={`Restore ${role.name}`}
              onClick={() => onRestore(role)}
              disabled={isRestoring}
            >
              <RotateCcw className="h-4 w-4 text-success" />
            </button>
          )}
        </div>
      )}
      isEmptyState={isEmptyState}
      isFilteredEmptyState={isFilteredEmptyState}
      {...rest}
    />
  );
}

export default RoleTable;
