import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { CloseIcon as X } from '../../generated/icons';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'sm' | 'md' | 'lg';
  /** Modal = backdrop + kunci scroll (default true). Non-modal: kanvas tetap interaktif. */
  modal?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  testId?: string;
}

const widthStyles: Record<string, string> = {
  sm: 'w-[320px]',
  md: 'w-[400px]',
  lg: 'w-[480px]',
};

function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'md',
  modal = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  testId,
}: DrawerProps) {
  const { t } = useTranslation();
  // `render` menahan mount selama animasi tutup; `visible` menggerakkan transisi.
  const [render, setRender] = useState(open);
  const [visible, setVisible] = useState(false);
  const asideRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
      setRender(true);
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    // Tutup: mainkan transisi keluar dulu, baru unmount.
    setVisible(false);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    closeTimer.current = window.setTimeout(
      () => {
        setRender(false);
        closeTimer.current = null;
      },
      reduceMotion ? 0 : 200,
    );
    return () => {
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
    };
  }, [open ]);

  useEffect(() => {
    if (!open || !closeOnEscape) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      // Dialog di atas drawer menangani Escape sendiri — drawer non-modal
      // jangan ikut menutup agar seleksi kanvas tidak hilang.
      if (!modal && document.querySelector('[data-dialog]')) return;
      onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, closeOnEscape, modal, onClose]);

  useEffect(() => {
    if (open && modal) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open, modal]);

  // Mode non-modal (kanvas tetap interaktif): klik di luar panel menutup
  // drawer. Klik di dropdown select / dialog yang di-portal ke body
  // diabaikan agar memilih option / mengisi modal tidak ikut menutup drawer.
  useEffect(() => {
    if (!open || modal || !closeOnBackdropClick) return;
    function handlePointerDown(e: PointerEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (asideRef.current?.contains(target)) return;
      if (typeof target.closest !== 'function') return;
      if (target.closest('[data-select-dropdown]')) return;
      if (target.closest('[data-dialog]')) return;
      onClose();
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open, modal, closeOnBackdropClick, onClose]);

  if (!render) return null;

  return createPortal(
    <div
      data-testid={testId}
      className={`fixed inset-0 z-40 ${modal ? '' : 'pointer-events-none'}`}
    >
      {modal && (
        <div
          data-testid={testId ? `${testId}-backdrop` : undefined}
          className={[
            'fixed inset-0 bg-black/50 transition-opacity duration-200',
            visible ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
          onClick={closeOnBackdropClick ? onClose : undefined}
        />
      )}
      <aside
        ref={asideRef}
        className={[
          'absolute top-0 right-0 flex h-full max-w-[92vw] flex-col border-l border-border bg-background shadow-xl transition-transform duration-200',
          modal ? '' : 'pointer-events-auto',
          widthStyles[width],
          visible ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <button
              data-testid={testId ? `${testId}-close` : undefined}
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="flex cursor-pointer items-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
            {footer}
          </div>
        )}
      </aside>
    </div>,
    document.body,
  );
}

export default Drawer;
