export interface User {
  id: string;
  name: string;
  role_id: string;
  role_name: string;
  username: string;
  email: string;
  password: string;
  status: 'active' | 'inactive';
  createdBy: string;
  createdDate: string;
}

export interface UserListItem {
  id: string;
  name: string;
  role_id: string;
  role_name: string;
  username: string;
  email: string;
  status: 'active' | 'inactive';
  created_date: string;
  created_by: string | null;
}

export interface CreateUserPayload {
  name: string;
  role_id: string;
  username: string;
  email: string;
  password: string;
  status: 'active' | 'inactive';
}

export interface GetUsersParams {
  page?: number;
  size?: number;
  status?: string;
  search?: string;
  role?: string;
  order?: string;
  sort?: 'asc' | 'desc';
}

export interface UserMutationResult {
  message: string;
  data: User;
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
