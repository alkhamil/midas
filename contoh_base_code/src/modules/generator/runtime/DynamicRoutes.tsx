/** Route dinamis dari definisi published + halaman preview satu definisi. */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useParams, useRoutes, type RouteObject } from 'react-router';
import { ErrorStatePage, LoadingOverlay } from '../../../shared/components/ui';
import type { ModuleDefinition } from '../definitions';
import { definitionPermissions } from './types';
import { useDynamicDefinition, useDynamicDefinitions } from './hooks';
import { useAuth } from '../../../app/providers';
import DynamicListPage from './DynamicListPage';
import { DynamicCreatePage, DynamicDetailPage, DynamicEditPage } from './DynamicFormPages';

/**
 * Guard permission untuk route dinamis. `PermissionGate` hanya membaca
 * `useMatches()` outer — match dari `useRoutes` dalam tidak terlihat di
 * sana — sehingga tiap halaman dinamis menjaga dirinya sendiri.
 */
function RequireDynamicPermission({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const { can } = useAuth();
  if (!can(permission)) return <ErrorStatePage type="403" />;
  return <>{children}</>;
}

function routesForDefinition(def: ModuleDefinition): RouteObject[] {
  const permissions = definitionPermissions(def.permissionKey);
  const routes: RouteObject[] = [];
  if (def.features.list) {
    routes.push({
      path: def.routeBase,
      element: (
        <RequireDynamicPermission permission={permissions.view}>
          <DynamicListPage def={def} />
        </RequireDynamicPermission>
      ),
    });
  }
  if (def.features.create) {
    routes.push({
      path: `${def.routeBase}/create`,
      element: (
        <RequireDynamicPermission permission={permissions.create}>
          <DynamicCreatePage def={def} />
        </RequireDynamicPermission>
      ),
    });
  }
  if (def.features.detail) {
    routes.push({
      path: `${def.routeBase}/:recordId/view`,
      element: (
        <RequireDynamicPermission permission={permissions.view}>
          <DynamicDetailPage def={def} />
        </RequireDynamicPermission>
      ),
    });
  }
  if (def.features.edit) {
    routes.push({
      path: `${def.routeBase}/:recordId/edit`,
      element: (
        <RequireDynamicPermission permission={permissions.update}>
          <DynamicEditPage def={def} />
        </RequireDynamicPermission>
      ),
    });
  }
  return routes;
}

function DynamicModuleRoutes() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useDynamicDefinitions('published');
  const routes: RouteObject[] = useMemo(
    () => (data ?? []).flatMap(routesForDefinition),
    [data],
  );
  const element = useRoutes(routes);
  if (isLoading) return <LoadingOverlay testId="dynamic-routes-loading" />;
  if (isError) {
    return (
      <ErrorStatePage
        type="500"
        title={t('error.dynamicLoadFailed')}
        onRetry={() => refetch()}
      />
    );
  }
  // Tak ada definisi yang match → 404 via route statis (handle notFound
  // mengatur judul + breadcrumb AppShell).
  if (!element) return <Navigate to="/not-found" replace />;
  return element;
}

function usePreviewDefinition(): {
  def: ModuleDefinition | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  key: string;
} {
  const { definitionKey } = useParams();
  const key = definitionKey ? decodeURIComponent(definitionKey) : '';
  const { data, isLoading, isError, refetch } = useDynamicDefinition(key || undefined);
  return { def: data, isLoading, isError, refetch: () => refetch(), key };
}

function PreviewGuard({ children }: { children: (def: ModuleDefinition) => React.ReactNode }) {
  const { def, isLoading, isError, refetch, key } = usePreviewDefinition();
  if (isLoading) return <LoadingOverlay testId="dynamic-preview-loading" />;
  if (isError || !def) {
    return (
      <ErrorStatePage
        type="404"
        title={`Definisi "${key}" tidak ditemukan.`}
        onRetry={() => refetch()}
      />
    );
  }
  return <>{children(def)}</>;
}

/** Preview satu definisi (termasuk draft) — verifikasi runtime tanpa cutover. */
function DynamicPreviewPage() {
  return (
    <PreviewGuard>
      {(def) => (def.features.list ? <DynamicListPage def={def} /> : <ErrorStatePage type="404" />)}
    </PreviewGuard>
  );
}

function DynamicPreviewCreatePage() {
  return (
    <PreviewGuard>
      {(def) => (def.features.create ? <DynamicCreatePage def={def} /> : <ErrorStatePage type="404" />)}
    </PreviewGuard>
  );
}

function DynamicPreviewDetailPage() {
  return (
    <PreviewGuard>
      {(def) => (def.features.detail ? <DynamicDetailPage def={def} /> : <ErrorStatePage type="404" />)}
    </PreviewGuard>
  );
}

function DynamicPreviewEditPage() {
  return (
    <PreviewGuard>
      {(def) => (def.features.edit ? <DynamicEditPage def={def} /> : <ErrorStatePage type="404" />)}
    </PreviewGuard>
  );
}

export {
  DynamicModuleRoutes,
  DynamicPreviewPage,
  DynamicPreviewCreatePage,
  DynamicPreviewDetailPage,
  DynamicPreviewEditPage,
};
