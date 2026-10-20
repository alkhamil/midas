import { t } from 'i18next';
import '../../../../shared/i18n';
import type { UserListItem } from '../types';
import { Table, Badge } from '../../../../shared/components/ui';

import { formatDateTime } from '../../../../shared/utils';
import { Eye, Pencil, Trash2, RotateCcw } from 'lucide-react';

interface Props {
  testId?: string;
  data: UserListItem[];
  totalRecords: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  stickyAction?: boolean;
  onView?: (user: UserListItem) => void;
  onEdit?: (user: UserListItem) => void;
  onDelete?: (user: UserListItem) => void;
  onRestore?: (user: UserListItem) => void;
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

function UserTable({
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
      header: t('user.fields.name.label'),
      sortable: true,
      className: 'w-55',
    },
    { key: 'username', header: t('user.fields.username.label'), sortable: true, className: 'w-55' },
    { key: 'email', header: t('user.fields.email.label'), className: 'w-55' },
    { key: 'role_name', header: t('user.fields.role.label'), className: 'w-40' },
    { key: 'created_by', header: t('table.createdBy'), className: 'w-40' },
    {
      key: 'created_date',
      header: t('table.createdDate'),
      render: (user: UserListItem) => formatDateTime(user.created_date),
      className: 'w-40',
    },
    {
      key: 'status',
      header: t('table.status'),
      sortable: false,
      className: 'w-40',
      render: (user: UserListItem) => (
        <Badge variant={user.status === 'active' ? 'success' : 'secondary'}>
          {user.status === 'active' ? t('common.active') : t('common.inactive')}
        </Badge>
      ),
    },
  ];

  return (
    <Table<UserListItem>
      actionWidth="w-40"
      testId={testId}
      columns={columns}
      data={data}
      rowKey={(r) => String(r.id)}
      fixedLayout={true}
      renderAction={(user) => (
        <div className="flex justify-evenly w-full gap-1">
          {onView && (
            <button
              data-testid={`user-view-${user.id}`}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md hover:bg-muted"
              title={`View ${user.name}`}
              onClick={() => onView(user)}
            >
              <Eye className="h-4 w-4 text-info" />
            </button>
          )}
          {onEdit && (
            <button
              data-testid={`user-edit-${user.id}`}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md hover:bg-muted"
              title={`Edit ${user.name}`}
              onClick={() => onEdit(user)}
            >
              <Pencil className="h-4 w-4 text-warning" />
            </button>
          )}
          {user.status === 'active' && onDelete && (
            <button
              data-testid={`user-delete-${user.id}`}
              className={`flex h-7 w-7 items-center justify-center rounded-md ${isDeleting ? 'cursor-not-allowed opacity-40' : 'hover:bg-muted cursor-pointer'}`}
              title={`Delete ${user.name}`}
              onClick={() => onDelete(user)}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4 text-danger" />
            </button>
          )}
          {user.status === 'inactive' && onRestore && (
            <button
              data-testid={`user-restore-${user.id}`}
              className={`flex h-7 w-7 items-center justify-center rounded-md ${isRestoring ? 'cursor-not-allowed opacity-40' : 'hover:bg-muted cursor-pointer'}`}
              title={`Restore ${user.name}`}
              onClick={() => onRestore(user)}
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

export default UserTable;
