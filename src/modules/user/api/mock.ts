// Dibangkitkan oleh Midas Code Builder — jangan diedit manual; ubah desain/konfigurasi lalu generate ulang.
import type { User, UserInput, UserListParams } from '../types';

/** Saklar sumber data: `true` = mock lokal tanpa backend. Ubah ke `false` bila endpoint sudah tersedia. */
export const USE_MOCK = { list: true, detail: true, create: true, update: true, remove: true };

let store: User[] = [
  { id: '1', name: 'Budi Santoso', email: 'user1@contoh.id', role: '1', status: 'active', phone: true },
  { id: '2', name: 'Ani Wijaya', email: 'user2@contoh.id', role: '2', status: 'inactive', phone: true },
  { id: '3', name: 'Citra Lestari', email: 'user3@contoh.id', role: '3', status: 'active', phone: false },
  { id: '4', name: 'Dewi Anggraini', email: 'user4@contoh.id', role: '1', status: 'inactive', phone: true },
  { id: '5', name: 'Eko Prasetyo', email: 'user5@contoh.id', role: '2', status: 'active', phone: true },
];
const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 150));

export async function mockList(params: UserListParams): Promise<{ rows: User[]; total: number }> {
  const q = (params.search ?? '').trim().toLowerCase();
  const all = q ? store.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(q))) : store;
  return delay({ rows: all.slice((params.page - 1) * params.size, params.page * params.size), total: all.length });
}
export async function mockDetail(id: string): Promise<User> {
  const row = store.find((r) => r.id === id);
  if (!row) throw new Error('Data tidak ditemukan');
  return delay({ ...row });
}
export async function mockCreate(input: UserInput): Promise<User> {
  const row = { id: String(Date.now()), ...input } as User;
  store = [row, ...store];
  return delay(row);
}
export async function mockUpdate(id: string, input: UserInput): Promise<User> {
  store = store.map((r) => (r.id === id ? ({ ...r, ...input } as User) : r));
  return mockDetail(id);
}
export async function mockRemove(id: string): Promise<void> {
  store = store.filter((r) => r.id !== id);
  return delay(undefined);
}
