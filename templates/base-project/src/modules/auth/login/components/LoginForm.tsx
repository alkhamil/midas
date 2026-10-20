import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Card,
  PasswordField,
  TextField,
} from '../../../../shared/ui';

interface LoginFormProps {
  username: string;
  password: string;
  error: string | null;
  submitting: boolean;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  testId?: string;
}

/** Kartu form kredensial login (username + password + tombol masuk). */
function LoginForm({
  username,
  password,
  error,
  submitting,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
  testId = 'auth-login-form',
}: LoginFormProps) {
  const { t } = useTranslation();
  return (
    <Card title={t('auth.loginTitle')}>
      <form data-testid={testId} onSubmit={onSubmit} className="flex flex-col stack-gap">
        {error && <Alert variant="danger" message={error} />}
        <TextField
          label={t('auth.username')}
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
          placeholder="admin"
          maxLength={50}
          autoComplete="username"
        />
        <PasswordField
          label={t('auth.password')}
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          placeholder="••••••••"
          maxLength={100}
          autoComplete="current-password"
        />
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? t('auth.processing') : t('auth.login')}
        </Button>
      </form>
    </Card>
  );
}

export default LoginForm;
