/** Halaman list generik — filter/sort/paging + aksi tulis + export/bulk. */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Button, Card, Dialog, FilterToolbar } from '../../../shared/components/ui';
import { Info, Download, Plus, Trash2, Upload } from 'lucide-react';
import { useAuth } from '../../../app/providers';
import { listEmptyState } from '../../../shared/constants';
import type { ModuleDefinition } from '../definitions';
import { definitionPermissions, definitionTestId } from './types';
import { moduleTitle } from './moduleI18n';
import {
  useDynamicExport,
  useDynamicList,
  useDynamicListActions,
  useDynamicListFilter,
} from './hooks';
import DynamicTable from './DynamicTable';
import DynamicBulkUploadDialog from './DynamicBulkUploadDialog';

function DynamicListPage({ def }: { def: ModuleDefinition }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = useAuth();
  const permissions = definitionPermissions(def.permissionKey);
  const canView = def.features.detail && can(permissions.view);
  const canCreate = def.features.create && can(permissions.create);
  const canUpdate = def.features.edit && can(permissions.update);
  const canDelete = def.features.delete && can(permissions.delete);
  const canExport = def.features.export && can(permissions.export);
  const canBulkUpload = def.features.bulkUpload && can(permissions.bulkUpload);
  const testPrefix = definitionTestId(def.key);
  const emptyState = listEmptyState(def.singularLabel);
  // Wording kustom dari props tabel (kanvas List); kosong = bawaan.
  const customEmpty = def.layout?.table?.props;
  const [bulkOpen, setBulkOpen] = useState(false);

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
  } = useDynamicListFilter(def);

  const { rows, totalRecords, isLoading, error, refresh } = useDynamicList(def, queryParams);

  const {
    deleteTarget,
    restoreTarget,
    isDeleting,
    isRestoring,
    handleDeleteClick,
    handleDeleteCancel,
    handleDelete,
    handleRestoreClick,
    handleRestoreCancel,
    handleRestore,
  } = useDynamicListActions(def);

  const { exportData, isExporting } = useDynamicExport(def);

  const isEmptyState = !isFilterActive && rows.length === 0;
  const isFilteredEmptyState = isFilterActive && rows.length === 0;
  const isHardDelete = def.deleteMode === 'hard';

  return (
    <div data-testid={`${testPrefix}-list-page`}>
      <Card
        testId={`${testPrefix}-list-card`}
        title={moduleTitle(def, 'list', t('runtime.listTitle', { singular: def.singularLabel }))}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canExport && (
              <Button
                data-testid={`${testPrefix}-export-button`}
                variant="secondary"
                icon={<Download />}
                onClick={() => exportData(queryParams)}
                disabled={isExporting}
              >
                {isExporting ? t('runtime.exporting') : t('common.export')}
              </Button>
            )}
            {canBulkUpload && (
              <Button
                data-testid={`${testPrefix}-bulk-upload-button`}
                variant="secondary"
                icon={<Upload />}
                onClick={() => setBulkOpen(true)}
              >
                {t('common.bulkUpload')}
              </Button>
            )}
            {canCreate && (
              <Button
                data-testid={`${testPrefix}-create-button`}
                icon={<Plus />}
                onClick={() => navigate(`/${def.routeBase}/create`)}
              >
                {moduleTitle(def, 'create', t('runtime.createTitle', { singular: def.singularLabel }))}
              </Button>
            )}
          </div>
        }
      >
        <div className="mb-4">
          <FilterToolbar
            testId={`${testPrefix}-filter`}
            searchValue={searchQuery}
            onSearchChange={handleSearchChange}
            filterFields={filterFields}
            filterValues={filterValues}
            onApply={handleApply}
            onReset={handleReset}
            searchParamName="search"
          />
        </div>
        <DynamicTable
          testId={`${testPrefix}-table`}
          def={def}
          data={rows}
          totalRecords={totalRecords}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          stickyAction
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          onView={canView ? (item) => navigate(`/${def.routeBase}/${item.id}/view`) : undefined}
          onEdit={canUpdate ? (item) => navigate(`/${def.routeBase}/${item.id}/edit`) : undefined}
          onDelete={canDelete ? handleDeleteClick : undefined}
          onRestore={canDelete && !isHardDelete ? handleRestoreClick : undefined}
          isDeleting={isDeleting}
          isRestoring={isRestoring}
          isEmptyState={isEmptyState}
          isFilteredEmptyState={isFilteredEmptyState}
          emptyStateTitle={customEmpty?.emptyStateTitle?.trim() || emptyState.title}
          emptyStateDescription={customEmpty?.emptyStateDescription?.trim() || emptyState.description}
          filteredEmptyStateTitle={customEmpty?.filteredEmptyStateTitle?.trim() || undefined}
          filteredEmptyStateDescription={customEmpty?.filteredEmptyStateDescription?.trim() || undefined}
          loading={isLoading}
          error={error}
          onRetry={refresh}
        />
      </Card>

      {def.features.bulkUpload && (
        <DynamicBulkUploadDialog def={def} open={bulkOpen} onClose={() => setBulkOpen(false)} />
      )}

      <Dialog
        testId={`${testPrefix}-${isHardDelete ? 'delete' : 'deactivate'}-dialog`}
        open={!!deleteTarget}
        onClose={handleDeleteCancel}
        maxWidth="md"
        closeOnEscape
        closeOnBackdropClick
      >
        <div className="flex items-start gap-4">
          <Info className="h-12 w-12 shrink-0 text-warning" />
          <div>
            <p className="text-base font-medium text-foreground">
              {t('runtime.deleteTitle')}
            </p>
            <p className="mt-1 text-sm font-normal text-muted-foreground">
              {isHardDelete
                ? t('runtime.deleteHard') : t('runtime.deleteSoft')}
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            className="w-25"
            data-testid={`${testPrefix}-${isHardDelete ? 'delete' : 'deactivate'}-cancel`}
            onClick={handleDeleteCancel}
            disabled={isDeleting}
          >
            {t('common.cancel')}
          </Button>
          <Button
            data-testid={`${testPrefix}-${isHardDelete ? 'delete' : 'deactivate'}-confirm`}
            className="w-25"
            variant="danger"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {t('common.delete')}
          </Button>
        </div>
      </Dialog>

      {!isHardDelete && (
        <Dialog
          testId={`${testPrefix}-restore-dialog`}
          open={!!restoreTarget}
          onClose={handleRestoreCancel}
          maxWidth="md"
          closeOnEscape
          closeOnBackdropClick
        >
          <div className="flex items-start gap-4">
            <Info className="h-12 w-12 shrink-0 text-success" />
            <div>
              <p className="text-base font-medium text-foreground">
                {t('runtime.restoreTitle')}
              </p>
              <p className="mt-1 text-sm font-normal text-muted-foreground">
                {t('runtime.restoreDesc')}
              </p>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              className="w-25"
              data-testid={`${testPrefix}-restore-cancel`}
              onClick={handleRestoreCancel}
              disabled={isRestoring}
            >
              {t('common.cancel')}
            </Button>
            <Button
              data-testid={`${testPrefix}-restore-confirm`}
              className="w-25"
              onClick={handleRestore}
              disabled={isRestoring}
            >
              {t('common.restore')}
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

export default DynamicListPage;
