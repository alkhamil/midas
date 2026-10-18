// Dibangkitkan oleh Midas Code Builder — jangan diedit manual; ubah desain/konfigurasi lalu generate ulang.
import { WidgetIcon, UserIcon, ShieldCheckIcon } from '@midas/ui-cms';
import type { NavItemType } from '../../shared/types/navigation';

export const generatedNavItems: NavItemType[] = [
  { label: 'User', path: '/user', icon: <WidgetIcon className="h-5 w-5" />, permissionKey: 'user' },
  { label: 'Role', path: '/role', icon: <UserIcon className="h-5 w-5" />, permissionKey: 'role' },
  { label: 'Dashboard', path: '/', icon: <ShieldCheckIcon className="h-5 w-5" />, permissionKey: 'dashboard' },
];
