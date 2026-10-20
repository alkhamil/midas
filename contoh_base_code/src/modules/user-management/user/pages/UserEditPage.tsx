import { useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Card, ErrorStatePage, FormSkeleton } from '../../../../shared/components/ui';
import { useUserForm } from '../hooks';
import UserForm from '../components/UserForm';

function UserEdit() {
  const { t } = useTranslation();
  const { userId } = useParams<{ userId: string }>();
  const { defaultValues, user, queryStatus, errorType, onSubmit, onCancel } = useUserForm(userId);

  if (errorType) return <ErrorStatePage type={errorType} />;

  if (queryStatus === 'loading') {
    return (
      <Card title={t('runtime.editTitle', { singular: t('user.label') })}>
        <FormSkeleton />
      </Card>
    );
  }

  return (
    <UserForm
      defaultValues={defaultValues}
      user={user}
      onSubmit={onSubmit}
      onCancel={onCancel}
      isEdit
    />
  );
}

export default UserEdit;
