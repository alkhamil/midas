import { useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Card, ErrorStatePage, FormSkeleton } from '../../../shared/components/ui';
import { useRegionForm } from '../hooks';
import { RegionForm } from '../components';

function RegionEditPage() {
  const { t } = useTranslation();
  const { regionId } = useParams<{ regionId: string }>();
  const {
    defaultValues,
    queryStatus,
    errorType,
    onSubmit,
    onCancel,
    selectOptions,
    isSubmitting,
  } = useRegionForm(regionId);

  if (errorType) return <ErrorStatePage type={errorType} />;

  if (queryStatus === 'loading') {
    return (
      <Card title={t('runtime.editTitle', { singular: t('region.label') })}>
        <FormSkeleton />
      </Card>
    );
  }

  return (
    <RegionForm
      key={regionId}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onCancel={onCancel}
      isEdit
      selectOptions={selectOptions}
      isSubmitting={isSubmitting}
    />
  );
}

export default RegionEditPage;
