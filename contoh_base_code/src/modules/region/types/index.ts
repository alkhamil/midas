export interface Region {
  id: string;
  text: string;
  number: number;
  textarea: string;
  textarea2: string;
  password: string;
  select: string;
  status: 'active' | 'inactive';
  createdBy: string;
  createdDate: string;
}

export interface RegionListItem {
  id: number;
  text: string;
  number: number;
  textarea: string;
  textarea2: string;
  password: string;
  select: string;
  created_date: string;
  created_by: string | null;
  status: 'active' | 'inactive';
}

export interface CreateRegionPayload {
  text: string;
  number: number;
  textarea: string;
  textarea2: string;
  password: string;
  select: string;
}

export interface GetRegionsParams {
  search?: string;
  status?: string;
  text?: string;
  number?: string;
  textarea?: string;
  textarea2?: string;
  select?: string;
  order?: string;
  sort?: 'asc' | 'desc';
  page?: number;
  size?: number;
}

export interface SelectOption {
  label: string;
  value: string;
}

export interface RegionMutationResult<T = Region> {
  message: string;
  data: T;
}

export interface BulkRowError {
  /** Nomor baris Excel 1-based (termasuk header). */
  row: number;
  /** Label kolom (header); kosong bila error sebaris file. */
  field?: string;
  message: string;
}

export interface BulkUploadResult {
  totalRows: number;
  successCount: number;
  failedCount: number;
  errors: BulkRowError[];
}
