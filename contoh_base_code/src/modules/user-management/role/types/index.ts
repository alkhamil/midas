export interface Role {
  id: string;
  name: string;
  permissions: string[];
  status: 'active' | 'inactive';
  createdBy: string;
  createdDate: string;
}

export interface RoleListItem {
  id: string;
  name: string;
  permissions: string[];
  status: 'active' | 'inactive';
  created_date: string;
  created_by: string | null;
}

export interface CreateRolePayload {
  name: string;
  permissions: string[];
  status?: 'active' | 'inactive';
}

export interface GetRolesParams {
  search?: string;
  status?: string;
  order?: string;
  sort?: 'asc' | 'desc';
  page?: number;
  size?: number;
  nodata?: string;
}

export interface RoleMutationResult<T = Role> {
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
