import { useParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button, DetailCard } from '../../../../shared/components/ui';
import { useRoleForm } from '../hooks';
import { RolePermissions } from '../permissions';
import { useAuth } from '../../../../app/providers';

function RoleView() {
  const { t } = useTranslation();
  const { roleId } = useParams<{ roleId: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { queryStatus, queryMessage, errorType, detailRows } = useRoleForm(roleId);

  return (
    <div data-testid="role-view-page" className="flex min-h-full flex-col stack-gap">
      <DetailCard
        testId="role-detail-card"
        title={t('runtime.detailTitle', { singular: t('role.label') })}
        state={{ status: queryStatus, message: queryMessage, rows: detailRows, errorType }}
      />
      {queryStatus !== 'error' && (
        <div className="flex justify-end gap-4">
          <Button
            data-testid="role-back-button"
            className="w-30"
            variant="secondary"
            onClick={() => navigate(-1)}
          >
            {t('common.back')}
          </Button>
          {can(RolePermissions.update) && (
            <Button
              data-testid="role-edit-button"
              className="w-30"
              variant="primary"
              onClick={() => navigate(`/user-management/role/${roleId}/edit`)}
            >
              {t('common.edit')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default RoleView;
