// Dibangkitkan oleh Midas Code Builder — jangan diedit manual; ubah desain/konfigurasi lalu generate ulang.
import type { RouteObject } from 'react-router';
import * as UserModule from '../../modules/user';
import * as RoleModule from '../../modules/role';
import * as DashboardModule from '../../modules/dashboard';

export const generatedRoutes: RouteObject[] = [
  { path: 'user', element: <UserModule.UserListPage /> },
  { path: 'user/create', element: <UserModule.UserCreatePage /> },
  { path: 'user/:id/edit', element: <UserModule.UserEditPage /> },
  { path: 'user/:id', element: <UserModule.UserViewPage /> },
  { path: 'role', element: <RoleModule.RoleListPage /> },
  { path: 'role/create', element: <RoleModule.RoleCreatePage /> },
  { path: 'role/:id/edit', element: <RoleModule.RoleEditPage /> },
  { path: 'role/:id', element: <RoleModule.RoleViewPage /> },
  { index: true, element: <DashboardModule.DashboardPage /> },
];
