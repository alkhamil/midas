import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../../../../app/providers';
import { navItems } from '../../../../app/navigation';
import { getFirstAccessiblePath } from '../../../../shared/utils';
import { useLoginForm } from '../hooks';
import LoginForm from '../components/LoginForm';
import DemoAccountsCard from '../components/DemoAccountsCard';

/** Halaman login: redirect bila sudah auth, sonst form + akun demo. */
function LoginPage() {
  const { isAuthenticated, permissions } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const form = useLoginForm();

  if (isAuthenticated) {
    return <Navigate to={from ?? getFirstAccessiblePath(navItems, permissions)} replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-8">
      <div className="flex w-full max-w-md flex-col stack-gap">
        <LoginForm
          username={form.username}
          password={form.password}
          error={form.error}
          submitting={form.submitting}
          onUsernameChange={form.setUsername}
          onPasswordChange={form.setPassword}
          onSubmit={form.handleSubmit}
        />
        <DemoAccountsCard onSelect={form.fillDemoAccount} />
      </div>
    </div>
  );
}

export default LoginPage;
