import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CircleX, Search, TriangleAlert } from 'lucide-react';
import Button from './Button';

export type ErrorStateType = '403' | '404' | '500';

interface ErrorStateConfig {
  titleKey: string;
  subtitleKey: string;
  testId: string;
  /** Tone medallion ikon. */
  tone: string;
  icon: typeof CircleX;
  /** Aksi primer kontekstual. */
  primaryKey: string;
}

const ERROR_STATE_CONFIG: Record<ErrorStateType, ErrorStateConfig> = {
  '403': {
    titleKey: 'error.forbiddenTitle',
    subtitleKey: 'error.forbiddenSubtitle',
    testId: 'forbidden-page',
    tone: 'bg-warning/15 text-warning',
    icon: TriangleAlert,
    primaryKey: 'error.toDashboard',
  },
  '404': {
    titleKey: 'error.notFoundTitle',
    subtitleKey: 'error.notFoundSubtitle',
    testId: 'not-found-page',
    tone: 'bg-info/15 text-info',
    icon: Search,
    primaryKey: 'error.toDashboard',
  },
  '500': {
    titleKey: 'error.systemTitle',
    subtitleKey: 'error.systemSubtitle',
    testId: 'error-page',
    tone: 'bg-danger/15 text-danger',
    icon: CircleX,
    primaryKey: 'error.retry',
  },
};

interface ErrorStatePageProps {
  type: ErrorStateType;
  className?: string;
  /** Override judul/subjudul bawaan. */
  title?: string;
  subtitle?: string;
  /** Tujuan aksi "Ke Dashboard" (default: `/`). */
  homePath?: string;
  /** Aksi tombol "Coba Lagi" untuk 500 (default: muat ulang halaman). */
  onRetry?: () => void;
  /** Sembunyikan seluruh tombol aksi. */
  hideActions?: boolean;
}

function ErrorStatePage({
  type,
  className,
  title,
  subtitle,
  homePath = '/',
  onRetry,
  hideActions = false,
}: ErrorStatePageProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const config = ERROR_STATE_CONFIG[type];
  const Icon = config.icon;

  function handlePrimary() {
    if (type === '500') {
      if (onRetry) onRetry();
      else window.location.reload();
    } else {
      navigate(homePath);
    }
  }

  return (
    <div
      data-testid={config.testId}
      className={`flex min-h-full flex-col items-center justify-center px-6 py-16 text-center ${className ?? ''}`}
    >
      <div className={`flex h-20 w-20 items-center justify-center rounded-full ${config.tone}`}>
        <Icon className="h-10 w-10" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold text-foreground">{title ?? t(config.titleKey)}</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        {subtitle ?? t(config.subtitleKey)}
      </p>
      <p className="mt-4 font-mono text-xs text-muted-foreground">{t('error.code', { code: type })}</p>
      {!hideActions && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            {t('common.back')}
          </Button>
          <Button onClick={handlePrimary}>{t(config.primaryKey)}</Button>
        </div>
      )}
    </div>
  );
}

export default ErrorStatePage;
