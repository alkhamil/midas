import { useEffect, useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../Button';
import Dialog from '../Dialog';
import Table, { type Column } from '../Table';
import { Pencil, Plus, Trash2 } from 'lucide-react';

export interface ArrayEditorApi<T> {
  /** Baris yang diedit, atau null saat tambah baru. */
  initial: T | null;
  onSave: (row: T) => void;
  onCancel: () => void;
  /**
   * Id form editor — pasang di form (`<FormGroup id={formId}>`) agar tombol
   * Simpan di footer dialog (di luar form) bisa submit via `form=`.
   * Editor hanya me-render isi form; tombol aksi milik footer dialog.
   */
  formId: string;
}

interface FormArrayFieldProps<T extends Record<string, unknown>> {
  value: T[] | null;
  onChange: (rows: T[]) => void;
  columns: Column<T>[];
  renderEditor: (api: ArrayEditorApi<T>) => ReactNode;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  error?: string;
  /** Add button label (defaults to `t('array.add')`). */
  addLabel?: string;
  /** Item name for dialog titles (add/edit). */
  editorTitle?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  maxRows?: number;
  /**
   * Kunci baris pertama: selalu ada satu baris (otomatis dibuat bila kosong)
   * dan baris pertama tidak bisa dihapus.
   */
  lockFirstRow?: boolean;
  className?: string;
  testId?: string;
  'data-testid'?: string;
}

export default function FormArrayField<T extends Record<string, unknown>>({
  value,
  onChange,
  columns,
  renderEditor,
  size = 'md',
  disabled = false,
  error,
  addLabel,
  editorTitle,
  emptyTitle,
  emptyDescription,
  maxRows,
  lockFirstRow = false,
  className = '',
  testId,
  'data-testid': dataTestId,
}: FormArrayFieldProps<T>) {
  const resolvedTestId = dataTestId ?? testId;
  const rows = value ?? [];
  const [editing, setEditing] = useState<{ index: number | null } | null>(null);
  const capped = maxRows !== undefined && rows.length >= maxRows;
  /** Id form editor baris — diteruskan ke renderEditor untuk submit via footer. */
  const rowFormId = useId();
  const { t } = useTranslation();
  const resolvedAddLabel = addLabel ?? t('array.add');
  const resolvedEditorTitle = editorTitle ?? t('array.data');
  const resolvedEmptyTitle = emptyTitle ?? t('array.emptyTitle');
  const resolvedEmptyDesc = emptyDescription ?? t('array.emptyDesc');

  // Baris pertama terkunci harus selalu ada — buat baris kosong otomatis.
  useEffect(() => {
    if (lockFirstRow && rows.length === 0) onChange([{} as T]);
  }, [lockFirstRow, rows.length, onChange]);

  function handleAdd(): void {
    setEditing({ index: null });
  }

  function handleSave(row: T) {
    if (editing?.index === null || editing?.index === undefined) {
      onChange([...rows, row]);
    } else {
      onChange(rows.map((existing, i) => (i === editing.index ? row : existing)));
    }
    setEditing(null);
  }

  function handleDelete(index: number) {
    if (lockFirstRow && index === 0) return;
    onChange(rows.filter((_, i) => i !== index));
  }

  const actionColumn: Column<T> = {
    key: '__actions',
    header: '',
    className: 'w-24 text-right',
    render: (_row, index) => (
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setEditing({ index: index ?? 0 })}
          data-testid={resolvedTestId ? `${resolvedTestId}-edit-${index}` : undefined}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          title={t('array.editRow')}
        >
          <Pencil className="h-4 w-4" />
        </button>
        {!(lockFirstRow && (index ?? 0) === 0) && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleDelete(index ?? 0)}
            data-testid={resolvedTestId ? `${resolvedTestId}-delete-${index}` : undefined}
            className="rounded p-1 text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50"
            title={t('array.deleteRow')}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    ),
  };

  return (
    <div data-testid={resolvedTestId} className={className}>
      {rows.length === 0 ? (
        <div
          data-testid={resolvedTestId ? `${resolvedTestId}-empty` : undefined}
          className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-8 text-center"
        >
          <p className="text-sm font-medium text-foreground">{resolvedEmptyTitle}</p>
          <p className="text-xs text-muted-foreground">{resolvedEmptyDesc}</p>
          <Button
            type="button"
            size={size}
            disabled={disabled || capped}
            onClick={handleAdd}
            data-testid={resolvedTestId ? `${resolvedTestId}-add-button` : undefined}
          >
            <Plus className="h-4 w-4" />
            {resolvedAddLabel}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col">
          <div className="flex items-center justify-end">
            <Button
              type="button"
              size={size}
              variant="secondary"
              disabled={disabled || capped}
              onClick={handleAdd}
              data-testid={resolvedTestId ? `${resolvedTestId}-add-button` : undefined}
            >
              <Plus className="h-4 w-4" />
              {resolvedAddLabel}
            </Button>
          </div>
          <div className="-mt-8">
            <Table<T>
              testId={resolvedTestId ? `${resolvedTestId}-table` : undefined}
              columns={[...columns, actionColumn]}
              rowKey={(_row, index) => index ?? 0}
              data={rows}
              totalRecords={rows.length}
              page={1}
              pageSize={Math.max(rows.length, 1)}
              onPageChange={() => {}}
              onPageSizeChange={() => {}}
              hidePagination
            />
          </div>
        </div>
      )}
      {error && (
        <p
          data-testid={resolvedTestId ? `${resolvedTestId}-error` : undefined}
          className="mt-1 text-xs text-danger"
          role="alert"
        >
          {error}
        </p>
      )}
      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`${editing?.index === null ? resolvedAddLabel : t('array.edit')} ${resolvedEditorTitle}`}
        testId={resolvedTestId ? `${resolvedTestId}-dialog` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              form={rowFormId}
              data-testid={resolvedTestId ? `${resolvedTestId}-row-save` : undefined}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        {/* Submit editor tidak boleh menggelembung ke form induk via React tree. */}
        <div
          onSubmit={(e) => {
            e.stopPropagation();
          }}
        >
          {editing !== null &&
            renderEditor({
              initial: editing.index === null ? null : (rows[editing.index] ?? null),
              onSave: handleSave,
              onCancel: () => setEditing(null),
              formId: rowFormId,
            })}
        </div>
      </Dialog>
    </div>
  );
}
