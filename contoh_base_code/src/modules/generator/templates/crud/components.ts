import type { TemplateContext } from '../../engine/context';
import {
  arrayColumnsSnippet,
  arrayColumnUtils,
  arrayInputSnippet,
  arrayNeedsParseCurrency,
  arraySubLoadModels,
  arraySubRelationModels,
  formItemSnippet,
  loadLabelHelpers,
  relationLoaders,
  rowFormTypeName,
  rowMappersSnippet,
  rowTypeName,
  subOptionsSnippet,
  tableColumnSnippet,
} from '../../engine/fieldGenerator';
import type { FormLayoutItem } from '../../types';
import { colSpanClass } from '../../runtime/grid';
import { fieldTypeRegistry } from '../../registry';

/**
 * Item layout form yang dipakai file statis: `config.formLayout` bila ada,
 * selain itu semua field full-width berurutan. Item field tak dikenal
 * dilewat; field yang belum ter-cover ditambah di akhir (span 12).
 */
function formLayoutItems(ctx: TemplateContext): FormLayoutItem[] {
  const known = new Set(ctx.fields.map((f) => f.name));
  const raw: FormLayoutItem[] =
    ctx.config.formLayout ??
    ctx.fields.map((f, i) => ({ field: f.name, order: i, colSpan: 12 }));
  const kept = raw.filter((item) => (item.kind ?? 'field') !== 'field' || known.has(item.field));
  const covered = new Set(
    kept.filter((item) => (item.kind ?? 'field') === 'field').map((item) => item.field),
  );
  const missing: FormLayoutItem[] = ctx.fields
    .filter((f) => !covered.has(f.name))
    .map((f, i) => ({ field: f.name, order: kept.length + i, colSpan: 12 }));
  return [...kept, ...missing].sort((a, b) => a.order - b.order);
}


export function tableTemplate(ctx: TemplateContext): string {
  const { names, fields, features } = ctx;
  const base = ctx.config.permissionKey;
  const fieldLabelKey = (name: string): string => `${base}.fields.${name}.label`;
  const withView = features.detail;
  const withEdit = features.edit;
  const withDelete = features.delete;
  const withActions = withView || withEdit || withDelete;
  // Props tampilan tabel dibake dari definisi (layout.table.props).
  const tableProps = ctx.config.tableProps;
  const tableDisplayProps = [
    `fixedLayout={${tableProps?.fixedLayout ?? true}}`,
    ...(tableProps?.dense ? ['dense'] : []),
    ...(tableProps?.hidePagination ? ['hidePagination'] : []),
    ...(tableProps?.hideTotalRecords ? ['hideTotalRecords'] : []),
    ...(tableProps?.stickyHeader ? ['stickyHeader'] : []),
    ...(tableProps?.stickyAction ? ['stickyAction'] : []),
    ...(tableProps?.actionPosition === 'left' ? ['actionPosition="left"'] : []),
  ]
    .map((line) => `      ${line}`)
    .join('\n');

  // Helper label paging untuk kolom tabel (`getXOptionLabel` dari api).
  const tableLabelHelpers = loadLabelHelpers(fields);
  // Loader + RelationLabel untuk kolom relasi.
  const tableRelationLoaders = relationLoaders(fields);
  const needFormatNumber = ctx.hasNumberFields;
  const needFormatDate = fields.some((f) => f.config.type === 'dateField');
  const needFormatDateRange = fields.some((f) => f.config.type === 'dateRangeField');
  const needStripHtml = fields.some((f) => f.config.type === 'editorField');
  const utilImports = [
    'formatDateTime',
    ...(needFormatNumber ? ['formatNumber'] : []),
    ...(needFormatDate ? ['formatDate'] : []),
    ...(needFormatDateRange ? ['formatDateRange'] : []),
    ...(needStripHtml ? ['stripHtml'] : []),
  ];

  const tableWidths = ctx.config.tableWidths ?? {};
  const actionIconSize =
    typeof tableProps?.actionIconSize === 'number' ? ` iconSize={${tableProps.actionIconSize}}` : '';
  const actionIconColor = (kind: string): string => {
    const color = tableProps?.actionIconColor?.[kind as 'view' | 'edit' | 'delete' | 'restore'];
    return color && color !== 'default' ? ` color="${color}"` : '';
  };
  const widthOf = (name: string): string =>
    tableWidths[name] !== undefined ? `, width: ${tableWidths[name]}` : '';
  const widthLine = (name: string): string =>
    tableWidths[name] !== undefined ? `\n      width: ${tableWidths[name]},` : '';
  const columns = fields
    .map(
      (f) =>
        `    ${tableColumnSnippet(f, tableWidths[f.name], fieldLabelKey(f.name)).replace(/ROWTYPE/g, names.listItem)}`,
    )
    .join('\n');
  // capitalize hanya bila fallback label masih memakainya (helper/map tak cover semua).
  const tableUtils = [
    ...(columns.includes('capitalize(') ? ['capitalize'] : []),
    ...utilImports,
  ];

  const tableApiImports = [...tableLabelHelpers, ...tableRelationLoaders];
  return `import { useTranslation } from 'react-i18next';
import '${names.sharedPrefix}shared/i18n';
import type { ${names.listItem} } from '../types';
import { Table, Badge, RowActionButton } from '${names.sharedPrefix}shared/components/ui';
${tableRelationLoaders.length > 0 ? `import { RelationLabel } from '${names.sharedPrefix}shared/components/ui';\n` : ''}${tableApiImports.length > 0 ? `import { ${tableApiImports.join(', ')} } from '../api';\n` : ''}import { ${tableUtils.join(', ')} } from '${names.sharedPrefix}shared/utils';

interface Props {
  testId?: string;
  data: ${names.listItem}[];
  totalRecords: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  stickyAction?: boolean;
${withView ? `  onView?: (item: ${names.listItem}) => void;\n` : ''}${withEdit ? `  onEdit?: (item: ${names.listItem}) => void;\n` : ''}${withDelete ? `  onDelete?: (item: ${names.listItem}) => void;\n  onRestore?: (item: ${names.listItem}) => void;\n` : ''}${withDelete ? `  isDeleting?: boolean;\n  isRestoring?: boolean;\n` : ''}  isEmptyState?: boolean;
  isFilteredEmptyState?: boolean;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  filteredEmptyStateTitle?: string;
  filteredEmptyStateDescription?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

function ${names.entity}Table({
  testId,
${withView ? '  onView,\n' : ''}${withEdit ? '  onEdit,\n' : ''}${withDelete ? '  onDelete,\n  onRestore,\n  isDeleting = false,\n  isRestoring = false,\n' : ''}  data,
  isEmptyState,
  isFilteredEmptyState,
  ...rest
}: Props) {
  const { t } = useTranslation();
  const columns = [
${columns}
    { key: 'created_by', header: t('table.createdBy')${widthOf('created_by')} },
    {
      key: 'created_date',
      header: t('table.createdDate'),${widthLine('created_date')}
      render: (row: ${names.listItem}) => formatDateTime(row.created_date),
    },
    {
      key: 'status',
      header: t('table.status'),
      sortable: false,${widthLine('status')}
      className: 'w-32',
      render: (row: ${names.listItem}) => (
        <Badge variant={row.status === 'active' ? 'success' : 'secondary'}>
          {row.status === 'active' ? t('common.active') : t('common.inactive')}
        </Badge>
      ),
    },
  ];

  return (
    <Table<${names.listItem}>
${withActions ? '      actionWidth="w-40"\n' : ''}      testId={testId}
      columns={columns}
      data={data}
      rowKey={(r) => String(r.id)}
${tableDisplayProps}
${withActions ? `      renderAction={(row) => (
        <div className="flex justify-evenly w-full gap-1">
${withView ? `          {onView && (
            <RowActionButton
              action="view"
              testId={\`${names.testId}-view-\${row.id}\`}
              title={\`View \${row.id}\`}
              onClick={() => onView(row)}${actionIconSize}${actionIconColor('view')}
            />
          )}
` : ''}${withEdit ? `          {onEdit && (
            <RowActionButton
              action="edit"
              testId={\`${names.testId}-edit-\${row.id}\`}
              title={\`Edit \${row.id}\`}
              onClick={() => onEdit(row)}${actionIconSize}${actionIconColor('edit')}
            />
          )}
` : ''}${withDelete ? `          {row.status === 'active' && onDelete && (
            <RowActionButton
              action="delete"
              testId={\`${names.testId}-delete-\${row.id}\`}
              title={\`Delete \${row.id}\`}
              onClick={() => onDelete(row)}
              disabled={isDeleting}${actionIconSize}${actionIconColor('delete')}
            />
          )}
          {row.status === 'inactive' && onRestore && (
            <RowActionButton
              action="restore"
              testId={\`${names.testId}-restore-\${row.id}\`}
              title={\`Restore \${row.id}\`}
              onClick={() => onRestore(row)}
              disabled={isRestoring}${actionIconSize}${actionIconColor('restore')}
            />
          )}
` : ''}        </div>
      )}
` : ''}      isEmptyState={isEmptyState}
      isFilteredEmptyState={isFilteredEmptyState}
      {...rest}
    />
  );
}

export default ${names.entity}Table;
`;
}

export function formTemplate(ctx: TemplateContext): string {
  const { names, fields } = ctx;
  const base = ctx.config.permissionKey;
  const arrayFields = fields.filter((f) => f.config.type === 'formArrayField');
  const usedComponents = [
    ...new Set([
      ...fields.map((f) => fieldTypeRegistry[f.config.type].component),
      ...arrayFields.flatMap((f) =>
        (f.config.subFields ?? []).map((sub) => fieldTypeRegistry[sub.type].component),
      ),
    ]),
  ];
  const optionsFields = fields.filter((f) => f.isOptionsQuery);
  // Loader form: paging + relasi (relasi memakai loadOptions + RelationLabel).
  const loadFields = fields.filter((f) => f.isLoadOptions || f.isRelationOptions);
  const subLoadFields = arraySubLoadModels(fields);
  const allLoadFns = [...new Set([...loadFields, ...subLoadFields].map((f) => f.loadOptionsFn))];
  // Kolom tabel array (sub-field) memakai helper label; field top-level tidak.
  const apiLabelHelpers = loadLabelHelpers(subLoadFields);
  const apiRelationLoaders = relationLoaders(arraySubRelationModels(fields));
  const apiImports = [...allLoadFns, ...apiLabelHelpers, ...apiRelationLoaders];
  const rowTypeImports = arrayFields.flatMap((f) => [rowTypeName(f), rowFormTypeName(f)]);
  const arrayUtils = [...new Set(arrayFields.flatMap((f) => arrayColumnUtils(f)))];
  if (arrayFields.some((f) => arrayNeedsParseCurrency(f))) arrayUtils.push('parseCurrency');
  // Aturan sub-field di-inline di editor baris (buildRulesObject) — `withoutemoticon`
  // butuh import utils di file form (field utama memakai file validation).
  const needEmoticonUtils = arrayFields.some((f) =>
    (f.config.subFields ?? []).some((sub) => (sub.rules ?? []).includes('withoutemoticon')),
  );

  const fieldLabelKey = (name: string): string => `${base}.fields.${name}.label`;
  const fieldPlaceholderKey = (name: string): string => `${base}.fields.${name}.placeholder`;
  const modelByField = new Map(fields.map((f) => [f.name, f]));
  // Snippet per item layout (bukan per field) agar span grid ikut menentukan
  // default layout: span sempit (<=6) jadi vertikal, meniru runtime.
  function snippetForItem(fieldName: string, colSpan: number): string | null {
    const f = modelByField.get(fieldName);
    if (!f) return null;
    return formItemSnippet(ctx, f, {
      labelKey: fieldLabelKey(f.name),
      placeholderKey: fieldPlaceholderKey(f.name),
      rulesExpr: `get${f.pascal}Rules(t)`,
      span: colSpan,
    });
  }
  // Grid 12 kolom + section/divider meniru kanvas (runtime DynamicForm).
  const formItems = formLayoutItems(ctx)
    .flatMap((item) => {
      const kind = item.kind ?? 'field';
      const span = colSpanClass(item.colSpan);
      if (kind === 'section') {
        return [
          `              <div className="${span}"><p className="border-b border-border pb-1 text-sm font-semibold text-foreground">{${JSON.stringify(item.label ?? 'Section')}}</p></div>`,
        ];
      }
      if (kind === 'divider') {
        return [`              <div className="${span}"><hr className="border-border" /></div>`];
      }
      const snippet = snippetForItem(item.field, item.colSpan);
      if (!snippet) return [];
      return [`              <div className="${span}">\n                ${snippet}\n              </div>`];
    })
    .join('\n\n');
  const rulesImports = fields.map((f) => `get${f.pascal}Rules`).join(', ');
  const arrayBlocks = arrayFields
    .map((f) =>
      [
        subOptionsSnippet(f),
        rowMappersSnippet(f),
        arrayColumnsSnippet(f, `${base}.fields.${f.name}`),
        arrayInputSnippet(ctx, f),
      ]
        .filter(Boolean)
        .join('\n\n'),
    )
    .join('\n\n');

  return `${arrayFields.length > 0 ? `import { t } from 'i18next';\nimport '${names.sharedPrefix}shared/i18n';\n` : ''}import { useCallback, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import {
  Card,
  Button,
  FormGroup,
  FormItem,
  FormDefaultValuesWatcher,
  ${usedComponents.join(',\n  ')},
  NavigationGuard,
${apiRelationLoaders.length > 0 ? '  RelationLabel,\n' : ''}} from '${names.sharedPrefix}shared/components/ui';
import type { FormValues } from '../hooks';
import type { SubmitResult } from '${names.sharedPrefix}shared/types';
import { type UseFormReturn } from 'react-hook-form';
${optionsFields.length > 0 ? `import type { ${optionsFields.map((f) => f.optionType).join(', ')} } from '../types';\n` : ''}${rowTypeImports.length > 0 ? `import type { ${rowTypeImports.join(', ')} } from '../types';\n` : ''}${arrayFields.length > 0 ? `import type { Column } from '${names.sharedPrefix}shared/components/ui/Table';\n` : ''}${apiImports.length > 0 ? `import { ${apiImports.join(', ')} } from '../api';\n` : ''}${arrayUtils.length > 0 ? `import { ${arrayUtils.join(', ')} } from '${names.sharedPrefix}shared/utils';\n` : ''}${needEmoticonUtils ? `import { hasEmoticon } from '${names.sharedPrefix}shared/utils';\n` : ''}import { ${rulesImports} } from '../validation/${names.camel}Validation';
${arrayBlocks ? `${arrayBlocks}\n\n` : ''}
interface ${names.entity}FormProps {
  defaultValues: FormValues;
  onSubmit: (data: FormValues) => Promise<SubmitResult>;
  onCancel: () => void;
  isEdit?: boolean;
  isSubmitting?: boolean;
${optionsFields.map((f) => `  ${f.name}Options: ${f.optionType}[];`).join('\n')}
${optionsFields.length > 0 ? '' : ''}}

function ${names.entity}Form({
  defaultValues,
  onSubmit,
  onCancel,
  isEdit = false,
  isSubmitting = false,
${optionsFields.map((f) => `  ${f.name}Options,`).join('\n')}
${optionsFields.length > 0 ? '' : ''}}: ${names.entity}FormProps) {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const setErrorRef = useRef<((name: keyof FormValues, error: { message: string }) => void) | null>(
    null,
  );
  const methodsRef = useRef<UseFormReturn<FormValues> | null>(null);

  const handleFormSubmit = useCallback(
    async (data: FormValues) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);
      setSubmitted(false);
      let success = false;
      try {
        const result = await onSubmit(data);
        if (result.fieldErrors && setErrorRef.current) {
          for (const [field, message] of Object.entries(result.fieldErrors)) {
            setErrorRef.current(field as keyof FormValues, { message });
          }
        }
        success = result.success;
        if (result.success) {
          methodsRef.current?.reset(data);
          setSubmitted(true);
        }
      } finally {
        if (!success) {
          submittingRef.current = false;
          setSubmitting(false);
        }
      }
    },
    [onSubmit],
  );

  return (
    <div className="flex min-h-full flex-col stack-gap">
      <div>
        <Button
          data-testid="${names.testId}-back-button"
          type="button"
          variant="secondary"
          icon={<ChevronLeft className="h-4 w-4" />}
          onClick={onCancel}
        >
          {t('common.back')}
        </Button>
      </div>
      <Card testId="${names.testId}-form-card" title={isEdit ? t('runtime.editTitle', { singular: t('${base}.label') }) : t('runtime.createTitle', { singular: t('${base}.label') })}>
        <FormGroup<FormValues>
          testId="${names.testId}-form"
          defaultValues={defaultValues}
          onSubmit={handleFormSubmit}
        >
          {(methods) => {
            setErrorRef.current = methods.setError;
            methodsRef.current = methods;

            return (
              <>
                <FormDefaultValuesWatcher methods={methods} defaultValues={defaultValues} />

                <div className="grid grid-cols-12 field-gap">
${formItems}
                </div>

                <div className="-mx-5 mt-6 flex items-center justify-end gap-2 border-t border-border px-5 pt-4">
                  <Button
                    data-testid="${names.testId}-cancel-button"
                    type="button"
                    variant="secondary"
                    className="w-30"
                    onClick={onCancel}
                  >
                    {t('common.cancel')}
                  </Button>
                <Button
                  data-testid="${names.testId}-submit-button"
                  type="submit"
                  className="w-30"
                  disabled={isSubmitting || submitting}
                >
                  {isEdit ? t('common.update') : t('common.create')}
                </Button>
              </div>

              <NavigationGuard submitted={submitted} />
            </>
          );
        }}
        </FormGroup>
      </Card>
    </div>
  );
}

export default ${names.entity}Form;
`;
}

export function bulkDialogTemplate(ctx: TemplateContext): string {
  const { names, fields } = ctx;
  const base = ctx.config.permissionKey;
  const columns = fields
    .filter((f) => f.config.type !== 'fileUploadField' && f.config.type !== 'formArrayField')
    .flatMap((f) =>
      f.config.type === 'dateRangeField' ? [`${f.label} Start`, `${f.label} End`] : [f.label],
    )
    .join(', ');
  return `import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Dialog,
  FileUploadField,
} from '${names.sharedPrefix}shared/components/ui';
import { downloadBlob, mapSubmitError } from '${names.sharedPrefix}shared/utils';
import type { BulkUploadResult } from '../types';
import { download${names.entity}Template, useBulkUpload${names.entity} } from '../api';

interface ${names.entity}BulkUploadDialogProps {
  open: boolean;
  onClose: () => void;
}

function ${names.entity}BulkUploadDialog({ open, onClose }: ${names.entity}BulkUploadDialogProps) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | File[] | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [result, setResult] = useState<BulkUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bulkMutation = useBulkUpload${names.entity}();

  function reset(): void {
    setFile(null);
    setResult(null);
    setError(null);
  }

  function handleClose(): void {
    reset();
    onClose();
  }

  async function handleDownloadTemplate(): Promise<void> {
    setLoadingTemplate(true);
    try {
      const blob = await download${names.entity}Template();
      downloadBlob(blob, '${names.kebab}-template.xlsx');
    } catch (err: unknown) {
      const mapped = mapSubmitError(err, t('bulk.downloadFailed'));
      setError(mapped.toastMessage ?? t('bulk.downloadFailed'));
    } finally {
      setLoadingTemplate(false);
    }
  }

  async function handleUpload(): Promise<void> {
    const single = Array.isArray(file) ? file[0] : file;
    if (!single) {
      setError(t('bulk.pickFile'));
      return;
    }
    setError(null);
    try {
      const uploadResult = await bulkMutation.mutateAsync(single);
      setResult(uploadResult);
    } catch (err: unknown) {
      const mapped = mapSubmitError(err, t('bulk.uploadFailed'));
      setError(mapped.toastMessage ?? t('bulk.uploadFailed'));
    }
  }

  return (
    <Dialog
      testId="${names.testId}-bulk-upload-dialog"
      open={open}
      onClose={handleClose}
      title={t('bulk.title', { singular: t('${base}.label') })}
      maxWidth="lg"
      closeOnEscape
      closeOnBackdropClick
    >
      <div className="flex flex-col stack-gap">
        {error && <Alert variant="error" message={error} />}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDownloadTemplate}
            disabled={loadingTemplate}
          >
            {loadingTemplate ? t('bulk.downloading') : t('bulk.downloadTemplate')}
          </Button>
          <span className="text-xs text-muted-foreground">
            {t('bulk.templateHint', { columns: '${columns}' })}
          </span>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">{t('bulk.fileUpload')}</label>
          <FileUploadField
            value={file}
            onChange={(next) => {
              setFile(next);
              setResult(null);
              setError(null);
            }}
            accept=".xlsx"
          />
        </div>
        {result && (
          <div className="flex flex-col field-gap">
            <Alert
              variant={result.failedCount === 0 ? 'success' : 'warning'}
              message={t('bulk.result', { success: result.successCount, failed: result.failedCount, total: result.totalRows })}
            />
            {result.errors.length > 0 && (
              <ul className="max-h-48 overflow-y-auto rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground">
                {result.errors.map((item, index) => (
                  <li key={\`\${item.row}-\${item.field ?? ''}-\${index}\`} className="py-0.5">
                    <span className="font-mono">{t('bulk.row', { row: item.row })}</span>
                    {item.field ? <span className="font-mono"> [{item.field}]</span> : null}:{' '}
                    {item.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            {t('common.close')}
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={bulkMutation.isPending || !file}
          >
            {bulkMutation.isPending ? t('bulk.uploading') : t('bulk.upload')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export default ${names.entity}BulkUploadDialog;
`;
}

export function componentsIndexTemplate(ctx: TemplateContext): string {
  const { names, features } = ctx;
  const needForm = features.create || features.edit || features.detail;
  return `${features.list ? `export { default as ${names.entity}Table } from './${names.entity}Table';\n` : ''}${needForm ? `export { default as ${names.entity}Form } from './${names.entity}Form';\n` : ''}${features.bulkUpload ? `export { default as ${names.entity}BulkUploadDialog } from './${names.entity}BulkUploadDialog';\n` : ''}`;
}
