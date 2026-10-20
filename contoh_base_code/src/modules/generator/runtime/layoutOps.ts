/**
 * Operasi layout murni untuk canvas editor (drag reorder, span, visibilitas).
 * Murni & Node-safe.
 */
import type { DetailLayout, FormLayoutItem, ModuleLayout } from '../definitions';
import type {
  DetailCardDisplayProps,
  DetailRowDisplayProps,
  RowActionColor,
  RowActionKind,
  TableDisplayProps,
} from '../types';

const ROW_ACTION_KINDS: readonly RowActionKind[] = ['view', 'edit', 'delete', 'restore'];

const ROW_ACTION_COLORS: readonly RowActionColor[] = [
  'default',
  'info',
  'warning',
  'danger',
  'success',
  'muted',
];

/** Sanitasi ukuran ikon aksi kanvas (integer 12–24 px, cermin normalize). */
function sanitizeActionIconSize(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 12 && value <= 24
    ? value
    : undefined;
}

/** Sanitasi warna ikon per aksi kanvas (cermin normalize). */
function sanitizeActionIconColor(
  value: unknown,
): Partial<Record<RowActionKind, RowActionColor>> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const src = value as Record<string, unknown>;
  const colors: Partial<Record<RowActionKind, RowActionColor>> = {};
  for (const kind of ROW_ACTION_KINDS) {
    const color = src[kind];
    if (typeof color === 'string' && (ROW_ACTION_COLORS as readonly string[]).includes(color)) {
      colors[kind] = color as RowActionColor;
    }
  }
  return Object.keys(colors).length > 0 ? colors : undefined;
}

/** Pindahkan item form (drag active ke posisi over) + rapikan order. */
export function moveFormItem(layout: ModuleLayout, activeField: string, overField: string): ModuleLayout {
  const ordered = [...layout.form].sort((a, b) => a.order - b.order);
  const from = ordered.findIndex((item) => item.field === activeField);
  const to = ordered.findIndex((item) => item.field === overField);
  if (from === -1 || to === -1 || from === to) return layout;
  const [moved] = ordered.splice(from, 1);
  if (moved === undefined) return layout;
  ordered.splice(to, 0, moved);
  return {
    ...layout,
    form: ordered.map((item, index) => ({ ...item, order: index })),
  };
}

/** Rename key field di seluruh layout (form + tabel + detail). */
export function renameFieldInLayout(
  layout: ModuleLayout,
  oldName: string,
  newName: string,
): ModuleLayout {
  if (oldName === newName) return layout;
  const mapName = (name: string): string => (name === oldName ? newName : name);
  const form: FormLayoutItem[] = layout.form.map((item) =>
    (item.kind ?? 'field') === 'field' && item.field === oldName
      ? { ...item, field: newName }
      : item,
  );
  const widths: Record<string, number> | undefined = layout.table.widths
    ? Object.fromEntries(
        Object.entries(layout.table.widths).map(([name, width]) => [mapName(name), width]),
      )
    : undefined;
  const detailProps = layout.detail?.props
    ? Object.fromEntries(
        Object.entries(layout.detail.props).map(([name, props]) => [mapName(name), props]),
      )
    : undefined;
  return {
    ...layout,
    form,
    table: {
      order: layout.table.order.map(mapName),
      hidden: layout.table.hidden.map(mapName),
      ...(widths ? { widths } : {}),
      ...(layout.table.props ? { props: layout.table.props } : {}),
    },
    ...(layout.detail
      ? {
          detail: {
            order: layout.detail.order.map(mapName),
            hidden: layout.detail.hidden.map(mapName),
            ...(detailProps && Object.keys(detailProps).length > 0 ? { props: detailProps } : {}),
            ...(layout.detail.card ? { card: layout.detail.card } : {}),
          },
        }
      : {}),
  };
}

/** Atur lebar kolom satu field (clamp 1..12). */
export function setFormSpan(layout: ModuleLayout, field: string, span: number): ModuleLayout {
  return {
    ...layout,
    form: layout.form.map((item) =>
      item.field === field ? { ...item, colSpan: Math.min(12, Math.max(1, Math.floor(span) || 1)) } : item,
    ),
  };
}

/** Pindahkan kolom tabel (drag active ke posisi over). */
export function moveTableColumn(layout: ModuleLayout, activeField: string, overField: string): ModuleLayout {
  const order = [...layout.table.order];
  const from = order.indexOf(activeField);
  const to = order.indexOf(overField);
  if (from === -1 || to === -1 || from === to) return layout;
  const [moved] = order.splice(from, 1);
  if (moved === undefined) return layout;
  order.splice(to, 0, moved);
  return { ...layout, table: { ...layout.table, order } };
}

/** Toggle visibilitas kolom tabel. */
export function toggleTableColumn(layout: ModuleLayout, field: string): ModuleLayout {
  const hidden = layout.table.hidden.includes(field)
    ? layout.table.hidden.filter((name) => name !== field)
    : [...layout.table.hidden, field];
  return { ...layout, table: { ...layout.table, hidden } };
}

/** Atur lebar kolom tabel (px); ≤0 menghapus pengaturan (otomatis). */
export function setTableWidth(layout: ModuleLayout, field: string, width: number): ModuleLayout {
  const widths = { ...layout.table.widths };
  if (!Number.isFinite(width) || width <= 0) {
    delete widths[field];
  } else {
    widths[field] = Math.min(1200, Math.max(40, Math.floor(width)));
  }
  return { ...layout, table: { ...layout.table, widths } };
}

/** Patch props tampilan tabel (hanya nilai valid yang disimpan). */
export function setTableProps(layout: ModuleLayout, patch: Partial<TableDisplayProps>): ModuleLayout {
  const next: TableDisplayProps = { ...layout.table.props };
  for (const [key, value] of Object.entries(patch)) {
    if (typeof value === 'boolean') {
      (next as Record<string, boolean>)[key] = value;
    } else if (key === 'actionPosition' && (value === 'left' || value === 'right')) {
      next.actionPosition = value;
    } else if (key === 'actionIconSize') {
      const size = sanitizeActionIconSize(value);
      if (size === undefined) delete next.actionIconSize;
      else next.actionIconSize = size;
    } else if (key === 'actionIconColor') {
      const colors = sanitizeActionIconColor(value);
      if (colors === undefined) delete next.actionIconColor;
      else next.actionIconColor = colors;
    } else {
      delete (next as Record<string, boolean>)[key];
    }
  }
  return { ...layout, table: { ...layout.table, props: next } };
}

/** Tambah item section/divider ke form (id unik otomatis). */
export function addFormItem(
  layout: ModuleLayout,
  kind: 'section' | 'divider',
  label?: string,
): ModuleLayout {
  const used = new Set(layout.form.map((item) => item.field));
  let counter = layout.form.length + 1;
  let id = `${kind}-${counter}`;
  while (used.has(id)) {
    counter += 1;
    id = `${kind}-${counter}`;
  }
  const ordered = [...layout.form].sort((a, b) => a.order - b.order);
  const created: FormLayoutItem = {
    field: id,
    order: ordered.length,
    colSpan: 12,
    kind,
  };
  if (kind === 'section') created.label = label ?? 'Section';
  const next = [...ordered, created];
  return {
    ...layout,
    form: next.map((item, index) => ({ ...item, order: index })),
  };
}

/** Hapus item form non-field (section/divider) berdasarkan id. */
export function removeFormItem(layout: ModuleLayout, id: string): ModuleLayout {
  const ordered = [...layout.form]
    .sort((a, b) => a.order - b.order)
    .filter((item) => item.field !== id || (item.kind ?? 'field') === 'field');
  return {
    ...layout,
    form: ordered.map((item, index) => ({ ...item, order: index })),
  };
}

/** Ubah label item section. */
export function setFormItemLabel(layout: ModuleLayout, id: string, label: string): ModuleLayout {
  return {
    ...layout,
    form: layout.form.map((item) =>
      item.field === id && item.kind === 'section' ? { ...item, label } : item,
    ),
  };
}

/** Pindahkan item detail (drag active ke posisi over). */
export function moveDetailItem(layout: ModuleLayout, activeField: string, overField: string): ModuleLayout {
  const order = [...(layout.detail?.order ?? [])];
  const from = order.indexOf(activeField);
  const to = order.indexOf(overField);
  if (from === -1 || to === -1 || from === to) return layout;
  const [moved] = order.splice(from, 1);
  if (moved === undefined) return layout;
  order.splice(to, 0, moved);
  return { ...layout, detail: { ...(layout.detail ?? { order: [], hidden: [] }), order } };
}

/** Toggle visibilitas field detail. */
export function toggleDetailItem(layout: ModuleLayout, field: string): ModuleLayout {
  const base = layout.detail ?? { order: [], hidden: [] as string[] };
  const hidden = base.hidden.includes(field)
    ? base.hidden.filter((name) => name !== field)
    : [...base.hidden, field];
  return { ...layout, detail: { ...base, hidden } };
}

/** Patch props tampilan satu baris detail (hanya boolean yang disimpan). */
export function setDetailRowProps(
  layout: ModuleLayout,
  field: string,
  patch: Partial<DetailRowDisplayProps>,
): ModuleLayout {
  const base = layout.detail ?? { order: [], hidden: [] as string[] };
  const props = { ...base.props };
  const merged = { ...props[field], ...patch };
  const next: DetailRowDisplayProps = {};
  for (const [key, value] of Object.entries(merged)) {
    if (typeof value === 'boolean') {
      (next as Record<string, boolean>)[key] = value;
    }
  }
  if (Object.keys(next).length > 0) props[field] = next;
  else delete props[field];
  const detail: DetailLayout = { order: base.order, hidden: base.hidden };
  if (Object.keys(props).length > 0) detail.props = props;
  if (base.card) detail.card = base.card;
  return { ...layout, detail };
}

/** Patch props tampilan kartu detail. */
export function setDetailCardProps(
  layout: ModuleLayout,
  patch: Partial<DetailCardDisplayProps>,
): ModuleLayout {
  const base = layout.detail ?? { order: [], hidden: [] as string[] };
  const card: DetailCardDisplayProps = { ...base.card };
  if (patch.title !== undefined) {
    const title = patch.title.trim();
    if (title !== '') card.title = title;
    else delete card.title;
  }
  if (typeof patch.collapsible === 'boolean') card.collapsible = patch.collapsible;
  const detail: DetailLayout = { order: base.order, hidden: base.hidden };
  if (base.props) detail.props = base.props;
  if (Object.keys(card).length > 0) detail.card = card;
  return { ...layout, detail };
}
