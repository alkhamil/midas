import { createBrowserRouter } from 'react-router';
import { ErrorStatePage } from '@midas/ui-base';
import { AuthProvider, PermissionGate } from './providers';
import ProtectedAppShell from './ProtectedAppShell';
import { DashboardPage } from '../modules/dashboard';
import { LoginPage } from '../modules/auth/login';
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
              // __GENERATOR_ROUTES__
              { path: '*', element: <ErrorStatePage type="404" /> },
            ],
          },
        ],
      },
      { path: 'login', element: <LoginPage /> },
    ],
  },
]);
