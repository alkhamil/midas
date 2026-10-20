/** Tipe runtime modul dinamis (cermin bentuk list/detail hasil generate). */

export interface DynamicListItem {
  id: number;
  status: 'active' | 'inactive';
  created_by: string | null;
  created_date: string;
  [field: string]: unknown;
}

export interface DynamicDetail {
  id: string;
  status: 'active' | 'inactive';
  createdBy: string;
  createdDate: string;
  [field: string]: unknown;
}

/** Param query list generik (page 1-based, sesuai kontrak BE). */
export interface DynamicListParams {
  search?: string;
  order?: string;
  sort?: 'asc' | 'desc';
  page?: number;
  size?: number;
  [filter: string]: string | number | undefined;
}

export interface DynamicOption {
  label: string;
  value: string;
}

/** Kunci permission turunan dari base key definisi. */
export function definitionPermissions(base: string): {
  view: string;
  create: string;
  update: string;
  delete: string;
  bulkUpload: string;
  export: string;
} {
  return {
    view: `${base}.view`,
    create: `${base}.create`,
    update: `${base}.update`,
    delete: `${base}.delete`,
    bulkUpload: `${base}.bulk_upload`,
    export: `${base}.export`,
  };
}

/** Segmen kebab terakhir key definisi (`mater-data/company` → `company`) untuk testId. */
export function definitionTestId(key: string): string {
  const segments = key.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? key;
}
