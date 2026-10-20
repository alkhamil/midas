export type AppScope = 'internal' | 'balai_lelang' | 'third_party';

export const REQUIRED_APP_SCOPE: Record<string, AppScope> = {
  internal: 'internal',
  balailelang: 'balai_lelang',
  thirdparty: 'third_party',
};

export interface UserRole {
  id: number;
  name: string;
  permissions: string[];
}

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
