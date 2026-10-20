import { useQuery } from '@tanstack/react-query';
import { getUsers, getUserById, getRoleOptions } from './resolver';
import type { GetUsersParams, User, UserListItem } from '../types';
import type { ApiList } from '../../../../shared/types';
import type { SelectOption } from '../../../../shared/components/ui';

export function useUserListQuery(params: GetUsersParams) {
  return useQuery<ApiList<UserListItem>>({
    queryKey: ['users', params],
    queryFn: () => getUsers(params),
    placeholderData: (prev) => prev,
  });
}

export function useRoleOptionsQuery() {
  return useQuery<SelectOption[]>({
    queryKey: ['roles-options'],
    queryFn: () => getRoleOptions(),
    placeholderData: (prev) => prev,
  });
}

export function useUserDetailQuery(userId?: string) {
  return useQuery<User>({
    queryKey: ['user', userId],
    queryFn: () => getUserById(userId!),
    enabled: !!userId,
  });
}
