/** Hooks TanStack Query + filter + form untuk runtime modul dinamis. */
import { isValidElement, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  useToast,
  type DetailRow,
} from '../../../shared/components/ui';
import { useDebounce, useUrlPagination } from '../../../shared/hooks';
import type { FilterField } from '../../../shared/components/ui';
import type { ApiList, SubmitResult } from '../../../shared/types';
import { RelationLabel, type RelationOptionLoader } from '../../../shared/components/ui';
import { staticOptionsOf } from './cellRender';
import {
  capitalize,
  downloadBlob,
  formatDate,
  formatDateRange,
  formatNumber,
  getErrorStateType,
  isConnectionError,
  mapSubmitError,
  splitFieldErrors,
  stripHtml,
} from '../../../shared/utils';
import type { GeneratorFieldConfig } from '../types';
import type { ModuleDefinition } from '../definitions';
import { getDefinition, listDefinitions } from './definitionsApi';
import {
  exportRecords,
  getRecord,
  listRecords,
  makeOptionsLoader,
  makeRelationOptionsLoader,
} from './recordsApi';
import { buildFilterFields } from './filtering';
import { moduleFieldLabel } from './moduleI18n';
import { formDefaultValue, formEditValue, payloadValue, type DynamicFormValues } from './validation';
import {
  useDeleteDynamicRecord,
  useRestoreDynamicRecord,
  useUpsertDynamicRecord,
} from './mutations';
import type {
  DynamicDetail,
  DynamicListItem,
  DynamicListParams,
  DynamicOption,
} from './types';

export function useDynamicDefinitions(status = 'published') {
  return useQuery<ModuleDefinition[]>({
    queryKey: ['dynamic-definitions', status],
    queryFn: () => listDefinitions(status),
    placeholderData: (prev) => prev,
  });
}

export function useDynamicDefinition(key: string | undefined) {
  return useQuery<ModuleDefinition>({
    queryKey: ['dynamic-definition', key],
    queryFn: () => getDefinition(key as string),
    enabled: !!key,
  });
}

export function useDynamicDetail(def: ModuleDefinition | undefined, id: string | undefined) {
  return useQuery<DynamicDetail>({
    queryKey: ['dynamic-record', def?.key, id],
    queryFn: () => getRecord(def as ModuleDefinition, id as string),
    enabled: !!def && !!id,
  });
}

/** State filter list generik — meniru `useUserListFilter` untuk sembarang definisi. */
export function useDynamicListFilter(def: ModuleDefinition) {
  const [searchParams] = useSearchParams();
  const { page, setPage, pageSize, setPageSize, handlePageSizeChange } = useUrlPagination();
  const [sortKey, setSortKey] = useState<string | undefined>(undefined);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') ?? '');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  const filterFields: FilterField[] = useMemo(
    () => buildFilterFields(def.fields, (field) => makeOptionsLoader(def, field), def),
    [def],
  );

  const [filterValues, setFilterValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of filterFields) {
      const fromUrl = searchParams.get(field.name);
      if (fromUrl) initial[field.name] = fromUrl;
    }
    return initial;
  });

  const queryParams: DynamicListParams = useMemo(() => {
    const params: DynamicListParams = {
      search: debouncedSearchQuery || undefined,
      order: sortKey,
      sort: sortKey ? sortDir : undefined,
      page,
      size: pageSize,
    };
    for (const [key, value] of Object.entries(filterValues)) {
      if (value) params[key] = value;
    }
    return params;
  }, [debouncedSearchQuery, sortKey, sortDir, page, pageSize, filterValues]);

  const isFilterActive = !!debouncedSearchQuery || Object.values(filterValues).some(Boolean);

  function handleSearchChange(value: string): void {
    setSearchQuery(value);
    setPage(1);
  }

  function handleApply(values: Record<string, string>, options?: { resetPage?: boolean }): void {
    setFilterValues(values);
    if (options?.resetPage !== false) setPage(1);
  }

  function handleReset(): void {
    setFilterValues({});
    setPage(1);
  }

  function handleSort(key: string): void {
    if (key === sortKey) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  return {
    filterFields,
    page,
    setPage,
    pageSize,
    setPageSize,
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
  };
}

export function useDynamicList(def: ModuleDefinition, params: DynamicListParams) {
  const query = useQuery<ApiList<DynamicListItem>>({
    queryKey: ['dynamic-records', def.key, params],
    queryFn: () => listRecords(def, params),
    placeholderData: (prev) => prev,
  });
  return {
    rows: query.data?.list.content ?? [],
    totalRecords: query.data?.list.pagination?.total_elements ?? 0,
    isLoading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refresh: () => query.refetch(),
  };
}

const OPTION_TYPES = new Set(['selectField', 'selectMultipleField', 'radioGroupField', 'checkboxGroupField']);

/**
 * Opsi per field opsi (mock-only): mockStatic dari definisi; api memakai
 * contoh `options` definisi; mockPaging + relation selalu via loader.
 */
export function useDynamicOptions(def: ModuleDefinition): {
  optionsOf: (field: GeneratorFieldConfig) => DynamicOption[];
  loaderOf: (field: GeneratorFieldConfig) => ReturnType<typeof makeOptionsLoader> | undefined;
} {
  return useMemo(
    () => ({
      optionsOf: (field: GeneratorFieldConfig): DynamicOption[] => {
        if (field.source === 'mockStatic' || field.source === 'api') {
          return (field.options ?? []).map((o) => ({ ...o }));
        }
        return [];
      },
      loaderOf: (field: GeneratorFieldConfig) => {
        if (!OPTION_TYPES.has(field.type)) return undefined;
        if (field.source === 'mockPagingInfinityScroll') return makeOptionsLoader(def, field);
        if (field.source === 'relation') return makeRelationOptionsLoader(field);
        return undefined;
      },
    }),
    [def],
  );
}

/** Nilai detail satu field untuk baris DetailCard (meniru `detailRowSnippet`). */
export function detailValue(
  field: GeneratorFieldConfig,
  item: DynamicDetail,
  loader?: RelationOptionLoader,
): unknown {
  const value = item[field.name];
  switch (field.type) {
    case 'numberField':
    case 'currencyField':
      return formatNumber(Number(value ?? 0));
    case 'dateField':
      return formatDate(String(value ?? ''));
    case 'dateRangeField':
      return formatDateRange(String(value ?? ''));
    case 'checkboxField':
    case 'switchField':
      return value ? 'Yes' : 'No';
    case 'selectField':
    case 'radioGroupField': {
      const options = staticOptionsOf(field);
      if (!options && loader) {
        return <RelationLabel loader={loader} value={String(value ?? '')} />;
      }
      const raw = String(value ?? '');
      return options?.find((o) => o.value === raw)?.label ?? capitalize(raw);
    }
    case 'selectMultipleField':
    case 'checkboxGroupField': {
      const options = staticOptionsOf(field);
      if (!options && loader) {
        const list = Array.isArray(value) ? value : [];
        return (
          <>
            {list.map((v, i) => (
              <span key={String(v ?? i)}>
                {i > 0 ? ', ' : ''}
                <RelationLabel loader={loader} value={String(v ?? '')} />
              </span>
            ))}
          </>
        );
      }
      const list = Array.isArray(value) ? value : [];
      return list
        .map((v) => {
          const raw = String(v ?? '');
          return options?.find((o) => o.value === raw)?.label ?? raw;
        })
        .join(', ');
    }
    case 'passwordField':
      return '••••••';
    case 'colorField':
      return value ? (
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-4 w-4 rounded border border-border"
            style={{ backgroundColor: String(value) }}
          />
          <span>{String(value)}</span>
        </span>
      ) : (
        '-'
      );
    case 'editorField':
      return stripHtml(String(value ?? '')) || '-';
    case 'formArrayField': {
      const count = Array.isArray(value) ? value.length : 0;
      return count > 0 ? `${count} baris` : '-';
    }
    default:
      if (value instanceof File) return value.name;
      if (Array.isArray(value) && value.length > 0 && value[0] instanceof File) {
        return (value as File[]).map((file) => file.name).join(', ');
      }
      // Objek polos (mis. sisa File di draft lama) tidak valid sebagai React child.
      if (typeof value === 'object' && value !== null && !Array.isArray(value) && !isValidElement(value)) {
        return '-';
      }
      return value;
  }
}

/**
 * Baris DetailCard dari definisi + item. Mengikuti `layout.detail`
 * (urutan + hidden); bila absen: urutan fields, semua tampil.
 * Dipakai halaman detail runtime + pratinjau canvas builder.
 */
const DETAIL_SYSTEM_ORDER: readonly string[] = ['status', 'created_by', 'created_date'];

/** Label + nilai baris sistem detail (status/created_* selalu tampil). */
function detailSystemRow(
  name: string,
  item: DynamicDetail | null,
): Pick<DetailRow, 'label' | 'value'> {
  if (name === 'created_by') return { label: 'Created By', value: item?.createdBy ?? '' };
  if (name === 'created_date') return { label: 'Created Date', value: item?.createdDate ?? '' };
  return {
    label: 'Status',
    value: item ? (
      <Badge variant={item.status === 'active' ? 'success' : 'secondary'}>
        {capitalize(item.status)}
      </Badge>
    ) : (
      ''
    ),
  };
}

export function buildDetailRows(
  def: ModuleDefinition,
  item: DynamicDetail | null,
  loaderOf?: (field: GeneratorFieldConfig) => RelationOptionLoader | undefined,
): DetailRow[] {
  const byName = new Map(def.fields.map((field) => [field.name, field]));
  // Default mengikuti urutan tabel kiri-ke-kanan (cermin kanvas List);
  // bila tabel kosong, jatuh ke urutan fields.
  const tableOrder = (def.layout.table?.order ?? []).filter(
    (name) => byName.has(name) || DETAIL_SYSTEM_ORDER.includes(name),
  );
  const configured = def.layout.detail?.order
    ?? (tableOrder.length > 0 ? tableOrder : def.fields.map((field) => field.name));
  const hidden = new Set(def.layout.detail?.hidden ?? []);
  // Kunci sistem mengikuti posisi di order; yang belum diatur memakai
  // fallback lama (status di depan, created_* di belakang).
  const keys = configured.filter(
    (name) => byName.has(name) || DETAIL_SYSTEM_ORDER.includes(name),
  );
  if (!keys.includes('status')) keys.unshift('status');
  for (const name of ['created_by', 'created_date']) {
    if (!keys.includes(name)) keys.push(name);
  }
  const rowPropsOf = (name: string): Pick<DetailRow, 'fullWidth' | 'noDivider' | 'heading'> => {
    const src = def.layout.detail?.props?.[name];
    return {
      ...(src?.fullWidth === true ? { fullWidth: true as const } : {}),
      ...(src?.noDivider === true ? { noDivider: true as const } : {}),
      ...(src?.heading === true ? { heading: true as const } : {}),
    };
  };
  return keys.flatMap((name): DetailRow[] => {
    const field = byName.get(name);
    if (field) {
      if (hidden.has(name)) return [];
      return [
        {
          name: field.name,
          label: moduleFieldLabel(def, field),
          value: item
            ? (detailValue(field, item, loaderOf ? loaderOf(field) : undefined) as ReactNode)
            : '',
          ...rowPropsOf(field.name),
        },
      ];
    }
    return [{ name, ...detailSystemRow(name, item), ...rowPropsOf(name) }];
  });
}

/** Hook form generik — meniru `useUserForm` (detail, defaults, submit, opsi). */
export function useDynamicForm(def: ModuleDefinition, id?: string) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const isEdit = !!id;

  const query = useDynamicDetail(def, id);
  const upsertMutation = useUpsertDynamicRecord(def);
  const { optionsOf, loaderOf } = useDynamicOptions(def);
  const item = query.data;

  const defaultValues: DynamicFormValues = useMemo(() => {
    const values: DynamicFormValues = {};
    for (const field of def.fields) {
      values[field.name] = item
        ? formEditValue(field, item as unknown as Record<string, unknown>)
        : formDefaultValue(field);
    }
    return values;
  }, [def, item]);

  const detailRows: DetailRow[] = useMemo(
    () => buildDetailRows(def, item ?? null, loaderOf),
    [def, item, loaderOf],
  );

  async function onSubmit(data: DynamicFormValues): Promise<SubmitResult> {
    try {
      const payload: Record<string, unknown> = {};
      for (const field of def.fields) payload[field.name] = payloadValue(field, data[field.name]);
      const res = await upsertMutation.mutateAsync({ id: isEdit ? id : undefined, data: payload });
      showToast({ message: res.message, variant: 'success' });
      setTimeout(() => navigate(`/${def.routeBase}`), 500);
      return { success: true };
    } catch (err: unknown) {
      const fallback = isEdit
        ? t('runtime.saveFailedUpdate', { singular: def.singularLabel.toLowerCase() })
        : t('runtime.saveFailedCreate', { singular: def.singularLabel.toLowerCase() });
      const result = mapSubmitError(err, fallback);
      if (result.fieldErrors) {
        const { fieldErrors, unknownMessage } = splitFieldErrors(result.fieldErrors, (field) => field);
        if (unknownMessage) showToast({ message: unknownMessage, variant: 'error' });
        return Object.keys(fieldErrors).length > 0 ? { success: false, fieldErrors } : { success: false };
      }
      if (result.toastMessage) {
        showToast({ message: result.toastMessage, variant: 'error' });
      }
      return result;
    }
  }

  function onCancel(): void {
    navigate(-1);
  }

  const queryStatus: 'loading' | 'error' | 'success' = query.isLoading
    ? 'loading'
    : query.error
      ? 'error'
      : 'success';

  return {
    queryStatus,
    queryMessage: query.error?.message ?? undefined,
    errorType: query.error ? getErrorStateType(query.error) : undefined,
    isNetworkError: query.error ? isConnectionError(query.error) : false,
    detailRows,
    defaultValues,
    isSubmitting: upsertMutation.isPending,
    isEdit,
    onSubmit,
    onCancel,
    optionsOf,
    loaderOf,
  };
}

/** Aksi list generik: dialog delete/restore + toast — meniru `useUserList`. */
export function useDynamicListActions(def: ModuleDefinition) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<DynamicListItem | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<DynamicListItem | null>(null);
  const deleteMutation = useDeleteDynamicRecord(def);
  const restoreMutation = useRestoreDynamicRecord(def);

  function handleDeleteClick(item: DynamicListItem): void {
    setDeleteTarget(item);
  }

  function handleDeleteCancel(): void {
    setDeleteTarget(null);
  }

  async function handleDelete(): Promise<void> {
    if (!deleteTarget) return;
    try {
      const res = await deleteMutation.mutateAsync(String(deleteTarget.id));
      setDeleteTarget(null);
      showToast({ message: res.message, variant: 'success' });
    } catch (err: unknown) {
      const fallback = t('runtime.deleteFailed', { singular: def.singularLabel.toLowerCase() });
      const result = mapSubmitError(err, fallback);
      showToast({ message: result.toastMessage ?? fallback, variant: 'error' });
    }
  }

  function handleRestoreClick(item: DynamicListItem): void {
    setRestoreTarget(item);
  }

  function handleRestoreCancel(): void {
    setRestoreTarget(null);
  }

  async function handleRestore(): Promise<void> {
    if (!restoreTarget) return;
    try {
      const res = await restoreMutation.mutateAsync(String(restoreTarget.id));
      setRestoreTarget(null);
      showToast({ message: res.message, variant: 'success' });
    } catch (err: unknown) {
      const fallback = t('runtime.restoreFailed', { singular: def.singularLabel.toLowerCase() });
      const result = mapSubmitError(err, fallback);
      showToast({ message: result.toastMessage ?? fallback, variant: 'error' });
    }
  }

  return {
    deleteTarget,
    restoreTarget,
    isDeleting: deleteMutation.isPending,
    isRestoring: restoreMutation.isPending,
    handleDeleteClick,
    handleDeleteCancel,
    handleDelete,
    handleRestoreClick,
    handleRestoreCancel,
    handleRestore,
  };
}

/** Export .xlsx generik — meniru `useUserExport`. */
export function useDynamicExport(def: ModuleDefinition) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [isExporting, setExporting] = useState(false);

  async function exportData(params: DynamicListParams): Promise<void> {
    setExporting(true);
    try {
      const blob = await exportRecords(def, params);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `${def.apiPlural}-${stamp}.xlsx`);
      showToast({ variant: 'success', message: t('runtime.exportDone') });
    } catch (err: unknown) {
      const fallback = t('runtime.exportFailed');
      const result = mapSubmitError(err, fallback);
      showToast({ message: result.toastMessage ?? fallback, variant: 'error' });
    } finally {
      setExporting(false);
    }
  }

  return { exportData, isExporting };
}
