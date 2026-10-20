export type ModuleType = 'crud';

/** Jenis item layout form kanvas 12 kolom. */
export type FormLayoutItemKind = 'field' | 'section' | 'divider';

/** Posisi satu item dalam grid form 12 kolom. */
export interface FormLayoutItem {
  /**
   * Nama field (ref ke `fields[].name`) bila `kind` field;
   * id unik bebas (`section-1`, …) bila section/divider.
   */
  field: string;
  /** Urutan tampil (0-based, unik). */
  order: number;
  /** Lebar kolom grid 1..12 (12 = satu baris penuh). */
  colSpan: number;
  /** Default `field`. */
  kind?: FormLayoutItemKind;
  /** Judul tampil bila `kind === 'section'`. */
  label?: string;
}

/** Language codes supported for per-module translations. */
export type ModuleLanguage = 'en' | 'id';

/**
 * Per-module translation dictionaries, embedded in the definition
 * (`ModuleDefinition.i18n`). Keys follow the `module:{key}` convention,
 * e.g. `field.name.label`, `title.list`. Missing entries fall back to the
 * stored English defaults, then to the `general` namespace.
 */
export type ModuleI18nDict = Partial<Record<ModuleLanguage, Record<string, string>>>;

export type FeatureKey =
  | 'list'
  | 'detail'
  | 'create'
  | 'edit'
  | 'delete'
  | 'bulkUpload'
  | 'export';

export type FieldType =
  | 'textField'
  | 'textareaField'
  | 'passwordField'
  | 'numberField'
  | 'currencyField'
  | 'dateField'
  | 'dateRangeField'
  | 'selectField'
  | 'selectMultipleField'
  | 'radioGroupField'
  | 'checkboxField'
  | 'checkboxGroupField'
  | 'switchField'
  | 'fileUploadField'
  | 'colorField'
  | 'editorField'
  | 'formArrayField';

export type DataSource =
  | 'none'
  | 'mockStatic'
  | 'mockPagingInfinityScroll'
  | 'relation'
  | 'api';

export interface FieldOption {
  label: string;
  value: string;
}

export interface ApiSourceConfig {
  endpoint: string;
  method?: string;
  valueField?: string;
  labelField?: string;
}

/** Konfigurasi relasi antar modul (bila `source === 'relation'`). */
export interface RelationConfig {
  /** Key definisi target, mis. `mater-data/company`. */
  definitionKey: string;
  /** Field target yang dipakai sebagai label option. */
  labelField: string;
  /** Field target yang dipakai sebagai value (default `id`). */
  valueField?: string;
  /**
   * `apiPlural` modul target (mis. `companies`) — diisi wizard saat target
   * dipilih; fallback turunan jamak Inggris sederhana bila kosong.
   */
  apiPlural?: string;
}

/** Kriteria filter per field — opsi valid tergantung tipe field (lihat filterCriteriaRegistry). */
export type FilterCriteria =
  | 'contains'
  | 'exact'
  | 'numberExact'
  | 'numberMin'
  | 'numberMax'
  | 'numberRange'
  | 'dateExact'
  | 'dateRange'
  | 'dateOverlap'
  | 'optionExact'
  | 'optionAny'
  | 'booleanExact';

/** Satu field deklaratif dalam konfigurasi generator. */
export interface GeneratorFieldConfig {
  /** camelCase, mis. `regionName`. */
  name: string;
  /** Label tampil, mis. `Region Name`. */
  label: string;
  type: FieldType;
  /** Rules format string, mis. `["required", "min:3", "max:100"]`. */
  rules: string[];
  source: DataSource;
  /** Wajib bila `source === 'mockStatic'`; contoh saat `source === 'api'`. */
  options?: FieldOption[];
  /** Konfigurasi endpoint bila `source === 'api'`. */
  api?: ApiSourceConfig;
  /** Konfigurasi relasi bila `source === 'relation'`. */
  relation?: RelationConfig;
  /** Kolom tabel bisa di-sort (default true). */
  sortable?: boolean;
  /** Kolom tampil sebagai filter (default tergantung tipe). */
  filterable?: boolean;
  /** Kriteria filter bila `filterable` (default tergantung tipe). */
  filterCriteria?: FilterCriteria | null;
  /** Override placeholder otomatis (`Enter/Select <label>`). */
  placeholder?: string;
  /** Nonaktifkan input di form (default false). */
  disabled?: boolean;
  /** Tinggi textarea dalam baris (default komponen). */
  rows?: number;
  /** Filter file upload, mis. `.pdf,.png` (default semua). */
  accept?: string;
  /** Sub-field kolom bila `type === 'formArrayField'` (satu level; nested array dibuang). */
  subFields?: GeneratorFieldConfig[];
  /** Props komponen field + FormItem (per tipe; default = perilaku lama). */
  componentProps?: FieldComponentProps;
}

/** Ukuran komponen field (`sm`/`md`/`lg`; default `md`). */
export type FieldSize = 'sm' | 'md' | 'lg';

/** Props FormItem yang bisa diatur per field. */
export interface FormItemPropsConfig {
  /** Default `horizontal`. */
  layout?: 'horizontal' | 'vertical';
  /** Kelas lebar label, mis. `w-64` (default komponen). */
  labelWidth?: string;
  align?: 'center' | 'start';
  /** Tooltip label (string). */
  labelTooltip?: string;
  labelFontWeight?: 'light' | 'normal' | 'medium' | 'semibold' | 'bold';
}

/** Props TextField/number (textField, numberField). */
export interface TextFieldPropsConfig {
  size?: FieldSize;
  clearable?: boolean;
  /** Teks addon kiri, mis. `Rp`. */
  prefix?: string;
  /** Teks addon kanan, mis. `kg`. */
  suffix?: string;
}

/** Props TextAreaField (textareaField). */
export interface TextareaPropsConfig {
  size?: FieldSize;
}

/** Props PasswordField (passwordField). */
export interface PasswordPropsConfig {
  size?: FieldSize;
  defaultVisible?: boolean;
}

/** Props SelectField (selectField). */
export interface SelectPropsConfig {
  size?: FieldSize;
  /** Default false (opsi statis) / komponen (loader). */
  clearable?: boolean;
  /** Default true. */
  searchable?: boolean;
  /** Default true (loader) / false (opsi statis). */
  paginateOnScroll?: boolean;
  /** Ukuran halaman loader (default 20). */
  pageSize?: number;
  emptyOptionsText?: string;
  showSelectedOptions?: boolean;
  showValueOnly?: boolean;
}

/** Props SelectMultipleField (selectMultipleField). */
export interface SelectMultiplePropsConfig {
  size?: FieldSize;
  clearable?: boolean;
  /** Default true. */
  searchable?: boolean;
  /** Default true (loader) / false (opsi statis). */
  paginateOnScroll?: boolean;
  /** Ukuran halaman loader (default 20). */
  pageSize?: number;
  showSelectedOptions?: boolean;
  emptyOptionsText?: string;
  chipsSummary?: boolean;
  closeOnSelect?: boolean;
  hideCheckBox?: boolean;
}

/** Props DatePickerField (dateField). Tanggal sebagai string `YYYY-MM-DD`. */
export interface DatePickerPropsConfig {
  size?: FieldSize;
  showTime?: boolean;
  clearable?: boolean;
  minDate?: string;
  maxDate?: string;
}

/** Props DateRangeField (dateRangeField). */
export interface DateRangePropsConfig {
  size?: FieldSize;
  maxDate?: string;
  maxRangeDays?: number;
}

/** Props grup opsi (radioGroupField, checkboxGroupField). */
export interface GroupPropsConfig {
  size?: FieldSize;
}

/** Props CheckboxField (checkboxField). */
export interface CheckboxPropsConfig {
  size?: FieldSize;
  indeterminate?: boolean;
}

/** Props SwitchField (switchField). */
export interface SwitchPropsConfig {
  size?: FieldSize;
  /** Default false (label statis = label field). */
  showCheckedLabels?: boolean;
  checkedLabel?: string;
  uncheckedLabel?: string;
}

/** Props FileUploadField (fileUploadField). */
export interface UploadPropsConfig {
  size?: FieldSize;
  /** Default false (file tunggal). true = multi-file, nilai `File[]`. */
  multiple?: boolean;
}

/** Props ColorField (colorField). Nilai hex `#rrggbb` (string). */
export interface ColorPropsConfig {
  size?: FieldSize;
}

/** Props EditorField (editorField). Nilai HTML (string). */
export interface EditorPropsConfig {
  size?: FieldSize;
}

/** Props FormArrayField (formArrayField). Nilai baris embedded `Record<string, unknown>[]`. */
export interface ArrayPropsConfig {
  size?: FieldSize;
  /** Add button label (defaults to `t('array.add')`). */
  addLabel?: string;
  /** Judul dialog editor (default label field). */
  editorTitle?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Batas baris: tombol tambah mati saat tercapai (validasi jumlah via rules min/max). */
  maxRows?: number;
  /**
   * Kunci baris pertama: selalu ada satu baris (otomatis dibuat bila kosong)
   * dan baris pertama tidak bisa dihapus.
   */
  lockFirstRow?: boolean;
}

/**
 * Props komponen per field — hanya kunci yang relevan untuk tipenya
 * yang dipakai (lihat `propsKeyForType`); sisanya di-strip normalize.
 */
export interface FieldComponentProps {
  formItem?: FormItemPropsConfig;
  text?: TextFieldPropsConfig;
  textarea?: TextareaPropsConfig;
  password?: PasswordPropsConfig;
  select?: SelectPropsConfig;
  selectMultiple?: SelectMultiplePropsConfig;
  date?: DatePickerPropsConfig;
  dateRange?: DateRangePropsConfig;
  radio?: GroupPropsConfig;
  checkbox?: CheckboxPropsConfig;
  checkboxGroup?: GroupPropsConfig;
  switch?: SwitchPropsConfig;
  upload?: UploadPropsConfig;
  color?: ColorPropsConfig;
  editor?: EditorPropsConfig;
  array?: ArrayPropsConfig;
}

/** Props tampilan komponen Table yang bisa diatur per modul. */
export interface TableDisplayProps {
  /** Baris lebih rapat (`py-1`). */
  dense?: boolean;
  /** Sembunyikan kontrol pagination. */
  hidePagination?: boolean;
  /** Sembunyikan baris "Total Records". */
  hideTotalRecords?: boolean;
  /** Kolom fixed layout (lebar px ditaati). Default true. */
  fixedLayout?: boolean;
  /** Header sticky saat body di-scroll. */
  stickyHeader?: boolean;
  /** Kolom aksi sticky (freeze) saat scroll horizontal. */
  stickyAction?: boolean;
  /** Posisi kolom aksi: kiri (default) atau kanan. */
  actionPosition?: 'left' | 'right';
  /** Ukuran ikon tombol aksi baris, px (12–24; default 16). */
  actionIconSize?: number;
  /**
   * Override warna ikon tombol aksi per aksi (`default` = warna bawaan:
   * view info, edit warning, delete danger, restore success).
   */
  actionIconColor?: Partial<Record<RowActionKind, RowActionColor>>;
  /** Judul kustom saat tabel belum ada data (kosong = bawaan). */
  emptyStateTitle?: string;
  /** Deskripsi kustom saat tabel belum ada data (kosong = bawaan). */
  emptyStateDescription?: string;
  /** Judul kustom saat filter tak cocok (kosong = bawaan). */
  filteredEmptyStateTitle?: string;
  /** Deskripsi kustom saat filter tak cocok (kosong = bawaan). */
  filteredEmptyStateDescription?: string;
}

/** Aksi baris tabel yang ikonnya bisa diatur (lihat/ubah/hapus/restore). */
export type RowActionKind = 'view' | 'edit' | 'delete' | 'restore';

/** Warna ikon aksi: token thema (`default` = warna bawaan aksi). */
export type RowActionColor = 'default' | 'info' | 'warning' | 'danger' | 'success' | 'muted';

/** Props tampilan satu baris kartu detail. */
export interface DetailRowDisplayProps {
  /** Baris melebar penuh (nilai di bawah label). */
  fullWidth?: boolean;
  /** Tanpa garis divider di atas baris. */
  noDivider?: boolean;
  /** Render sebagai judul seksi. */
  heading?: boolean;
}

/** Props tampilan kartu detail. */
export interface DetailCardDisplayProps {
  /** Judul kartu (default `${singularLabel} Details`). */
  title?: string;
  /** Kartu bisa di-collapse. */
  collapsible?: boolean;
}

/** Single source of truth konfigurasi generator (skill §5). */
export interface GeneratorConfig {
  /** null/empty string = root. */
  parentName: string | null;
  moduleName: string;
  type: ModuleType;
  /**
   * Base permission key modul (wajib, single value tanpa titik —
   * mis. `user`, `generator`, `audit_trail`). Suffix `.view`, `.create`,
   * `.update`, `.delete` diturunkan otomatis oleh generator.
   */
  permissionKey: string;
  features: Record<FeatureKey, boolean>;
  fields: GeneratorFieldConfig[];
  /**
   * Props tampilan tabel (diteruskan dari `layout.table.props` definisi;
   * dibake sebagai literal di kode statis).
   */
  tableProps?: TableDisplayProps;
  /** Lebar kolom tabel (px) per nama field/kolom sistem; dibake sebagai literal. */
  tableWidths?: Record<string, number>;
  /**
   * Layout form kanvas (section/divider, urutan, lebar grid 1..12);
   * dibake sebagai literal di kode statis. Absen = semua field full-width berurutan.
   */
  formLayout?: FormLayoutItem[];
  /**
   * Ikon menu sidebar (opsional; tanpa entri = ikon bawaan).
   * Mapping otomatis: menempel di menu modul bila root, di grup parent
   * bila modul punya parent.
   */
  menuIcon?: MenuIcon;
  /** Per-module translations (`module:{key}` namespace); missing keys fall back to English defaults. */
  i18n?: ModuleI18nDict;
}

/**
 * Ikon menu dari `lucide-react`: nama komponen PascalCase (mis. `Database`,
 * `Users`). Render fallback ke `Database` bila nama tak dikenal.
 */
export interface MenuIcon {
  name: string;
}

/** Nama komponen ikon valid: PascalCase tanpa spasi/simbol (aman di-emit ke kode). */
export const MENU_ICON_NAME_RE = /^[A-Z][A-Za-z0-9]{0,39}$/;

/** Satu file hasil generate: path relatif repo + isi kode. */
export interface GeneratedFile {
  path: string;
  content: string;
}

/** Satu entri route siap sisip ke `src/app/router.tsx`. */
export interface RegistrationRoute {
  /** Mis. `companies` — dipakai untuk cek idempotensi. */
  path: string;
  /** Blok kode lengkap siap sisip (indent 6 spasi). */
  code: string;
}

/**
 * Data registrasi modul hasil generate ke app shell.
 * Dibangun murni dari config (Node-safe) lalu dikirim ke dev-server
 * untuk disisipkan ke `router.tsx` + `navigation.tsx`.
 */
export interface ModuleRegistration {
  /** Path import modul dari `src/app/`, mis. `../modules/mater-data/company`. */
  moduleImportPath: string;
  /** Blok import multi-baris siap sisip (kosong bila tanpa halaman). */
  importBlock: string;
  routes: RegistrationRoute[];
  /** Absolute path nav, mis. `/companies` — untuk cek idempotensi. */
  navPath: string;
  /** Item nav siap sisip: flat (root) atau child (ber-parent). */
  navItemCode: string;
  /** Snippet INTEGRATION.md: item flat atau blok group utuh + marker. */
  navSnippet: string;
  /** Parent kebab penuh, mis. `mater-data` (satu level group). */
  parentPath: string | null;
  /** Label group parent, mis. `Mater Data`. */
  parentLabel: string | null;
  /** Label modul plural, mis. `Companies`. */
  label: string;
  /** Nama ikon lucide nav (`Database` bila default; sudah disanitasi identifier). */
  iconName: string;
  permissionView: string;
}


