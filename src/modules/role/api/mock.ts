// Dibangkitkan oleh Midas Code Builder — jangan diedit manual; ubah desain/konfigurasi lalu generate ulang.
import type { Role, RoleInput, RoleListParams } from '../types';

/** Saklar sumber data: `true` = mock lokal tanpa backend. Ubah ke `false` bila endpoint sudah tersedia. */
export const USE_MOCK = { list: true, detail: true, create: true, update: true, remove: true };

let store: Role[] = [
  { id: '1', name: 'Role 1', description: 'Keterangan description 1', status: 'active' },
  { id: '2', name: 'Role 2', description: 'Keterangan description 2', status: 'inactive' },
  { id: '3', name: 'Role 3', description: 'Keterangan description 3', status: 'active' },
  { id: '4', name: 'Role 4', description: 'Keterangan description 4', status: 'inactive' },
  { id: '5', name: 'Role 5', description: 'Keterangan description 5', status: 'active' },
];
const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 150));

export async function mockList(params: RoleListParams): Promise<{ rows: Role[]; total: number }> {
  const q = (params.search ?? '').trim().toLowerCase();
  const all = q ? store.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(q))) : store;
  return delay({ rows: all.slice((params.page - 1) * params.size, params.page * params.size), total: all.length });
}
export async function mockDetail(id: string): Promise<Role> {
  const row = store.find((r) => r.id === id);
  if (!row) throw new Error('Data tidak ditemukan');
  return delay({ ...row });
}
export async function mockCreate(input: RoleInput): Promise<Role> {
  const row = { id: String(Date.now()), ...input } as Role;
  store = [row, ...store];
  return delay(row);
}
export async function mockUpdate(id: string, input: RoleInput): Promise<Role> {
  store = store.map((r) => (r.id === id ? ({ ...r, ...input } as Role) : r));
  return mockDetail(id);
}
export async function mockRemove(id: string): Promise<void> {
  store = store.filter((r) => r.id !== id);
  return delay(undefined);
}
