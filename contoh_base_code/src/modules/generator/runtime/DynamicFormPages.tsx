/** Halaman create/edit/detail generik — meniru halaman hasil generate. */
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Pencil } from 'lucide-react';
import { Button, Card, DetailCard, ErrorStatePage, FormSkeleton } from '../../../shared/components/ui';
import { useAuth } from '../../../app/providers';
import type { ModuleDefinition } from '../definitions';
import { definitionPermissions, definitionTestId } from './types';
import { useDynamicForm } from './hooks';
import DynamicForm from './DynamicForm';
import { moduleTitle } from './moduleI18n';

export function DynamicCreatePage({ def }: { def: ModuleDefinition }) {
  const { defaultValues, onSubmit, onCancel, isSubmitting, optionsOf, loaderOf } =
    useDynamicForm(def);
  return (
    <DynamicForm
      def={def}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onCancel={onCancel}
      isSubmitting={isSubmitting}
      optionsOf={optionsOf}
      loaderOf={loaderOf}
    />
  );
}

export function DynamicEditPage({ def }: { def: ModuleDefinition }) {
  const { t } = useTranslation();
  const { recordId } = useParams<{ recordId: string }>();
  const {
    defaultValues,
    queryStatus,
    errorType,
    onSubmit,
    onCancel,
    isSubmitting,
    optionsOf,
    loaderOf,
  } = useDynamicForm(def, recordId);

  if (errorType) return <ErrorStatePage type={errorType} />;

  if (queryStatus === 'loading') {
    return (
      <Card title={moduleTitle(def, 'edit', t('runtime.editTitle', { singular: def.singularLabel }))}>
        <FormSkeleton />
      </Card>
    );
  }

  return (
    <DynamicForm
      key={recordId}
      def={def}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onCancel={onCancel}
      isEdit
      isSubmitting={isSubmitting}
      optionsOf={optionsOf}
      loaderOf={loaderOf}
    />
  );
}

export function DynamicDetailPage({ def }: { def: ModuleDefinition }) {
  const { t } = useTranslation();
  const { recordId } = useParams<{ recordId: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();
  const testPrefix = definitionTestId(def.key);
  const permissions = definitionPermissions(def.permissionKey);
  const { queryStatus, queryMessage, errorType, detailRows } = useDynamicForm(def, recordId);

  return (
    <div data-testid={`${testPrefix}-view-page`} className="flex min-h-full flex-col stack-gap">
      <DetailCard
        testId={`${testPrefix}-detail-card`}
        title={def.layout.detail?.card?.title?.trim() || moduleTitle(def, 'detail', t('runtime.detailTitle', { singular: def.singularLabel }))}
        collapsible={def.layout.detail?.card?.collapsible === true}
        state={{ status: queryStatus, message: queryMessage, rows: detailRows, errorType }}
        actions={
          queryStatus !== 'error' ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                data-testid={`${testPrefix}-back-button`}
                variant="secondary"
                icon={<ChevronLeft className="h-4 w-4" />}
                onClick={() => navigate(-1)}
              >
                {t('common.back')}
              </Button>
              {def.features.edit && can(permissions.update) && (
                <Button
                  type="button"
                  data-testid={`${testPrefix}-edit-button`}
                  variant="secondary"
                  icon={<Pencil className="h-4 w-4" />}
                  onClick={() => navigate(`/${def.routeBase}/${recordId}/edit`)}
                >
                  {t('common.edit')}
                </Button>
              )}
            </div>
          ) : undefined
        }
      />
    </div>
  );
}
