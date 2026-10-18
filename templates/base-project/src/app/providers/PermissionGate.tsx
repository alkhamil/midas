import { Outlet, useMatches } from 'react-router';
import { ErrorStatePage } from '@midas/ui-base';
import { useAuth } from './useAuth';

/**
 * Guard permission per-route: baca `handle.requiredPermission` dari match
 * terdalam, tampilkan 403 bila user tidak punya key tersebut.
 */
function PermissionGate() {
  const matches = useMatches();
  const { can } = useAuth();
  const required = [...matches]
    .reverse()
    .map(
      (match) =>
        (match.handle as { requiredPermission?: string } | undefined)?.requiredPermission,
    )
    .find(Boolean);
  if (required && !can(required)) return <ErrorStatePage type="403" />;
  return <Outlet />;
}

export default PermissionGate;
