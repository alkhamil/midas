import { useRoleForm } from '../hooks';
import RoleForm from '../components/RoleForm';

function RoleCreate() {
  const { defaultValues, onSubmit, onCancel, permissionCatalog, isSubmitting } = useRoleForm();

  return (
    <RoleForm
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onCancel={onCancel}
      catalog={permissionCatalog}
      isSubmitting={isSubmitting}
    />
  );
}

export default RoleCreate;
