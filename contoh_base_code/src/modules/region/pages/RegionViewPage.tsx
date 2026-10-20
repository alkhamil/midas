import { useParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Pencil } from 'lucide-react';
import { Button, DetailCard } from '../../../shared/components/ui';
import { useAuth } from '../../../app/providers';
import { useRegionForm } from '../hooks';
import { RegionPermissions } from '../permissions';

function RegionViewPage() {
  const { t } = useTranslation();
  const { regionId } = useParams<{ regionId: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { queryStatus, queryMessage, errorType, detailRows } = useRegionForm(regionId);

  return (
    <div data-testid="region-view-page" className="flex min-h-full flex-col stack-gap">
      <DetailCard
        testId="region-detail-card"
        title={t('runtime.detailTitle', { singular: t('region.label') })}
        state={{ status: queryStatus, message: queryMessage, rows: detailRows, errorType }}
        actions={
          queryStatus !== 'error' ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                data-testid="region-back-button"
                variant="secondary"
                icon={<ChevronLeft className="h-4 w-4" />}
                onClick={() => navigate(-1)}
              >
                {t('common.back')}
              </Button>
              {can(RegionPermissions.update) && (
                <Button
                  type="button"
                  data-testid="region-edit-button"
                  variant="secondary"
                  icon={<Pencil className="h-4 w-4" />}
                  onClick={() => navigate(`/regions/${regionId}/edit`)}
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

export default RegionViewPage;
