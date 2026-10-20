import UserForm from '../components/UserForm';
import { useUserForm } from '../hooks';

function UserCreate() {
  const { defaultValues, onSubmit, onCancel } = useUserForm();

  return (
    <UserForm
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  );
}

export default UserCreate;
