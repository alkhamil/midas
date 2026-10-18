// Per-module data layer: types, mock store, REST service, resolver (mock ↔ service switch) and react-query hooks.
import { pascalCase, sampleValue } from '../model.js';
import { kebabCase } from '../screen.js';
import { GEN_HEADER, lit, q, tsType } from './util.js';

export function typesFile(mod) {
    const E = pascalCase(mod.name);
    const fields = mod.entity.fields;
    const soft = !!mod.entity.softDelete;
    return `${GEN_HEADER}export interface ${E} {
  id: string;
${fields.map(f => `  ${f.name}${f.required ? '' : '?'}: ${tsType(f)};`).join('\n')}
${soft ? '  /** Set when the row is soft-deleted; cleared by restore. */\n  deletedAt?: string | null;\n' : ''}}

export type ${E}Input = Omit<${E}, 'id'${soft ? " | 'deletedAt'" : ''}>;

/** List filters by field name (\`''\` = no filter)${soft ? '; \\`showDeleted: \'true\'\\` also lists soft-deleted rows' : ''}. */
export type ${E}Filters = Record<string, string>;

export interface ${E}ListParams {
  page: number;
  size: number;
  search?: string;
  filters?: ${E}Filters;
}
`;
}

function sampleLit(fields, n, modName) {
    return Array.from({ length: n }, (_, i) => {
        const o = Object.fromEntries(fields.map(f => [f.name, f.type === 'password' ? '' : sampleValue(f, i, modName)]));
        return `  { id: '${i + 1}', ${Object.entries(o).map(([k, v]) => `${k}: ${lit(v)}`).join(', ')} },`;
    }).join('\n');
}

export function apiFiles(mod, sharedRel) {
    const E = pascalCase(mod.name);
    const endpoint = `/api/v1/${kebabCase(mod.name)}`;
    const soft = !!mod.entity.softDelete;
    const exact = mod.entity.fields.filter(f => f.type === 'enum' || f.type === 'relation').map(f => q(f.name)).join(', ');
    const mock = `${GEN_HEADER}import type { ${E}, ${E}Filters, ${E}Input, ${E}ListParams } from '../types';

/** Data source switches: \`true\` = local mock without a backend. Set to \`false\` once the endpoints are available. */
export const USE_MOCK = { list: true, detail: true, create: true, update: true, remove: true, restore: true };

let store: ${E}[] = [
${sampleLit(mod.entity.fields, 5, mod.name)}
];
const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 150));
const EXACT = new Set<string>([${exact}]);

function matches(row: ${E}, filters: ${E}Filters = {}): boolean {
  for (const [key, value] of Object.entries(filters)) {
    if (!value || key === 'showDeleted') continue;
    const current = (row as unknown as Record<string, unknown>)[key];
    if (typeof current === 'boolean' || EXACT.has(key)) {
      if (String(current) !== value) return false;
    } else if (!String(current ?? '').toLowerCase().includes(value.toLowerCase())) return false;
  }
  return true;
}

export async function mockList(params: ${E}ListParams): Promise<{ rows: ${E}[]; total: number }> {
  const q = (params.search ?? '').trim().toLowerCase();
${soft ? "  const showDeleted = params.filters?.showDeleted === 'true';\n  let all = showDeleted ? store : store.filter((r) => !r.deletedAt);" : '  let all = store;'}
  if (q) all = all.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(q)));
  all = all.filter((r) => matches(r, params.filters));
  return delay({ rows: all.slice((params.page - 1) * params.size, params.page * params.size), total: all.length });
}
export async function mockDetail(id: string): Promise<${E}> {
  const row = store.find((r) => r.id === id);
  if (!row) throw new Error('Item not found');
  return delay({ ...row });
}
export async function mockCreate(input: ${E}Input): Promise<${E}> {
  const row = { id: String(Date.now()), ...input } as ${E};
  store = [row, ...store];
  return delay(row);
}
export async function mockUpdate(id: string, input: ${E}Input): Promise<${E}> {
  store = store.map((r) => (r.id === id ? ({ ...r, ...input } as ${E}) : r));
  return mockDetail(id);
}
export async function mockRemove(id: string): Promise<void> {
${soft ? '  store = store.map((r) => (r.id === id ? { ...r, deletedAt: new Date().toISOString() } : r));' : '  store = store.filter((r) => r.id !== id);'}
  return delay(undefined);
}
export async function mockRestore(id: string): Promise<void> {
${soft ? '  store = store.map((r) => (r.id === id ? { ...r, deletedAt: null } : r));' : '  void id;'}
  return delay(undefined);
}
`;
    const service = `${GEN_HEADER}import api from '${sharedRel}shared/lib/api';
import type { ApiDetail, ApiList, ApiResponse } from '${sharedRel}shared/types';
import type { ${E}, ${E}Input, ${E}ListParams } from '../types';

const BASE = '${endpoint}';

export async function list(params: ${E}ListParams): Promise<{ rows: ${E}[]; total: number }> {
  const { filters, ...rest } = params;
  const { data } = await api.get<ApiResponse<ApiList<${E}>>>(BASE, { params: { ...rest, ...filters } });
  const out = data.response_output!.list;
  return { rows: out.content, total: out.pagination?.total_elements ?? out.content.length };
}
export async function detail(id: string): Promise<${E}> {
  const { data } = await api.get<ApiResponse<ApiDetail<${E}>>>(\`\${BASE}/\${id}\`);
  return data.response_output!.detail;
}
export async function create(input: ${E}Input): Promise<${E}> {
  const { data } = await api.post<ApiResponse<ApiDetail<${E}>>>(BASE, input);
  return data.response_output!.detail;
}
export async function update(id: string, input: ${E}Input): Promise<${E}> {
  const { data } = await api.put<ApiResponse<ApiDetail<${E}>>>(\`\${BASE}/\${id}\`, input);
  return data.response_output!.detail;
}
export async function remove(id: string): Promise<void> {
  await api.delete(\`\${BASE}/\${id}\`);
}
export async function restore(id: string): Promise<void> {
  await api.post(\`\${BASE}/\${id}/restore\`);
}
`;
    const resolver = `${GEN_HEADER}import { USE_MOCK, mockCreate, mockDetail, mockList, mockRemove, mockRestore, mockUpdate } from './mock';
import * as service from './service';

export const list = USE_MOCK.list ? mockList : service.list;
export const detail = USE_MOCK.detail ? mockDetail : service.detail;
export const create = USE_MOCK.create ? mockCreate : service.create;
export const update = USE_MOCK.update ? mockUpdate : service.update;
export const remove = USE_MOCK.remove ? mockRemove : service.remove;
export const restore = USE_MOCK.restore ? mockRestore : service.restore;
`;
    const queries = `${GEN_HEADER}import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ${E}Input, ${E}ListParams } from '../types';
import * as resolver from './resolver';

const KEY = ${q(kebabCase(mod.name))};

export const use${E}List = (params: ${E}ListParams) => useQuery({ queryKey: [KEY, 'list', params], queryFn: () => resolver.list(params) });
export const use${E}Detail = (id: string) => useQuery({ queryKey: [KEY, 'detail', id], queryFn: () => resolver.detail(id), enabled: !!id });

export function useCreate${E}() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: ${E}Input) => resolver.create(input), onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }) });
}
export function useUpdate${E}() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (v: { id: string; input: ${E}Input }) => resolver.update(v.id, v.input), onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }) });
}
export function useDelete${E}() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => resolver.remove(id), onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }) });
}
export function useRestore${E}() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => resolver.restore(id), onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }) });
}
`;
    return { 'api/mock.ts': mock, 'api/service.ts': service, 'api/resolver.ts': resolver, 'api/queries.ts': queries };
}
