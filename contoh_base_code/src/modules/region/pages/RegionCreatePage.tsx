import { useRegionForm } from '../hooks';
import { RegionForm } from '../components';

function RegionCreatePage() {
  const { defaultValues, onSubmit, onCancel, selectOptions, isSubmitting } = useRegionForm();

  return (
    <RegionForm
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onCancel={onCancel}
      selectOptions={selectOptions}
      isSubmitting={isSubmitting}
    />
  );
}

export default RegionCreatePage;
