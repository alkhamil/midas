import { useState, useCallback, useRef, useEffect, useMemo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, CircleCheck, CircleX, TriangleAlert, Info } from 'lucide-react';
import { ToastContext, type ToastVariant, type ShowToastParams } from './toast-context';

interface ToastItemData {
  id: number;
  message: string | ReactNode;
  variant: ToastVariant;
  closable?: boolean;
  containerId?: string;
  className?: string;
  widthClass?: string;
}

const variantConfig: Record<
  ToastVariant,
  { bg: string; text: string; border: string; Icon: typeof CircleCheck }
> = {
  success: {
    bg: 'bg-success',
    text: 'text-white',
    border: 'border-success',
    Icon: CircleCheck,
  },
  error: {
    bg: 'bg-danger',
    text: 'text-white',
    border: 'border-danger',
    Icon: CircleX,
  },
  warning: {
    bg: 'bg-warning',
    text: 'text-white',
    border: 'border-warning',
    Icon: TriangleAlert,
  },
  info: {
    bg: 'bg-info',
    text: 'text-white',
    border: 'border-info',
    Icon: Info,
  },
};

let toastId = 0;

const DEFAULT_CONTAINER_ID = 'main-content';
const FORBIDDEN_EVENT = 'api-forbidden';

function resolveTarget(containerId?: string): HTMLElement {
  if (containerId) {
    const el = document.getElementById(containerId);
    if (el) return el;
  }
  return (
    document.getElementById(DEFAULT_CONTAINER_ID) ??
    document.getElementById('toast-root') ??
    document.body
  );
}

function defaultClassFor(target: HTMLElement): string {
  if (target === document.body) return 'fixed top-4 left-0 right-0 z-50';
  if (target.id === 'toast-root') return '';
  return 'absolute inset-x-0 top-14 z-50';
}

function ToastItem({ item, onClose }: { item: ToastItemData; onClose: (id: number) => void }) {
  const { bg, text, border, Icon } = variantConfig[item.variant];

  return (
    <div
      data-testid={`toast-${item.variant}`}
      className={[
        'inline-flex items-center rounded-lg border px-6 py-4 text-sm font-medium shadow-lg gap-2',
        item.widthClass ?? 'w-175',
        bg,
        text,
        border,
      ].join(' ')}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="flex-1">{item.message}</span>
      {item.closable !== false && (
        <button
          type="button"
          onClick={() => onClose(item.id)}
          className="shrink-0 cursor-pointer rounded-full p-0.5 transition-opacity hover:opacity-70"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItemData[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    ({
      message,
      variant,
      duration = 4000,
      closable,
      containerId,
      className,
      widthClass,
    }: ShowToastParams) => {
      const id = ++toastId;
      setToasts((prev) => [
        ...prev,
        { id, message, variant, closable, containerId, className, widthClass },
      ]);
      const timer = setTimeout(() => removeToast(id), duration);
      timersRef.current.set(id, timer);
    },
    [removeToast],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    const handleForbidden = (event: Event) => {
      const message = (event as CustomEvent<{ message?: string }>).detail?.message;
      showToast({
        message: message || 'You do not have permission to perform this action.',
        variant: 'error',
      });
    };
    window.addEventListener(FORBIDDEN_EVENT, handleForbidden);
    return () => window.removeEventListener(FORBIDDEN_EVENT, handleForbidden);
  }, [showToast]);

  const toastGroups = useMemo(() => {
    const groups = new Map<
      string,
      { target: HTMLElement; wrapperClass?: string; items: ToastItemData[] }
    >();
    for (const item of toasts) {
      const target = resolveTarget(item.containerId);
      const key = `${target.id ?? 'body'}::${item.className ?? ''}`;
      const entry = groups.get(key);
      if (entry) {
        entry.items.push(item);
      } else {
        groups.set(key, { target, wrapperClass: item.className, items: [item] });
      }
    }
    return Array.from(groups.values());
  }, [toasts]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toastGroups.map(({ target, wrapperClass, items }) =>
        createPortal(
          <div
            className={[
              'pointer-events-none w-full flex flex-col items-center gap-2',
              wrapperClass ?? defaultClassFor(target),
            ].join(' ')}
          >
            {items.map((item) => (
              <div key={item.id} className="pointer-events-auto">
                <ToastItem item={item} onClose={removeToast} />
              </div>
            ))}
          </div>,
          target,
        ),
      )}
    </ToastContext.Provider>
  );
}

export default ToastProvider;
