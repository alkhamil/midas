import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormState } from 'react-hook-form';
import Button from './Button';
import Dialog from './Dialog';
import { useConfirmNavigation } from '../../hooks';
import { Info } from 'lucide-react';

interface NavigationGuardProps {
  submitted: boolean;
  /** Blokir navigasi walau form belum berubah (mis. sudah ada polis terpilih). */
  force?: boolean;
  testId?: string;
  title?: string;
  description?: string;
}

function NavigationGuard({
  submitted,
  force = false,
  testId,
  title,
  description,
}: NavigationGuardProps) {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('guard.title');
  const resolvedDescription = description ?? t('guard.description');
  const { isDirty } = useFormState();
  const blocker = useConfirmNavigation((isDirty || force) && !submitted);

  const handleProceed = useCallback(() => {
    if (blocker.state === 'blocked') blocker.proceed();
  }, [blocker]);

  const handleReset = useCallback(() => {
    if (blocker.state === 'blocked') blocker.reset();
  }, [blocker]);

  return (
    <Dialog
      testId={testId}
      open={blocker.state === 'blocked'}
      maxWidth="md"
      onClose={handleReset}
      closeOnEscape={false}
      hideCloseButton
    >
      <div className="flex items-start gap-4">
        <Info className="h-12 w-12 shrink-0 text-warning" />
        <div>
          <p className="text-base font-medium text-foreground">{resolvedTitle}</p>
          <p className="mt-1 text-sm font-normal text-muted-foreground">{resolvedDescription}</p>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" className="w-25" onClick={handleReset}>
          {t('common.cancel')}
        </Button>
        <Button className="w-25" onClick={handleProceed}>
          {t('guard.continue')}
        </Button>
      </div>
    </Dialog>
  );
}

export default NavigationGuard;
