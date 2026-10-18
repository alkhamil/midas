import { useCallback, useMemo, useState } from 'react';
import { Outlet, useNavigate } from 'react-router';
import {
  getStoredPermissions,
  hasPermissionKey,
} from '../../shared/utils';
import { useLoginMutation, useLogoutMutation } from '../../modules/auth/login/api';
import type { AuthUser, LoginPayload } from '../../modules/auth/login/types';
import { AuthContext, type AuthContextValue } from './auth-context';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const PERMISSIONS_KEY = 'permissions';

function readUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

/**
 * Provider session auth. Dipasang sebagai route element (punya akses router
 * untuk redirect logout) dan me-render `Outlet`.
 */
export function AuthProvider() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(() =>
    localStorage.getItem(TOKEN_KEY) ? readUser() : null,
  );
  const [permissions, setPermissions] = useState<string[]>(() =>
    localStorage.getItem(TOKEN_KEY) ? getStoredPermissions() : [],
  );

  const loginMutation = useLoginMutation();
  const logoutMutation = useLogoutMutation();

  const login = useCallback(async (payload: LoginPayload) => {
    const result = await loginMutation.mutateAsync(payload);
    localStorage.setItem(TOKEN_KEY, result.token);
    localStorage.setItem(USER_KEY, JSON.stringify(result.user));
    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(result.permissions));
    setUser(result.user);
    setPermissions(result.permissions);
  }, [loginMutation]);

  const logout = useCallback(() => {
    // Gagal request (mis. BE mati) tidak boleh menghalangi bersih sesi lokal.
    void logoutMutation.mutateAsync()
      .catch(() => {})
      .finally(() => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(PERMISSIONS_KEY);
      setUser(null);
      setPermissions([]);
      navigate('/login', { replace: true });
    });
  }, [logoutMutation, navigate]);

  const can = useCallback(
    (key: string) => hasPermissionKey(permissions, key),
    [permissions],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, permissions, isAuthenticated: user !== null, login, logout, can }),
    [user, permissions, login, logout, can],
  );

  return (
    <AuthContext.Provider value={value}>
      <Outlet />
    </AuthContext.Provider>
  );
}
