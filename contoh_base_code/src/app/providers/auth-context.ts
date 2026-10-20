import { createContext } from 'react';
import type { AuthUser, LoginPayload } from '../../modules/auth/login/types';

export interface AuthContextValue {
  user: AuthUser | null;
  permissions: string[];
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => void;
  can: (key: string) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
