import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Button } from '@midas/ui-cms';

export type ErrorStateType = '403' | '404' | '500';

const KEYS = {
  '403': ['error.forbiddenTitle', 'error.forbiddenSubtitle'],
  '404': ['error.notFoundTitle', 'error.notFoundSubtitle'],
  '500': ['error.systemTitle', 'error.systemSubtitle'],
} as const;

/** Halaman status error (403/404/500) dengan tombol kembali ke dashboard. */
function ErrorStatePage({ type }: { type: ErrorStateType }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [title, subtitle] = KEYS[type];
  return (
    <div data-testid={`error-${type}`} className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center">
      <p className="text-5xl font-semibold text-muted-foreground">{type}</p>
      <h1 className="text-xl font-semibold text-foreground">{t(title)}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{t(subtitle)}</p>
      <Button onClick={() => navigate('/')}>{t('error.toDashboard')}</Button>
    </div>
  );
}

export default ErrorStatePage;
