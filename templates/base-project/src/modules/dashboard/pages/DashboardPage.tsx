import { useTranslation } from 'react-i18next';
import { Card } from '@midas/ui-cms';
import { useAuth } from '../../../app/providers';

function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  return (
    <div data-testid="dashboard-page" className="flex flex-col stack-gap">
      <Card testId="dashboard-welcome" title={t('dashboard.welcome', { name: user?.name ?? '' })}>
        <p className="text-sm text-muted-foreground">{t('dashboard.description')}</p>
      </Card>
    </div>
  );
}

export default DashboardPage;
