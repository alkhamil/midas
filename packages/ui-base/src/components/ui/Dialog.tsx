import { useState, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  hideCloseButton?: boolean;
  disableCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  testId?: string;
}

const maxWidthStyles: Record<string, string> = {
  sm: 'max-w-[400px]',
  md: 'max-w-[500px]',
  lg: 'max-w-[640px]',
  xl: 'max-w-[800px]',
  '2xl': 'max-w-[1000px]',
};

function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'md',
  hideCloseButton = false,
  disableCloseButton = false,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  testId,
}: DialogProps) {
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => {
      cancelAnimationFrame(frame);
      setVisible(false);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !closeOnEscape) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, closeOnEscape, onClose]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div data-dialog="true" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        data-testid={testId ? `${testId}-backdrop` : undefined}
        className={[
          'fixed inset-0 bg-black/50 transition-opacity duration-200',
          visible ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
        onClick={closeOnBackdropClick ? onClose : undefined}
      />
      <div
        data-testid={testId}
        ref={panelRef}
        className={[
          'relative z-10 flex max-h-[90vh] w-full flex-col rounded-xl bg-background shadow-xl transition-all duration-200',
          maxWidthStyles[maxWidth],
          visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            {!hideCloseButton && (
              <button
                data-testid={testId ? `${testId}-close` : undefined}
                type="button"
                onClick={onClose}
                disabled={disableCloseButton}
                className={[
                  'flex items-center rounded-md p-1 text-muted-foreground transition-colors',
                  disableCloseButton
                    ? 'cursor-not-allowed opacity-50'
                    : 'cursor-pointer hover:bg-muted hover:text-foreground',
                ].join(' ')}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-5 w-5"
                >
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            )}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default Dialog;
