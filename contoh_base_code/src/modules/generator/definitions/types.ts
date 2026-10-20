import type {
  DetailCardDisplayProps,
  DetailRowDisplayProps,
  FeatureKey,
  FormLayoutItem,
  FormLayoutItemKind,
  GeneratorFieldConfig,
  MenuIcon,
  ModuleI18nDict,
  TableDisplayProps,
} from '../types';

export type { FormLayoutItem, FormLayoutItemKind };

/** Versi skema definisi modul. Naikkan bila ada perubahan breaking. */
export const MODULE_DEFINITION_VERSION = 1 as const;

export type ModuleDefinitionVersion = typeof MODULE_DEFINITION_VERSION;

/** Hanya `published` yang di-render runtime; `draft` hanya tampil di preview wizard. */
export type ModuleDefinitionStatus = 'draft' | 'published';

/**
 * Perilaku hapus: `hard` = record dihapus permanen, `soft` = status → inactive
 * + endpoint restore (pola modul user).
 */
export type DeleteMode = 'hard' | 'soft';

/** Layout kolom tabel list. Kolom sistem (created_by, created_date, status) selalu di akhir. */
export interface TableLayout {
  /** Nama field berurutan (ref ke `fields[].name`). */
  order: string[];
  /** Subset `order` yang disembunyikan. */
  hidden: string[];
  /** Lebar kolom piksel per field (opsional; tanpa entri = otomatis). */
  widths?: Record<string, number>;
  /** Props tampilan komponen Table (opsional; tak di-set = perilaku lama). */
  props?: TableDisplayProps;
}

/** Layout halaman detail (read-only). Bila absen: urutan form, semua tampil. */
export interface DetailLayout {
  /** Nama field berurutan (ref ke `fields[].name`). */
  order: string[];
  /** Subset `order` yang disembunyikan. */
  hidden: string[];
  /** Props tampilan per field (opsional; tak di-set = perilaku lama). */
  props?: Record<string, DetailRowDisplayProps>;
  /** Props tampilan kartu detail (opsional). */
  card?: DetailCardDisplayProps;
}

export interface ModuleLayout {
  form: FormLayoutItem[];
  table: TableLayout;
  detail?: DetailLayout;
}

/** Kolom sistem tabel: selalu ada, bisa diatur posisinya, tak bisa disembunyikan. */
export const SYSTEM_TABLE_COLUMNS: string[] = ['created_by', 'created_date', 'status'];

/**
 * Single source of truth satu modul dinamis (v1).
 * Disimpan di mock store (seed JSON + localStorage), di-render generik oleh
 * FE saat runtime. Node-safe: boleh dipakai wizard maupun runtime.
 */
export interface ModuleDefinition {
  version: ModuleDefinitionVersion;
  /** Identity stabil & unik, kebab path: `region` atau `mater-data/company`. Immutable setelah publish. */
  key: string;
  /** Label plural tampil: `Companies`. */
  label: string;
  /** Label singular tampil: `Company`. */
  singularLabel: string;
  /** Parent path kebab (`mater-data`) atau null = root. */
  parent: string | null;
  /** Basis route FE tanpa leading slash: `mater-data/companies`. */
  routeBase: string;
  /** Base permission key; suffix `.view/.create/.update/.delete/.bulk_upload/.export` otomatis. */
  permissionKey: string;
  /** Plural namespace data di mock store (mis. `companies`). */
  apiPlural: string;
  moduleType: 'crud';
  features: Record<FeatureKey, boolean>;
  fields: GeneratorFieldConfig[];
  layout: ModuleLayout;
  deleteMode: DeleteMode;
  status: ModuleDefinitionStatus;
  /** Ikon menu sidebar (opsional; absen = ikon bawaan). Nempel di menu modul bila root, di grup parent bila ber-parent. */
  menuIcon?: MenuIcon;
  /**
   * Per-module translations (`module:{key}` namespace, e.g.
   * `field.name.label`, `title.list`). Optional; missing entries fall back
   * to the stored English defaults, then to the `general` namespace.
   */
  i18n?: ModuleI18nDict;
  createdAt?: string;
  updatedAt?: string;
}
