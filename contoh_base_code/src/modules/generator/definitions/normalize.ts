import type { GeneratorConfig, MenuIcon, ModuleI18nDict, ModuleLanguage } from '../types';
import { MENU_ICON_NAME_RE } from '../types';
import { normalizeConfig } from '../parser';
import { resolveNames, toKebabCase } from '../naming';
import type {
  DetailLayout,
  FormLayoutItem,
  ModuleDefinition,
  ModuleDefinitionStatus,
  ModuleLayout,
  TableLayout,
} from './types';
import type { DetailCardDisplayProps, DetailRowDisplayProps } from '../types';
import type { RowActionColor, RowActionKind, TableDisplayProps } from '../types';
import { MODULE_DEFINITION_VERSION, SYSTEM_TABLE_COLUMNS } from './types';

const MODULE_LANGUAGES: readonly ModuleLanguage[] = ['en', 'id'];

/**
 * Sanitize per-module translations: keep string entries only, drop empty
 * keys/values and unknown languages. Returns undefined when empty.
 */
export function normalizeModuleI18n(raw: unknown): ModuleI18nDict | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: ModuleI18nDict = {};
  for (const lng of MODULE_LANGUAGES) {
    const dict = (raw as Record<string, unknown>)[lng];
    if (!dict || typeof dict !== 'object') continue;
    const clean: Record<string, string> = {};
    for (const [key, value] of Object.entries(dict as Record<string, unknown>)) {
      if (typeof value === 'string' && key.trim() !== '' && value !== '') {
        clean[key.trim()] = value;
      }
    }
    if (Object.keys(clean).length > 0) out[lng] = clean;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Layout default: form satu kolom penuh (meniru tampilan form hasil generate), tabel semua field tampil. */
export function defaultLayoutForFields(
  fields: { name: string }[],
): ModuleLayout {
  return {
    form: fields.map((field, index) => ({ field: field.name, order: index, colSpan: 12 })),
    table: { order: fields.map((field) => field.name), hidden: [] },
  };
}

function normalizeOrderList(
  order: string[] | undefined,
  hidden: string[] | undefined,
  fieldNames: string[],
): { order: string[]; hidden: string[] } {
  // Kunci sistem dipertahankan pada posisinya (drag), bukan dibuang.
  const known = new Set([...fieldNames, ...SYSTEM_TABLE_COLUMNS]);
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const name of order ?? []) {
    if (!known.has(name) || seen.has(name)) continue;
    seen.add(name);
    clean.push(name);
  }
  // Field baru (belum ada di urutan) default di kanan mengikuti urutan
  // form kanvas (append), bukan di kiri.
  const fresh: string[] = [];
  for (const name of fieldNames) {
    if (seen.has(name)) continue;
    seen.add(name);
    fresh.push(name);
  }
  return { order: [...clean, ...fresh], hidden: (hidden ?? []).filter((name) => seen.has(name)) };
}

/** Normalisasi layout: buang ref tak dikenal, lengkapi field yang hilang, rapikan order/span. */
export function normalizeLayout(
  layout: ModuleLayout,
  fieldNames: string[],
): ModuleLayout {
  const known = new Set(fieldNames);
  const seen = new Set<string>();
  const form: FormLayoutItem[] = [];
  for (const item of [...layout.form].sort((a, b) => a.order - b.order)) {
    const kind = item.kind ?? 'field';
    if (seen.has(item.field)) continue;
    if (kind === 'field' && !known.has(item.field)) continue;
    if (kind !== 'field' && known.has(item.field)) continue;
    if (kind !== 'field' && kind !== 'section' && kind !== 'divider') continue;
    seen.add(item.field);
    form.push({
      field: item.field,
      order: form.length,
      colSpan: Math.min(12, Math.max(1, Math.floor(item.colSpan) || 12)),
      ...(kind !== 'field' ? { kind } : {}),
      ...(kind === 'section' && item.label ? { label: item.label } : {}),
    });
  }
  for (const name of fieldNames) {
    if (seen.has(name)) continue;
    seen.add(name);
    form.push({ field: name, order: form.length, colSpan: 12 });
  }
  const tableOrder = normalizeOrderList(layout.table.order, layout.table.hidden, fieldNames);
  // Kolom sistem selalu ada di urutan (di akhir bila belum diatur).
  for (const key of SYSTEM_TABLE_COLUMNS) {
    if (!tableOrder.order.includes(key)) tableOrder.order.push(key);
  }
  const widths: Record<string, number> = {};
  for (const [name, width] of Object.entries(layout.table.widths ?? {})) {
    if (!known.has(name) && !SYSTEM_TABLE_COLUMNS.includes(name)) continue;
    const px = Math.floor(width);
    if (!Number.isFinite(px)) continue;
    widths[name] = Math.min(1200, Math.max(40, px));
  }
  const table: TableLayout = { order: tableOrder.order, hidden: tableOrder.hidden };
  if (Object.keys(widths).length > 0) table.widths = widths;
  const rawProps = layout.table.props;
  if (rawProps && typeof rawProps === 'object') {
    const src = rawProps as Record<string, unknown>;
    const props: TableDisplayProps = {};
    for (const key of [
      'dense',
      'hidePagination',
      'hideTotalRecords',
      'fixedLayout',
      'stickyHeader',
      'stickyAction',
    ] as const) {
      if (typeof src[key] === 'boolean') props[key] = src[key];
    }
    if (src.actionPosition === 'left' || src.actionPosition === 'right') {
      props.actionPosition = src.actionPosition;
    }
    if (
      typeof src.actionIconSize === 'number' &&
      Number.isInteger(src.actionIconSize) &&
      src.actionIconSize >= 12 &&
      src.actionIconSize <= 24
    ) {
      props.actionIconSize = src.actionIconSize;
    }
    if (src.actionIconColor && typeof src.actionIconColor === 'object') {
      const colors: Partial<Record<RowActionKind, RowActionColor>> = {};
      for (const kind of ['view', 'edit', 'delete', 'restore'] as const) {
        const value = (src.actionIconColor as Record<string, unknown>)[kind];
        if (
          value === 'default' ||
          value === 'info' ||
          value === 'warning' ||
          value === 'danger' ||
          value === 'success' ||
          value === 'muted'
        ) {
          colors[kind] = value;
        }
      }
      if (Object.keys(colors).length > 0) props.actionIconColor = colors;
    }
    for (const key of [
      'emptyStateTitle',
      'emptyStateDescription',
      'filteredEmptyStateTitle',
      'filteredEmptyStateDescription',
    ] as const) {
      if (typeof src[key] === 'string' && src[key].trim()) props[key] = src[key].trim();
    }
    if (Object.keys(props).length > 0) table.props = props;
  }
  // Default detail mengikuti urutan tabel kiri-ke-kanan (cermin kanvas
  // List); tabel sendiri default mengikuti urutan form kanvas.
  const detailOrder = normalizeOrderList(
    layout.detail?.order ?? tableOrder.order,
    layout.detail?.hidden,
    fieldNames,
  );
  const detail: DetailLayout = { order: detailOrder.order, hidden: detailOrder.hidden };
  const rawDetail = layout.detail;
  if (rawDetail && typeof rawDetail === 'object') {
    const knownDetail = new Set(detail.order);
    if (rawDetail.props && typeof rawDetail.props === 'object') {
      const rowProps: Record<string, DetailRowDisplayProps> = {};
      for (const [name, value] of Object.entries(rawDetail.props)) {
        if (!knownDetail.has(name) || !value || typeof value !== 'object') continue;
        const src = value as Record<string, unknown>;
        const entry: DetailRowDisplayProps = {};
        if (typeof src.fullWidth === 'boolean') entry.fullWidth = src.fullWidth;
        if (typeof src.noDivider === 'boolean') entry.noDivider = src.noDivider;
        if (typeof src.heading === 'boolean') entry.heading = src.heading;
        if (Object.keys(entry).length > 0) rowProps[name] = entry;
      }
      if (Object.keys(rowProps).length > 0) detail.props = rowProps;
    }
    if (rawDetail.card && typeof rawDetail.card === 'object') {
      const card: DetailCardDisplayProps = {};
      if (typeof rawDetail.card.title === 'string' && rawDetail.card.title.trim() !== '') {
        card.title = rawDetail.card.title.trim();
      }
      if (typeof rawDetail.card.collapsible === 'boolean') {
        card.collapsible = rawDetail.card.collapsible;
      }
      if (Object.keys(card).length > 0) detail.card = card;
    }
  }
  return { form, table, detail };
}

export interface ConfigToDefinitionOptions {
  /** Override key (default: kebab path parent/modul). */
  key?: string;
  /** Default `soft` (pola deactivate/restore modul user). */
  deleteMode?: ModuleDefinition['deleteMode'];
  /** Default `draft`. */
  status?: ModuleDefinitionStatus;
  /** Layout awal (default: turunan fields). */
  layout?: ModuleLayout;
}

/** Konversi GeneratorConfig (wizard) → ModuleDefinition v1. Murni & Node-safe. */
export function configToDefinition(
  raw: GeneratorConfig,
  opts: ConfigToDefinitionOptions = {},
): ModuleDefinition {
  const config = normalizeConfig(raw);
  const names = resolveNames(config.parentName, config.moduleName);
  const parent = config.parentName
    ? config.parentName
        .split('/')
        .map((part) => toKebabCase(part))
        .filter(Boolean)
        .join('/')
    : null;
  const key = opts.key ?? (parent ? `${parent}/${names.kebab}` : names.kebab);
  const fieldNames = config.fields.map((field) => field.name);
  return {
    version: MODULE_DEFINITION_VERSION,
    key,
    label: names.entityPlural,
    singularLabel: names.entity,
    parent: parent || null,
    routeBase: names.routeBase,
    permissionKey: config.permissionKey,
    apiPlural: names.pluralKebab,
    moduleType: 'crud',
    features: { ...config.features },
    fields: config.fields,
    layout: normalizeLayout(
      opts.layout ?? defaultLayoutForFields(config.fields),
      fieldNames,
    ),
    deleteMode: opts.deleteMode ?? 'soft',
    status: opts.status ?? 'draft',
    menuIcon: config.menuIcon,
    i18n: normalizeModuleI18n(raw.i18n),
  };
}

/** Normalisasi definisi penuh (dipakai wizard publish & validasi seed). */
/**
 * Bersihkan ikon menu lama/asing ke bentuk `{ name }` lucide (atau undefined).
 * Murni & Node-safe.
 */
export function cleanMenuIcon(raw: unknown): MenuIcon | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const name = (raw as Record<string, unknown>).name;
  if (typeof name !== 'string') return undefined;
  const trimmed = name.trim();
  return MENU_ICON_NAME_RE.test(trimmed) ? { name: trimmed } : undefined;
}

export function normalizeDefinition(def: ModuleDefinition): ModuleDefinition {
  const asConfig: GeneratorConfig = {
    parentName: def.parent,
    moduleName: def.key,
    type: def.moduleType,
    permissionKey: def.permissionKey,
    features: { ...def.features },
    fields: def.fields,
  };
  const normalized = normalizeConfig(asConfig);
  return {
    ...def,
    version: MODULE_DEFINITION_VERSION,
    menuIcon: cleanMenuIcon(def.menuIcon),
    key: def.key.trim(),
    label: def.label.trim(),
    singularLabel: def.singularLabel.trim(),
    parent: normalized.parentName,
    routeBase: def.routeBase.trim().replace(/^\/+|\/+$/g, ''),
    permissionKey: normalized.permissionKey,
    apiPlural: def.apiPlural.trim().toLowerCase(),
    fields: normalized.fields,
    layout: normalizeLayout(def.layout, normalized.fields.map((field) => field.name)),
    i18n: normalizeModuleI18n(def.i18n),
  };
}
