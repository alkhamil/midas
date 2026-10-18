// Dibangkitkan oleh Midas Code Builder — jangan diedit manual; ubah desain/konfigurasi lalu generate ulang.
export interface Role {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive';
}

export type RoleInput = Omit<Role, 'id'>;

export interface RoleListParams {
  page: number;
  size: number;
  search?: string;
}
