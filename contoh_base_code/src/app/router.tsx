import { createBrowserRouter } from "react-router";
import { ErrorStatePage } from "../shared/components/ui";
import { AuthProvider, PermissionGate } from "./providers";
import ProtectedAppShell from "./ProtectedAppShell";
import { DashboardPage } from "../modules/dashboard";
import { TypographyPage, ColorsPage, UiPage } from "../modules/showcase";
import { LoginPage } from "../modules/auth/login";
import { GeneratorPage } from "../modules/generator";
import {
  DynamicModuleRoutes,
  DynamicPreviewCreatePage,
  DynamicPreviewDetailPage,
  DynamicPreviewEditPage,
  DynamicPreviewPage,
} from "../modules/generator/runtime/DynamicRoutes";
import {
  UserListPage,
  UserCreatePage,
  UserViewPage,
  UserEditPage,
} from "../modules/user-management/user";
import {
  RoleListPage,
  RoleCreatePage,
  RoleViewPage,
  RoleEditPage,
} from "../modules/user-management/role";
import { SettingsPage } from "../modules/settings";
import {
  RegionListPage,
  RegionCreatePage,
  RegionViewPage,
  RegionEditPage,
} from '../modules/region';
// __GENERATOR_IMPORTS__

export const router = createBrowserRouter([
  {
    element: <AuthProvider />,
    children: [
      {
        element: <ProtectedAppShell />,
        children: [
          {
            element: <PermissionGate />,
            children: [
              { index: true, element: <DashboardPage /> },
              {
                path: "components/typography",
                element: <TypographyPage />,
                handle: {
                  breadcrumb: [
                    { label: "Component", labelKey: "nav.components" },
                    { label: "Typography", labelKey: "nav.typography" },
                  ],
                },
              },
              {
                path: "components/colors",
                element: <ColorsPage />,
                handle: {
                  breadcrumb: [
                    { label: "Component", labelKey: "nav.components" },
                    { label: "Colors", labelKey: "nav.colors" },
                  ],
                },
              },
              {
                path: "components/ui",
                element: <UiPage />,
                handle: {
                  breadcrumb: [
                    { label: "Component", labelKey: "nav.components" },
                    { label: "UI", labelKey: "nav.ui" },
                  ],
                },
              },
              {
                path: "generator",
                element: <GeneratorPage />,
                handle: {
                  breadcrumb: [
                    { label: "Generator", labelKey: "nav.generator" },
                  ],
                },
              },
              {
                path: "preview/:definitionKey",
                element: <DynamicPreviewPage />,
                handle: {
                  breadcrumb: [
                    { label: "Preview", labelKey: "common.preview" },
                  ],
                },
              },
              {
                path: "preview/:definitionKey/create",
                element: <DynamicPreviewCreatePage />,
                handle: {
                  breadcrumb: [
                    { label: "Preview", labelKey: "common.preview" },
                    { label: "Create", labelKey: "common.create" },
                  ],
                },
              },
              {
                path: "preview/:definitionKey/:recordId/view",
                element: <DynamicPreviewDetailPage />,
                handle: {
                  breadcrumb: [
                    { label: "Preview", labelKey: "common.preview" },
                    { label: "Detail", labelKey: "common.detail" },
                  ],
                },
              },
              {
                path: "preview/:definitionKey/:recordId/edit",
                element: <DynamicPreviewEditPage />,
                handle: {
                  breadcrumb: [
                    { label: "Preview", labelKey: "common.preview" },
                    { label: "Edit", labelKey: "common.edit" },
                  ],
                },
              },
              // Modul hasil generate-ke-repo terdaftar statis di sini (di atas
              // host dinamis agar menang). Modul dinamis murni tetap lewat
              // definisi published tanpa route statis.
              {
                path: "user-management/user",
                element: <UserListPage />,
                handle: {
                  breadcrumb: [
                    { label: "Users", labelKey: "user.labelPlural" },
                  ],
                  requiredPermission: "master-user.view",
                },
              },
              {
                path: "user-management/user/create",
                element: <UserCreatePage />,
                handle: {
                  breadcrumb: [
                    {
                      label: "Users",
                      labelKey: "user.labelPlural",
                      path: "/user-management/user",
                    },
                    { label: "Create", labelKey: "user.breadcrumbs.create" },
                  ],
                  requiredPermission: "master-user.create",
                },
              },
              {
                path: "user-management/user/:userId/view",
                element: <UserViewPage />,
                handle: {
                  breadcrumb: [
                    {
                      label: "Users",
                      labelKey: "user.labelPlural",
                      path: "/user-management/user",
                    },
                    { label: "Detail", labelKey: "user.breadcrumbs.detail" },
                  ],
                  requiredPermission: "master-user.view",
                },
              },
              {
                path: "user-management/user/:userId/edit",
                element: <UserEditPage />,
                handle: {
                  breadcrumb: [
                    {
                      label: "Users",
                      labelKey: "user.labelPlural",
                      path: "/user-management/user",
                    },
                    { label: "Edit", labelKey: "user.breadcrumbs.edit" },
                  ],
                  requiredPermission: "master-user.update",
                },
              },
              {
                path: "user-management/role",
                element: <RoleListPage />,
                handle: {
                  breadcrumb: [
                    { label: "Roles", labelKey: "role.labelPlural" },
                  ],
                  requiredPermission: "master-role.view",
                },
              },
              {
                path: "user-management/role/create",
                element: <RoleCreatePage />,
                handle: {
                  breadcrumb: [
                    {
                      label: "Roles",
                      labelKey: "role.labelPlural",
                      path: "/user-management/role",
                    },
                    { label: "Create", labelKey: "role.breadcrumbs.create" },
                  ],
                  requiredPermission: "master-role.create",
                },
              },
              {
                path: "user-management/role/:roleId/view",
                element: <RoleViewPage />,
                handle: {
                  breadcrumb: [
                    {
                      label: "Roles",
                      labelKey: "role.labelPlural",
                      path: "/user-management/role",
                    },
                    { label: "Detail", labelKey: "role.breadcrumbs.detail" },
                  ],
                  requiredPermission: "master-role.view",
                },
              },
              {
                path: "user-management/role/:roleId/edit",
                element: <RoleEditPage />,
                handle: {
                  breadcrumb: [
                    {
                      label: "Roles",
                      labelKey: "role.labelPlural",
                      path: "/user-management/role",
                    },
                    { label: "Edit", labelKey: "role.breadcrumbs.edit" },
                  ],
                  requiredPermission: "master-role.update",
                },
              },
              {
                path: "settings",
                element: <SettingsPage />,
                handle: {
                  breadcrumb: [
                    { label: "Settings", labelKey: "settings.breadcrumb" },
                  ],
                  requiredPermission: "settings.view",
                },
              },
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        path: 'regions',
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        element: <RegionListPage />,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        handle: {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          breadcrumb: [{ label: 'Regions', labelKey: 'region.breadcrumbs.list' }],
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          requiredPermission: 'region.view',
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        },
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      },
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        path: 'regions/create',
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        element: <RegionCreatePage />,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        handle: {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          breadcrumb: [{ label: 'Regions', labelKey: 'region.breadcrumbs.list', path: '/regions' }, { label: 'Create', labelKey: 'region.breadcrumbs.create' }],
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          requiredPermission: 'region.create',
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        },
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      },
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        path: 'regions/:regionId/view',
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        element: <RegionViewPage />,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        handle: {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          breadcrumb: [{ label: 'Regions', labelKey: 'region.breadcrumbs.list', path: '/regions' }, { label: 'Detail', labelKey: 'region.breadcrumbs.detail' }],
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          requiredPermission: 'region.view',
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        },
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      },
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        path: 'regions/:regionId/edit',
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        element: <RegionEditPage />,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        handle: {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          breadcrumb: [{ label: 'Regions', labelKey: 'region.breadcrumbs.list', path: '/regions' }, { label: 'Edit', labelKey: 'region.breadcrumbs.edit' }],
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          requiredPermission: 'region.update',
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        },
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      },
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      // __GENERATOR_ROUTES__
              // Host WAJIB `path: '*'`: pathless tidak match URL dinamis
              // (sisa pathname tak terkonsumsi → jatuh ke 404).
              {
                path: "not-found",
                element: <ErrorStatePage type="404" />,
                handle: { notFound: true },
              },
              { path: "*", element: <DynamicModuleRoutes /> },
            ],
          },
        ],
      },
      { path: "login", element: <LoginPage /> },
    ],
  },
]);
