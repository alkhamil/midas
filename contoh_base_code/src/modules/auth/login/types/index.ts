export interface AuthUser {
  username: string;
  name: string;
  role: string;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface LoginResult {
  user: AuthUser;
  token: string;
  /** Sudah dinormalisasi (bentuk compact `modul:aksi` di-expand). */
  permissions: string[];
}
