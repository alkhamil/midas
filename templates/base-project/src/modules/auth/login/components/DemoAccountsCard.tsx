import { useTranslation } from 'react-i18next';
import { Card } from '../../../../shared/ui';
import { demoAccounts } from '../api';

interface DemoAccountsCardProps {
  onSelect: (account: { username: string; password: string }) => void;
  testId?: string;
}

/** Daftar akun demo mock-only; klik mengisi form login. */
function DemoAccountsCard({ onSelect, testId = 'auth-demo-accounts' }: DemoAccountsCardProps) {
  const { t } = useTranslation();
  return (
    <Card title={t('auth.demoAccounts')}>
      <ul data-testid={testId} className="flex flex-col gap-2">
        {demoAccounts.map((account) => (
          <li key={account.username}>
            <button
              type="button"
              onClick={() => onSelect(account)}
              title={t('auth.demoHint')}
              className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-left transition-colors hover:border-primary"
            >
              <span className="font-mono text-sm font-medium text-foreground">
                {account.username} / {account.password}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {account.role} — {account.description}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default DemoAccountsCard;
