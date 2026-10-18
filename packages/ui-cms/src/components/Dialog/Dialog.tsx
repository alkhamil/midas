import { useEffect, useId, type ReactNode } from 'react';
import { dialogDefaults, type DialogProps as DesignProps } from '../../generated/props';
import { CloseIcon } from '../../generated/icons';
import { cx } from '../../internal/cx';
import { Button } from '../Button/Button';

export type DialogProps = DesignProps & {
  open: boolean;
  onClose: () => void;
  /** Called when the confirm button is clicked. When set (and no `footer`), the dialog renders Cancel / Confirm buttons. */
  onConfirm?: () => void;
  /** Custom footer actions; replaces the default Cancel / Confirm buttons. */
  footer?: ReactNode;
};

const sizes = { sm: 'max-w-[400px]', md: 'max-w-[520px]' } as const;

/**
 * Konfirmasi atau form singkat di atas halaman. Sengaja tidak memakai portal ke document.body supaya tetap benar saat
 * dirender di dalam iframe (Live DOM Renderer Midas) — overlay memakai `fixed` terhadap viewport tempat ia dirender.
 */
export function Dialog(props: DialogProps) {
  const { open, onClose, onConfirm, size, tone, title, message, cancelLabel, confirmLabel, children, footer: footerProp, testId } = { ...dialogDefaults, ...props };
  const footer = footerProp ?? (onConfirm && (
    <>
      <Button variant="secondary" onClick={onClose}>{cancelLabel}</Button>
      <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
    </>
  ));
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} data-testid={testId} className={cx('w-full overflow-hidden rounded-xl border border-border bg-background shadow-2xl', sizes[size])}>
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-foreground">
            {title}
          </h2>
          <button type="button" aria-label="Close" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <CloseIcon className="h-5 w-5" />
          </button>
        </header>
        <div className="px-6 py-6 text-sm text-muted-foreground">{children ?? message}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-border px-6 py-4">{footer}</footer>}
      </div>
    </div>
  );
}
