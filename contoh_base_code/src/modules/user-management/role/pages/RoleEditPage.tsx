import { useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Card, ErrorStatePage, FormSkeleton } from '../../../../shared/components/ui';
import { useRoleForm } from '../hooks';
import RoleForm from '../components/RoleForm';

function RoleEdit() {
  const { t } = useTranslation();
  const { roleId } = useParams<{ roleId: string }>();
  const {
    defaultValues,
    queryStatus,
    errorType,
    onSubmit,
    onCancel,
    permissionCatalog,
    isSubmitting,
  } = useRoleForm(roleId);

  if (errorType) return <ErrorStatePage type={errorType} />;

  if (queryStatus === 'loading') {
    return (
      <Card title={t('runtime.editTitle', { singular: t('role.label') })}>
        <FormSkeleton />
      </Card>
    );
  }

  return (
    <RoleForm
      key={roleId}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onCancel={onCancel}
      isEdit
      catalog={permissionCatalog}
      isSubmitting={isSubmitting}
    />
  );
}

export default RoleEdit;
