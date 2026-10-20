import type { TemplateContext } from '../../engine/context';

export function listPageTemplate(ctx: TemplateContext): string {
  const { names, features } = ctx;
  const base = ctx.config.permissionKey;
  // Wording empty state kustom dari kanvas List (bake literal; kosong = bawaan).
  const emptyProps = ctx.config.tableProps;
  const emptyLine = (prop: string, value: string | undefined): string =>
    value?.trim() ? `          ${prop}=${JSON.stringify(value.trim())}\n` : '';
  const emptyTitleLine =
    emptyLine('emptyStateTitle', emptyProps?.emptyStateTitle) ||
    '          emptyStateTitle={EMPTY_STATE.title}\n';
  const emptyDescLine =
    emptyLine('emptyStateDescription', emptyProps?.emptyStateDescription) ||
    '          emptyStateDescription={EMPTY_STATE.description}\n';
  const filteredEmptyLines =
    emptyLine('filteredEmptyStateTitle', emptyProps?.filteredEmptyStateTitle) +
    emptyLine('filteredEmptyStateDescription', emptyProps?.filteredEmptyStateDescription);
  const withCreate = features.create;
  const withView = features.detail;
  const withEdit = features.edit;
  const withDelete = features.delete;
  const withBulk = features.bulkUpload;
  const withExport = features.export;
  const hasActions = withCreate || withBulk || withExport;
  const iconList = [
    withCreate ? 'Plus' : '',
    withDelete ? 'Info' : '',
    withExport ? 'Download' : '',
    withBulk ? 'Upload' : '',
  ].filter(Boolean);
  const needView = withView;
  const needCreate = withCreate;
  const needUpdate = withEdit;
  const needDelete = withDelete;
  const needAuth = needView || needCreate || needUpdate || needDelete || withExport || withBulk;

  return `${withBulk ? `import { useState } from 'react';\n` : ''}import { useTranslation } from 'react-i18next';\nimport { useNavigate } from 'react-router';
import { Card${hasActions ? ', Button' : ''}, FilterToolbar${withDelete ? ', Dialog' : ''} } from '${names.sharedPrefix}shared/components/ui';
${iconList.length > 0 ? `import { ${iconList.join(', ')} } from 'lucide-react';\n` : ''}
${needAuth ? `import { useAuth } from '${names.sharedPrefix}app/providers';\n` : ''}import { use${names.entity}List, use${names.entity}ListFilter${withExport ? `, use${names.entity}Export` : ''} } from '../hooks';
import { ${names.entity}Table${withBulk ? `, ${names.entity}BulkUploadDialog` : ''} } from '../components';
${needAuth ? `import { ${names.entity}Permissions } from '../permissions';\n` : ''}import { listEmptyState } from '${names.sharedPrefix}shared/constants';
import '${names.sharedPrefix}shared/i18n';

function ${names.entity}ListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // EMPTY_STATE di dalam komponen: t() modul dievaluasi saat render,
  // setelah addModuleLocales terdaftar (konstanta level-modul membeku jadi key mentah).
  const EMPTY_STATE = listEmptyState(t('${base}.label'));
${needAuth ? '  const { can } = useAuth();\n' : ''}${needView ? `  const canView = can(${names.entity}Permissions.view);\n` : ''}${needCreate ? `  const canCreate = can(${names.entity}Permissions.create);\n` : ''}${needUpdate ? `  const canUpdate = can(${names.entity}Permissions.update);\n` : ''}${needDelete ? `  const canDelete = can(${names.entity}Permissions.delete);\n` : ''}${withExport ? `  const canExport = can(${names.entity}Permissions.export);\n` : ''}${withBulk ? `  const canBulkUpload = can(${names.entity}Permissions.bulkUpload);\n` : ''}${withBulk ? '  const [bulkOpen, setBulkOpen] = useState(false);\n' : ''}${withExport ? `  const { exportData, isExporting } = use${names.entity}Export();\n` : ''}
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
  } = use${names.entity}ListFilter();

  const {
    ${names.camel}s,
    totalRecords,
    isLoading,
    error,
    refresh,${withDelete ? `
    deleteTarget,
    isDeleting,
    handleDeleteClick,
    handleDeleteCancel,
    handleDelete,
    restoreTarget,
    isRestoring,
    handleRestoreClick,
    handleRestoreCancel,
    handleRestore,` : ''}
  } = use${names.entity}List(queryParams);

  const isEmptyState = !isFilterActive && ${names.camel}s.length === 0;
  const isFilteredEmptyState = isFilterActive && ${names.camel}s.length === 0;

  return (
    <div data-testid="${names.testId}-list-page">
      <Card
        testId="${names.testId}-list-card"
        title={t('runtime.listTitle', { singular: t('${base}.label') })}
${
  withCreate || withBulk || withExport
    ? `        actions={
          <div className="flex flex-wrap items-center gap-2">
${withExport ? `            {canExport && (\n              <Button\n                data-testid="${names.testId}-export-button"\n                variant="secondary"\n                icon={<Download />}\n                onClick={() => exportData(queryParams)}\n                disabled={isExporting}\n              >\n                {isExporting ? t('runtime.exporting') : t('common.export')}\n              </Button>\n            )}\n` : ''}${withBulk ? `            {canBulkUpload && (\n              <Button\n                data-testid="${names.testId}-bulk-upload-button"\n                variant="secondary"\n                icon={<Upload />}\n                onClick={() => setBulkOpen(true)}\n              >\n                {t('common.bulkUpload')}\n              </Button>\n            )}\n` : ''}${withCreate ? `            {canCreate && (\n              <Button\n                data-testid="${names.testId}-create-button"\n                icon={<Plus />}\n                onClick={() => navigate('/${names.routeBase}/create')}\n              >\n                {t('runtime.createTitle', { singular: t('${base}.label') })}\n              </Button>\n            )}\n` : ''}          </div>
        }
`
    : ''
}      >
        <div className="mb-4">
          <FilterToolbar
            testId="${names.testId}-filter"
            searchValue={searchQuery}
            onSearchChange={handleSearchChange}
            filterFields={filterFields}
            filterValues={filterValues}
            onApply={handleApply}
            onReset={handleReset}
            searchParamName="search"
          />
        </div>
        <${names.entity}Table
          testId="${names.testId}-table"
          data={${names.camel}s}
          totalRecords={totalRecords}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          stickyAction
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
${withView ? `          onView={canView ? (item) => navigate(\`/${names.routeBase}/\${item.id}/view\`) : undefined}\n` : ''}${withEdit ? `          onEdit={canUpdate ? (item) => navigate(\`/${names.routeBase}/\${item.id}/edit\`) : undefined}\n` : ''}${withDelete ? `          onDelete={canDelete ? handleDeleteClick : undefined}
          onRestore={canDelete ? handleRestoreClick : undefined}
          isDeleting={isDeleting}
          isRestoring={isRestoring}
` : ''}          isEmptyState={isEmptyState}
          isFilteredEmptyState={isFilteredEmptyState}
${emptyTitleLine}${emptyDescLine}${filteredEmptyLines}          loading={isLoading}
          error={error}
          onRetry={refresh}
        />
      </Card>
${withBulk ? `      <${names.entity}BulkUploadDialog open={bulkOpen} onClose={() => setBulkOpen(false)} />\n` : ''}${withDelete ? `
      <Dialog
        testId="${names.testId}-deactivate-dialog"
        open={!!deleteTarget}
        onClose={handleDeleteCancel}
        maxWidth="md"
        closeOnEscape
        closeOnBackdropClick
      >
        <div className="flex items-start gap-4">
          <Info className="h-12 w-12 shrink-0" />
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
            data-testid="${names.testId}-deactivate-cancel"
            onClick={handleDeleteCancel}
            disabled={isDeleting}
          >
            {t('common.cancel')}
          </Button>
          <Button
            data-testid="${names.testId}-deactivate-confirm"
            className="w-25"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {t('common.delete')}
          </Button>
        </div>
      </Dialog>

      <Dialog
        testId="${names.testId}-restore-dialog"
        open={!!restoreTarget}
        onClose={handleRestoreCancel}
        maxWidth="md"
        closeOnEscape
        closeOnBackdropClick
      >
        <div className="flex items-start gap-4">
          <Info className="h-12 w-12 shrink-0" />
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
            data-testid="${names.testId}-restore-cancel"
            onClick={handleRestoreCancel}
            disabled={isDeleting}
          >
            {t('common.cancel')}
          </Button>
          <Button
            data-testid="${names.testId}-restore-confirm"
            className="w-25"
            onClick={handleRestore}
            disabled={isRestoring}
          >
            {t('common.restore')}
          </Button>
        </div>
      </Dialog>
` : ''}    </div>
  );
}

export default ${names.entity}ListPage;
`;
}

export function createPageTemplate(ctx: TemplateContext): string {
  const { names, fields } = ctx;
  const optionsFields = fields.filter((f) => f.isOptionsQuery);
  return `import { use${names.entity}Form } from '../hooks';
import { ${names.entity}Form } from '../components';

function ${names.entity}CreatePage() {
  const { defaultValues, onSubmit, onCancel${optionsFields.map((f) => `, ${f.name}Options`).join('')}, isSubmitting } = use${names.entity}Form();

  return (
    <${names.entity}Form
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onCancel={onCancel}
${optionsFields.map((f) => `      ${f.name}Options={${f.name}Options}`).join('\n')}
${optionsFields.length > 0 ? '' : ''}      isSubmitting={isSubmitting}
    />
  );
}

export default ${names.entity}CreatePage;
`;
}

export function viewPageTemplate(ctx: TemplateContext): string {
  const { names, features } = ctx;
  const base = ctx.config.permissionKey;
  return `import { useParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Pencil } from 'lucide-react';
import { Button, DetailCard } from '${names.sharedPrefix}shared/components/ui';
${features.edit ? `import { useAuth } from '${names.sharedPrefix}app/providers';\n` : ''}import { use${names.entity}Form } from '../hooks';
${features.edit ? `import { ${names.entity}Permissions } from '../permissions';\n` : ''}
function ${names.entity}ViewPage() {
  const { t } = useTranslation();
  const { ${names.paramId} } = useParams<{ ${names.paramId}: string }>();
  const navigate = useNavigate();
${features.edit ? '  const { can } = useAuth();\n' : ''}  const { queryStatus, queryMessage, errorType, detailRows } = use${names.entity}Form(${names.paramId});

  return (
    <div data-testid="${names.testId}-view-page" className="flex min-h-full flex-col stack-gap">
      <DetailCard
        testId="${names.testId}-detail-card"
        title={t('runtime.detailTitle', { singular: t('${base}.label') })}
        state={{ status: queryStatus, message: queryMessage, rows: detailRows, errorType }}
        actions={
          queryStatus !== 'error' ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                data-testid="${names.testId}-back-button"
                variant="secondary"
                icon={<ChevronLeft className="h-4 w-4" />}
                onClick={() => navigate(-1)}
              >
                {t('common.back')}
              </Button>
${
  features.edit
    ? `              {can(${names.entity}Permissions.update) && (
                <Button
                  type="button"
                  data-testid="${names.testId}-edit-button"
                  variant="secondary"
                  icon={<Pencil className="h-4 w-4" />}
                  onClick={() => navigate(\`/${names.routeBase}/\${${names.paramId}}/edit\`)}
                >
                  {t('common.edit')}
                </Button>
              )}
`
    : ''
}            </div>
          ) : undefined
        }
      />
    </div>
  );
}

export default ${names.entity}ViewPage;
`;
}

export function editPageTemplate(ctx: TemplateContext): string {
  const { names, fields } = ctx;
  const base = ctx.config.permissionKey;
  const optionsFields = fields.filter((f) => f.isOptionsQuery);
  return `import { useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Card, ErrorStatePage, FormSkeleton } from '${names.sharedPrefix}shared/components/ui';
import { use${names.entity}Form } from '../hooks';
import { ${names.entity}Form } from '../components';

function ${names.entity}EditPage() {
  const { t } = useTranslation();
  const { ${names.paramId} } = useParams<{ ${names.paramId}: string }>();
  const {
    defaultValues,
    queryStatus,
    errorType,
    onSubmit,
    onCancel,
${optionsFields.map((f) => `    ${f.name}Options,`).join('\n')}
${optionsFields.length > 0 ? '' : ''}    isSubmitting,
  } = use${names.entity}Form(${names.paramId});

  if (errorType) return <ErrorStatePage type={errorType} />;

  if (queryStatus === 'loading') {
    return (
      <Card title={t('runtime.editTitle', { singular: t('${base}.label') })}>
        <FormSkeleton />
      </Card>
    );
  }

  return (
    <${names.entity}Form
      key={${names.paramId}}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onCancel={onCancel}
      isEdit
${optionsFields.map((f) => `      ${f.name}Options={${f.name}Options}`).join('\n')}
${optionsFields.length > 0 ? '' : ''}      isSubmitting={isSubmitting}
    />
  );
}

export default ${names.entity}EditPage;
`;
}
