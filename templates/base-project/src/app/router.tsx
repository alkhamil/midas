import { createBrowserRouter } from 'react-router';
import ErrorStatePage from '../shared/components/ErrorStatePage';
import { AuthProvider, PermissionGate } from './providers';
import ProtectedAppShell from './ProtectedAppShell';
import { LoginPage } from '../modules/auth/login';
import { generatedRoutes } from './generated/routes';

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
              ...generatedRoutes,
              { path: '*', element: <ErrorStatePage type="404" /> },
            ],
          },
        ],
      },
      { path: 'login', element: <LoginPage /> },
    ],
  },
]);
