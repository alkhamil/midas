import { useMutation } from '@tanstack/react-query';
import { login, logout } from './resolver';
import type { LoginPayload, LoginResult } from '../types';

export function useLoginMutation() {
  return useMutation<LoginResult, unknown, LoginPayload>({
    mutationFn: (payload: LoginPayload) => login(payload),
  });
}

export function useLogoutMutation() {
  return useMutation<void, unknown, void>({
    mutationFn: () => logout(),
  });
}
