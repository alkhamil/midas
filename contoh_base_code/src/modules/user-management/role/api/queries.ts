import { useQuery } from '@tanstack/react-query';
import { getRoles, getRoleById, getPermissions } from './resolver';
import type { GetRolesParams, Role, RoleListItem } from '../types';
import type { ApiList } from '../../../../shared/types';

export function useRoleListQuery(params: GetRolesParams) {
  return useQuery<ApiList<RoleListItem>>({
    queryKey: ['roles', params],
    queryFn: () => getRoles({ ...params, page: (params.page ?? 1) - 1 }),
    placeholderData: (prev) => prev,
  });
}

export function useRoleDetailQuery(id?: string) {
  return useQuery<Role>({
    queryKey: ['role', id],
    queryFn: () => getRoleById(id!),
    enabled: !!id,
  });
}

export function useRolePermissionsQuery() {
  return useQuery<string[]>({
    queryKey: ['role-permissions'],
    queryFn: getPermissions,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
