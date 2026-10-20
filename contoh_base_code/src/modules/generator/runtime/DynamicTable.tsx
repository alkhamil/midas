/** Tabel list generik — kolom + aksi + render sel dari definisi modul. */
import type { ReactNode } from 'react';
import { RowActionButton, Table } from '../../../shared/components/ui';
import type { Column } from '../../../shared/components/ui/Table';
import type { ModuleDefinition } from '../definitions';
import type { GeneratorFieldConfig } from '../types';
import type { LoadOptionsFn } from '../../../shared/components/ui/fields/SelectField';
import { definitionTestId, type DynamicListItem } from './types';
import { columnRenderForType, staticOptionsOf, systemTableColumn } from './cellRender';
import { useDynamicOptions } from './hooks';
import { moduleFieldLabel } from './moduleI18n';

interface DynamicTableProps {
  testId?: string;
  def: ModuleDefinition;
  data: DynamicListItem[];
  totalRecords: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  stickyAction?: boolean;
  onView?: (item: DynamicListItem) => void;
  onEdit?: (item: DynamicListItem) => void;
  onDelete?: (item: DynamicListItem) => void;
  onRestore?: (item: DynamicListItem) => void;
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

function cellRender(
  fieldType: string,
  name: string,
  field?: GeneratorFieldConfig,
  loaderOf?: (field: GeneratorFieldConfig) => LoadOptionsFn | undefined,
): ((row: DynamicListItem) => ReactNode) | undefined {
  const render = columnRenderForType(
    fieldType,
    name,
    field ? staticOptionsOf(field) : undefined,
    field && loaderOf ? loaderOf(field) : undefined,
  );
  return render
    ? (row: DynamicListItem) => render(row as Record<string, unknown>)
    : undefined;
}

function DynamicTable({
  testId,
  def,
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
}: DynamicTableProps) {
  const testPrefix = definitionTestId(def.key);
  const { loaderOf } = useDynamicOptions(def);
  const byName = new Map(def.fields.map((field) => [field.name, field]));
  const hidden = new Set(def.layout.table.hidden);
  const widths = def.layout.table.widths ?? {};
  const displayProps = def.layout.table.props;
  // Urutancampuran field + kolom sistem; definisi lama tanpa kunci sistem
  // mendapatkannya di akhir (fallback perilaku lama).
  const orderedKeys = def.layout.table.order.filter(
    (name) => byName.has(name) || systemTableColumn(name) !== null,
  );
  const tableKeys = orderedKeys.some((name) => systemTableColumn(name) !== null)
    ? orderedKeys
    : [...orderedKeys, 'created_by', 'created_date', 'status'];
  const columns: Column<DynamicListItem>[] = tableKeys.flatMap((name) => {
    const field = byName.get(name);
    if (field) {
      if (hidden.has(name)) return [];
      const type = field.type;
      const column: Column<DynamicListItem> = {
        key: name,
        header: moduleFieldLabel(def, field),
        sortable: field.sortable !== false,
      };
      const render = cellRender(type, name, field, loaderOf);
      if (render) column.render = render;
      if (widths[name]) column.width = widths[name];
      return [column];
    }
    const system = systemTableColumn(name);
    if (!system) return [];
    const column: Column<DynamicListItem> = {
      key: system.key,
      header: system.header,
      sortable: system.sortable,
    };
    if (system.render) column.render = system.render;
    if (system.className) column.className = system.className;
    if (widths[name]) column.width = widths[name];
    return [column];
  });
  const withActions = !!onView || !!onEdit || !!onDelete || !!onRestore;

  return (
    <Table<DynamicListItem>
      actionWidth={withActions ? 'w-40' : undefined}
      actionPosition={displayProps?.actionPosition ?? 'right'}
      showRowNumber
      testId={testId}
      columns={columns}
      data={data}
      rowKey={(row) => String(row.id)}
      fixedLayout={displayProps?.fixedLayout ?? true}
      dense={displayProps?.dense}
      hidePagination={displayProps?.hidePagination}
      hideTotalRecords={displayProps?.hideTotalRecords}
      stickyHeader={displayProps?.stickyHeader}
      stickyAction={displayProps?.stickyAction}
      renderAction={
        withActions
          ? (row) => (
              <div className="flex justify-evenly w-full gap-1">
                {onView && (
                  <RowActionButton
                    action="view"
                    testId={`${testPrefix}-view-${row.id}`}
                    title={`View ${row.id}`}
                    onClick={() => onView(row)}
                    iconSize={displayProps?.actionIconSize}
                    color={displayProps?.actionIconColor?.view}
                  />
                )}
                {onEdit && (
                  <RowActionButton
                    action="edit"
                    testId={`${testPrefix}-edit-${row.id}`}
                    title={`Edit ${row.id}`}
                    onClick={() => onEdit(row)}
                    iconSize={displayProps?.actionIconSize}
                    color={displayProps?.actionIconColor?.edit}
                  />
                )}
                {row.status === 'active' && onDelete && (
                  <RowActionButton
                    action="delete"
                    testId={`${testPrefix}-delete-${row.id}`}
                    title={`Delete ${row.id}`}
                    onClick={() => onDelete(row)}
                    disabled={isDeleting}
                    iconSize={displayProps?.actionIconSize}
                    color={displayProps?.actionIconColor?.delete}
                  />
                )}
                {row.status === 'inactive' && onRestore && (
                  <RowActionButton
                    action="restore"
                    testId={`${testPrefix}-restore-${row.id}`}
                    title={`Restore ${row.id}`}
                    onClick={() => onRestore(row)}
                    disabled={isRestoring}
                    iconSize={displayProps?.actionIconSize}
                    color={displayProps?.actionIconColor?.restore}
                  />
                )}
              </div>
            )
          : undefined
      }
      isEmptyState={isEmptyState}
      isFilteredEmptyState={isFilteredEmptyState}
      {...rest}
    />
  );
}

export default DynamicTable;
