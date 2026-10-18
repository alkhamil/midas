// Dibangkitkan oleh Midas Code Builder — jangan diedit manual; ubah desain/konfigurasi lalu generate ulang.
export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive';
  phone: boolean;
}

export type UserInput = Omit<User, 'id'>;

export interface UserListParams {
  page: number;
  size: number;
  search?: string;
}
