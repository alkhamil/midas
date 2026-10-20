import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Alert, Badge, Button, Card } from '../../../shared/components/ui';
import { ChevronRight, CircleCheck, Database, Settings, Pencil } from 'lucide-react';
import { useDynamicDefinitions } from '../../generator/runtime/hooks';

const STACK = [
  'React 19',
  'TypeScript',
  'Vite',
  'Tailwind CSS 4',
  'TanStack Query',
  'React Hook Form',
  'React Router 7',
];

const FLOW_KEYS = ['config', 'formCanvas', 'livePreview', 'listCanvas', 'detailCanvas', 'review'] as const;

function StatCard({
  icon,
  iconClass,
  value,
  label,
  testId,
}: {
  icon: React.ReactNode;
  iconClass: string;
  value: number;
  label: string;
  testId?: string;
}) {
  return (
    <Card testId={testId}>
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-semibold leading-none text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </Card>
  );
}

function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: definitions = [], isLoading } = useDynamicDefinitions('');
  const published = definitions.filter((def) => def.status === 'published');
  const drafts = definitions.filter((def) => def.status !== 'published');

  return (
    <div className="flex flex-col section-gap">
      <div
        data-testid="dashboard-hero"
        className="relative overflow-hidden rounded-xl bg-primary text-primary-foreground"
      >
        <Settings className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 rotate-12 opacity-15" />
        <div className="relative flex flex-col gap-4 p-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider opacity-80">
              {t('dashboard.eyebrow')}
            </p>
            <h1 className="mt-1 text-xl font-semibold">{t('dashboard.title')}</h1>
            <p className="mt-1 max-w-2xl text-sm opacity-90">{t('dashboard.description')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="custom"
              className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
              icon={<Settings className="h-4 w-4" />}
              onClick={() => navigate('/generator')}
            >
              {t('dashboard.openGenerator')}
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {STACK.map((item) => (
              <span
                key={item}
                className="rounded-full border border-primary-foreground/30 px-2 py-0.5 text-xs"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          testId="dashboard-stat-total"
          icon={<Database className="h-5 w-5" />}
          iconClass="bg-primary/10 text-primary"
          value={definitions.length}
          label={t('dashboard.statTotal')}
        />
        <StatCard
          testId="dashboard-stat-published"
          icon={<CircleCheck className="h-5 w-5" />}
          iconClass="bg-success/10 text-success"
          value={published.length}
          label={t('dashboard.statPublished')}
        />
        <StatCard
          testId="dashboard-stat-draft"
          icon={<Pencil className="h-4 w-4" />}
          iconClass="bg-warning/10 text-warning"
          value={drafts.length}
          label={t('dashboard.statDraft')}
        />
      </div>

      <Card testId="dashboard-flow-card" title={t('dashboard.flowTitle')}>
        <ol className="flex flex-col">
          {FLOW_KEYS.map((key, index) => (
            <li key={key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {index + 1}
                </span>
                {index < FLOW_KEYS.length - 1 && <span className="w-px flex-1 bg-border" />}
              </div>
              <div className="pb-5">
                <p className="text-sm font-medium text-foreground">
                  {t(`wizard.steps.${key}`)}
                </p>
                <p className="text-xs text-muted-foreground">{t(`dashboard.flow.${key}`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Card
        testId="dashboard-modules-card"
        title={t('dashboard.modulesTitle')}
        actions={
          <Button size="sm" variant="secondary" onClick={() => navigate('/generator')}>
            {t('dashboard.openGenerator')}
          </Button>
        }
      >
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('dashboard.loading')}</p>
        ) : published.length === 0 ? (
          <Alert variant="info" message={t('dashboard.emptyModules')} />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {published.map((def) => (
              <li key={def.key}>
                <button
                  type="button"
                  onClick={() => navigate(`/${def.routeBase}`)}
                  title={t('dashboard.openRoute', { route: `/${def.routeBase}` })}
                  className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {def.label}
                    </span>
                    <code className="block truncate font-mono text-xs text-muted-foreground">
                      /{def.routeBase} • {t('dashboard.fieldsCount', { count: def.fields.length })}
                    </code>
                  </span>
                  <Badge variant="success">Live</Badge>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default DashboardPage;
