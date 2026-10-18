import { useEffect, useId, type ReactNode } from 'react';
import { drawerDefaults, type DrawerProps as DesignProps } from '../../generated/props';
import { CloseIcon } from '../../generated/icons';
import { Button } from '../Button/Button';

export type DrawerProps = DesignProps & {
  open: boolean;
  onClose: () => void;
  /** Called when the primary button (default "Apply") is clicked; renders the default footer buttons. */
  onPrimary?: () => void;
  /** Called when the secondary button (default "Reset") is clicked. */
  onSecondary?: () => void;
  /** Custom footer; replaces the default buttons. */
  footer?: ReactNode;
};

/**
 * Side panel that slides in from the right (e.g. list filters). Like Dialog it avoids a portal so it also works inside the
 * Live DOM Renderer iframe: the overlay is `fixed` relative to the viewport it is rendered in.
 */
export function Drawer(props: DrawerProps) {
  const { open, onClose, onPrimary, onSecondary, title, primaryLabel, secondaryLabel, children, footer: footerProp, testId } = { ...drawerDefaults, ...props };
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const footer = footerProp ?? ((onPrimary || onSecondary) && (
    <>
      <Button variant="secondary" onClick={onSecondary}>{secondaryLabel}</Button>
      <Button onClick={onPrimary}>{primaryLabel}</Button>
    </>
  ));
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-modal="true" aria-labelledby={titleId} data-testid={testId} className="flex h-full w-full max-w-[400px] flex-col border-l border-border bg-background shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-foreground">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <CloseIcon className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
        {footer && <footer className="flex shrink-0 justify-end gap-2 border-t border-border px-6 py-4">{footer}</footer>}
      </aside>
    </div>
  );
}
