import type { AuthUser, LoginPayload, LoginResult } from '../types';
import { normalizePermissions } from '../../../../shared/utils';

/** Saklar sumber data auth: `true` = mock lokal tanpa backend. */
export const USE_MOCK = {
  login: true,
  logout: true,
};

export interface MockUserRecord extends AuthUser {
  password: string;
  /**
   * Permission list akun ini — dikembalikan di response login.
   * Boleh bentuk penuh (`user.view`) atau compact (`user:view,create`)
   * yang di-expand saat login via `normalizePermissions`.
   * Wildcard `'*'` = akses penuh.
   */
  permissions: string[];
  description: string;
}

/**
 * Config akun demo mock-only.
 * Dipakai mock login + daftar akun di halaman login.
 */
const mockUserRecords: MockUserRecord[] = [
  {
    username: 'admin',
    password: 'admin123',
    name: 'Administrator',
    role: 'admin',
    permissions: ['*'],
    description: 'Akses penuh (wildcard)',
  },
];

/** Akun demo untuk ditampilkan di halaman login (mock only). */
export const demoAccounts = mockUserRecords.map(
  ({ username, password, role, description }) => ({ username, password, role, description }),
);

/** Auth mock-only (tanpa BE): kredensial dicek terhadap `mockUserRecords`. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function mockLogin(payload: LoginPayload): Promise<LoginResult> {
  await delay(500);
  const record = mockUserRecords.find(
    (candidate) => candidate.username === payload.username.trim().toLowerCase(),
  );
  if (!record || record.password !== payload.password) {
    throw new Error('auth.invalidCredentials');
  }
  return {
    user: { username: record.username, name: record.name, role: record.role },
    token: `mock-token-${record.username}-${Date.now()}`,
    permissions: normalizePermissions(record.permissions),
  };
}

export async function mockLogout(): Promise<void> {
  await delay(200);
}
