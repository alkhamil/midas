import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import '../../../../shared/i18n';
import { Card, Button, FilterToolbar, Dialog } from '../../../../shared/components/ui';

import { useUserList, useUserListFilter, useUserExport } from '../hooks';
import { UserTable, UserBulkUploadDialog } from '../components';
import { UserPermissions } from '../permissions';
import { useAuth } from '../../../../app/providers';
import { listEmptyState } from '../../../../shared/constants';
import { Info, Plus, Download, Upload } from 'lucide-react';

function UserList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // EMPTY_STATE di dalam komponen agar t() dievaluasi setelah locale terdaftar.
  const EMPTY_STATE = listEmptyState(t('user.label'));
  const { can } = useAuth();
  const canView = can(UserPermissions.view);
  const canCreate = can(UserPermissions.create);
  const canUpdate = can(UserPermissions.update);
  const canDelete = can(UserPermissions.delete);
  const canExport = can(UserPermissions.export);
  const canBulkUpload = can(UserPermissions.bulkUpload);
  const [bulkOpen, setBulkOpen] = useState(false);
  const { exportData, isExporting } = useUserExport();
  const {
    filterFields,
    page,
    setPage,
    pageSize,
    handlePageSizeChange,
    sortKey,
    sortDir,
    searchQuery,
    filterValues,
    queryParams,
    isFilterActive,
    handleSearchChange,
    handleApply,
    handleReset,
    handleSort,
  } = useUserListFilter();

  const {
    users,
    totalRecords,
    isLoading,
    error,
    refresh,
    deleteTarget,
    isDeleting,
    handleDeleteClick,
    handleDeleteCancel,
    handleDelete,
    restoreTarget,
    isRestoring,
    handleRestoreClick,
    handleRestoreCancel,
    handleRestore,
  } = useUserList(queryParams);

  const isEmptyState = !isFilterActive && users.length === 0;
  const isFilteredEmptyState = isFilterActive && users.length === 0;

  return (
    <div data-testid="user-list-page">
      <Card
        testId="user-list-card"
        title={t('runtime.listTitle', { singular: t('user.label') })}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canExport && (
              <Button
                data-testid="user-export-button"
                variant="secondary"
                icon={<Download className="h-4 w-4" />}
                onClick={() => exportData(queryParams)}
                disabled={isExporting}
              >
                {isExporting ? t('runtime.exporting') : t('common.export')}
              </Button>
            )}
            {canBulkUpload && (
              <Button
                data-testid="user-bulk-upload-button"
                variant="secondary"
                icon={<Upload className="h-4 w-4" />}
                onClick={() => setBulkOpen(true)}
              >
                {t('common.bulkUpload')}
              </Button>
            )}
            {canCreate && (
              <Button
                data-testid="user-create-button"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => navigate('/user-management/user/create')}
              >
                {t('runtime.createTitle', { singular: t('user.label') })}
              </Button>
            )}
          </div>
        }
      >
        <div className="mb-4">
          <FilterToolbar
            testId="user-filter"
            searchValue={searchQuery}
            onSearchChange={handleSearchChange}
            filterFields={filterFields}
            filterValues={filterValues}
            onApply={handleApply}
            onReset={handleReset}
            searchParamName="search"
          />
        </div>
        <UserTable
          testId="user-table"
          data={users}
          totalRecords={totalRecords}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          stickyAction
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          onView={
            canView
              ? (user) => navigate(`/user-management/user/${user.id}/view`)
              : undefined
          }
          onEdit={
            canUpdate
              ? (user) => navigate(`/user-management/user/${user.id}/edit`)
              : undefined
          }
          onDelete={canDelete ? handleDeleteClick : undefined}
          onRestore={canUpdate ? handleRestoreClick : undefined}
          isDeleting={isDeleting}
          isRestoring={isRestoring}
          isEmptyState={isEmptyState}
          isFilteredEmptyState={isFilteredEmptyState}
          emptyStateTitle={EMPTY_STATE.title}
          emptyStateDescription={EMPTY_STATE.description}
          loading={isLoading}
          error={error}
          onRetry={refresh}
        />
      </Card>
      <UserBulkUploadDialog open={bulkOpen} onClose={() => setBulkOpen(false)} />

      <Dialog
        testId="user-deactivate-dialog"
        open={!!deleteTarget}
        onClose={handleDeleteCancel}
        maxWidth="md"
        closeOnEscape
        closeOnBackdropClick
      >
        <div className="flex items-start gap-4">
          <Info className="h-12 w-12 shrink-0 text-warning" />
          <div>
            <p className="text-base font-medium text-foreground">{t('runtime.deleteTitle')}</p>
            <p className="mt-1 text-sm font-normal text-muted-foreground">{t('runtime.deleteSoft')}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            className="w-25"
            data-testid="user-deactivate-cancel"
            onClick={handleDeleteCancel}
            disabled={isDeleting}
          >
            {t('common.cancel')}
          </Button>
          <Button
            data-testid="user-deactivate-confirm"
            className="w-25"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {t('common.delete')}
          </Button>
        </div>
      </Dialog>

      <Dialog
        testId="user-restore-dialog"
        open={!!restoreTarget}
        onClose={handleRestoreCancel}
        maxWidth="md"
        closeOnEscape
        closeOnBackdropClick
      >
        <div className="flex items-start gap-4">
          <Info className="h-12 w-12 shrink-0 text-success" />
          <div>
            <p className="text-base font-medium text-foreground">{t('runtime.restoreTitle')}</p>
            <p className="mt-1 text-sm font-normal text-muted-foreground">{t('runtime.restoreDesc')}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            className="w-25"
            data-testid="user-restore-cancel"
            onClick={handleRestoreCancel}
            disabled={isRestoring}
          >
            {t('common.cancel')}
          </Button>
          <Button
            data-testid="user-restore-confirm"
            className="w-25"
            onClick={handleRestore}
            disabled={isRestoring}
          >
            {t('common.restore')}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

export default UserList;
