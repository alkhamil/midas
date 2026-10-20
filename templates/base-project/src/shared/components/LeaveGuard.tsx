import { useEffect, type MutableRefObject } from 'react';
import { useFormContext } from 'react-hook-form';
import { useBlocker } from 'react-router';
import { Dialog } from '../ui';

interface LeaveGuardProps {
  /** Set `bypass.current = true` right before a deliberate navigation (e.g. after a successful save). */
  bypass: MutableRefObject<boolean>;
  title?: string;
  message?: string;
  cancelLabel?: string;
  confirmLabel?: string;
}

/**
 * Asks for confirmation before leaving a form page with unsaved changes (in-app navigation, browser back and tab close).
 * Render it inside `FormGroup`; the dialog texts come from the "discard changes" dialog in the design.
 */
function LeaveGuard({
  bypass,
  title = 'Discard changes?',
  message = 'You have unsaved changes. They will be lost if you leave this page.',
  cancelLabel = 'Stay',
  confirmLabel = 'Discard',
}: LeaveGuardProps) {
  const {
    formState: { isDirty },
  } = useFormContext();
  const blocker = useBlocker(() => isDirty && !bypass.current);

  useEffect(() => {
    if (!isDirty) return undefined;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (bypass.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty, bypass]);

  return (
    <Dialog
      open={blocker.state === 'blocked'}
      onClose={() => blocker.reset?.()}
      onConfirm={() => blocker.proceed?.()}
      tone="danger"
      title={title}
      message={message}
      cancelLabel={cancelLabel}
      confirmLabel={confirmLabel}
    />
  );
}

export default LeaveGuard;
